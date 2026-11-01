import { t } from "../i18n/core";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Account, Item } from "../types/emby";
import {
  activeRoutes,
  readRoutes,
  verifyRoute,
  captureRoute,
  currentRoute,
  routeVersion,
  routeConnectionVersion,
  type ServerRoute,
} from "../stores/routes";
export interface RouteMetrics {
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  connectMs: number | null;
  apiTtfbMs: number | null;
  apiTotalMs: number | null;
  smallObjectMs: number | null;
  jitterMs: number | null;
  throughputMbps: number | null;
  sampleBytes: number;
  mediaTotalMs: number | null;
  failureRate: number;
  samples: number;
  identityValid: boolean;
  mediaNote: string;
}
export interface RouteTest {
  at: number;
  metrics: RouteMetrics;
  score: number;
  label: string;
  reasons: string[];
  bitrate?: number;
  connection?: string;
}
export interface RouteQuality {
  mode: "auto" | "manual";
  pinned?: string;
  recommended?: string;
  automatic?: string;
  tests: Record<string, RouteTest>;
  intent?: string;
}
const key = (a: Account) =>
  `miry-route-quality:${a.serverId || a.homeServer || a.server}|${a.userId}`;
const nullableKeys = [
  "dnsMs",
  "tcpMs",
  "tlsMs",
  "connectMs",
  "apiTtfbMs",
  "apiTotalMs",
  "smallObjectMs",
  "jitterMs",
  "throughputMbps",
  "mediaTotalMs",
] as const;
export function normalizeMetrics(value: unknown): RouteMetrics {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const m = {
    sampleBytes:
      typeof raw.sampleBytes === "number" && Number.isFinite(raw.sampleBytes)
        ? Math.max(0, Math.min(256 * 1024, raw.sampleBytes))
        : 0,
    samples:
      typeof raw.samples === "number" && Number.isFinite(raw.samples)
        ? Math.floor(Math.max(0, Math.min(3, raw.samples)))
        : 0,
    failureRate:
      typeof raw.failureRate === "number" && Number.isFinite(raw.failureRate)
        ? Math.max(0, Math.min(1, raw.failureRate))
        : 1,
    identityValid: raw.identityValid === true,
    mediaNote:
      typeof raw.mediaNote === "string" ? raw.mediaNote.slice(0, 120) : "",
  } as RouteMetrics;
  for (const k of nullableKeys)
    m[k] =
      typeof raw[k] === "number" && Number.isFinite(raw[k]) && raw[k] >= 0
        ? Math.min(1e6, raw[k])
        : null;
  return m;
}
export function routeScore(m: RouteMetrics, bitrate?: number) {
  const reasons: string[] = [];
  let score = 100;
  if (!m.identityValid || m.apiTtfbMs === null || m.failureRate >= 0.25)
    return {
      score: 0,
      label: t("player.unstable"),
      reasons: [t("player.api_or_server_identity_checks_are_not")],
    };
  score -= Math.min(45, Math.max(0, (m.apiTtfbMs - 150) / 40));
  reasons.push(
    t("player.api_time_to_first_byte_ms", { p0: Math.round(m.apiTtfbMs) }),
  );
  score -= m.failureRate * 60;
  if (m.failureRate > 0)
    reasons.push(
      t("player.sample_failure_rate", { p0: Math.round(m.failureRate * 100) }),
    );
  if (m.jitterMs !== null) {
    score -= Math.min(20, m.jitterMs / 15);
    reasons.push(
      t("player.latency_variation_ms", { p0: Math.round(m.jitterMs) }),
    );
  }
  if (m.throughputMbps !== null) {
    const target = bitrate && bitrate > 0 ? (bitrate / 1e6) * 1.2 : 5;
    score -= Math.min(35, Math.max(0, 1 - m.throughputMbps / target) * 35);
    reasons.push(
      t("player.sample_throughput_mbps", {
        p0: m.throughputMbps.toFixed(1),
        p1: bitrate
          ? t("player.including_headroom_for_the_current_bitrate")
          : "",
      }),
    );
  } else
    reasons.push(
      t("player.media_throughput_is_untested_or_unreliable_recommendation"),
    );
  score = Math.max(0, Math.round(score));
  return {
    score,
    label:
      score >= 80
        ? t("player.good")
        : score >= 55
          ? t("player.fair")
          : t("player.unstable"),
    reasons,
  };
}
export function readRouteQuality(account: Account): RouteQuality {
  const fallback: RouteQuality = {
    mode: "manual",
    pinned: account.server,
    tests: {},
  };
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) || "null");
    if (!raw || typeof raw !== "object") return fallback;
    const routes = readRoutes(account);
    const eligible = routes.filter(
      (r) =>
        r.enabled !== false &&
        r.status !== "pending" &&
        r.serverId === account.serverId &&
        r.userId === account.userId,
    );
    const urls = new Set(eligible.map((r) => r.url)),
      tests: RouteQuality["tests"] = {};
    for (const [url, test] of Object.entries(raw.tests || {}).slice(-20)) {
      const t = test as Partial<RouteTest>;
      const route = eligible.find((r) => r.url === url);
      if (
        urls.has(url) &&
        route &&
        (t.connection
          ? t.connection === routeConnectionVersion(route)
          : !route.revision) &&
        typeof t.at === "number" &&
        Number.isFinite(t.at) &&
        t.at <= Date.now() + 60000 &&
        Date.now() - t.at < 7 * 864e5
      ) {
        const metrics = normalizeMetrics(t.metrics),
          bitrate =
            typeof t.bitrate === "number" &&
            Number.isFinite(t.bitrate) &&
            t.bitrate > 0
              ? t.bitrate
              : undefined;
        tests[url] = {
          at: t.at,
          metrics,
          bitrate,
          connection: t.connection,
          ...routeScore(metrics, bitrate),
        };
      }
    }
    return {
      mode: raw.mode === "auto" ? "auto" : "manual",
      intent: typeof raw.intent === "string" ? raw.intent : undefined,
      pinned: urls.has(raw.pinned)
        ? raw.pinned
        : raw.mode === "auto"
          ? undefined
          : account.server,
      recommended: recommendation(tests, eligible),
      automatic: urls.has(raw.automatic) ? raw.automatic : undefined,
      tests,
    };
  } catch {
    return fallback;
  }
}
function recommendation(tests: RouteQuality["tests"], routes: ServerRoute[]) {
  const priorities = new Map(
    routes
      .filter((r) => r.enabled !== false && r.status !== "pending")
      .map((r) => [r.url, r.priority ?? 100]),
  );
  return Object.entries(tests)
    .filter(
      ([url, test]) =>
        priorities.has(url) &&
        test.metrics.identityValid &&
        test.score >= 55 &&
        Date.now() - test.at < 864e5,
    )
    .sort(
      (a, b) =>
        priorities.get(a[0])! - priorities.get(b[0])! ||
        b[1].score - a[1].score ||
        (a[1].metrics.apiTtfbMs ?? Infinity) -
          (b[1].metrics.apiTtfbMs ?? Infinity),
    )[0]?.[0];
}
/** User intent plus existing route generations; no second configuration store. */
export function autoRouteVersion(account: Account) {
  const quality = readRouteQuality(account);
  return JSON.stringify([
    account.server,
    key(account),
    quality.mode,
    quality.pinned,
    quality.intent,
    readRoutes(account)
      .map((route) => routeVersion(account, route))
      .sort(),
  ]);
}
function write(account: Account, value: RouteQuality) {
  localStorage.setItem(key(account), JSON.stringify(value));
  window.dispatchEvent(new Event("miry-route-quality"));
}
export function setRouteMode(
  account: Account,
  mode: "auto" | "manual",
  pinned = account.server,
) {
  const q = readRouteQuality(account);
  if (q.mode === mode && q.pinned === (mode === "manual" ? pinned : undefined))
    return;
  write(account, {
    ...q,
    mode,
    pinned: mode === "manual" ? pinned : undefined,
    intent: crypto.randomUUID(),
  });
}
export function noteRouteChoice(
  account: Account,
  url: string,
  manual: boolean,
) {
  if (manual) {
    setRouteMode(account, "manual", url);
    return;
  }
  write(account, { ...readRouteQuality(account), automatic: url });
}
export function saveRouteTest(
  account: Account,
  route: ServerRoute,
  metrics: RouteMetrics,
  bitrate?: number,
) {
  const q = readRouteQuality(account),
    test = {
      at: Date.now(),
      metrics,
      bitrate,
      connection: routeConnectionVersion(route),
      ...routeScore(metrics, bitrate),
    };
  q.tests[route.url] = test;
  q.recommended = recommendation(q.tests, readRoutes(account));
  write(account, q);
  return test;
}
const recentProbes = new Map<string, number>();
let warningsSuppressed = false;
export const routeWarningsSuppressed = () => warningsSuppressed;
export const suppressRouteWarnings = () => {
  warningsSuppressed = true;
};
export async function testRoute(
  account: Account,
  route: ServerRoute,
  signal: AbortSignal,
  media?: { item: Item; sourceId: string },
) {
  if (!activeRoutes(account).some((r) => r.url === route.url))
    throw Error(t("player.smart_route_requires_at_least_two_verified"));
  if (!isTauri())
    throw Error(t("player.route_quality_checks_require_the_windows_desktop"));
  const probeKey = `${key(account)}|${route.url}`;
  if (Date.now() - (recentProbes.get(probeKey) ?? 0) < 60000)
    throw Error(t("player.wait_at_least_60_seconds_before_testing"));
  recentProbes.set(probeKey, Date.now());
  if (recentProbes.size > 200)
    recentProbes.delete(recentProbes.keys().next().value!);
  const lease = captureRoute(account, route);
  route = currentRoute(account, lease)!;
  const measurementVersion = () => {
    const test = readRouteQuality(account).tests[route.url];
    return test
      ? JSON.stringify([test.at, test.metrics, test.bitrate, test.connection])
      : "";
  };
  const previousMeasurement = measurementVersion();
  const checked = await verifyRoute(account, route.url, signal);
  if (signal.aborted || !currentRoute(account, lease))
    throw new DOMException("Aborted", "AbortError");
  const id = crypto.randomUUID(),
    cancel = () => void invoke("cancel_route_probe", { id }).catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted || !currentRoute(account, lease))
      throw new DOMException("Aborted", "AbortError");
    const raw = await invoke<unknown>("route_probe", {
      id,
      server: checked.url,
      expected: checked.serverId,
      ignoreCertificateErrors: route.ignoreCertificateErrors === true,
      media: media
        ? {
            itemId: media.item.Id,
            sourceId: media.sourceId,
            container: media.item.MediaSources?.find(
              (s) => s.Id === media.sourceId,
            )?.Container,
            token: account.token,
          }
        : null,
    });
    if (
      signal.aborted ||
      !currentRoute(account, lease) ||
      measurementVersion() !== previousMeasurement
    )
      throw new DOMException("Aborted", "AbortError");
    return saveRouteTest(
      account,
      route,
      normalizeMetrics(raw),
      media?.item.MediaSources?.find((s) => s.Id === media.sourceId)?.Bitrate,
    );
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
export function routeDetail(test: RouteTest) {
  return t("player.100_individual_dns_tcp_tls_stages_are", {
    p0: test.score,
    p1: test.reasons.join("；"),
  });
}
