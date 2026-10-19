import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Account, Item } from "../types/emby";
import {
  activeRoutes,
  readRoutes,
  verifyRoute,
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
}
export interface RouteQuality {
  mode: "auto" | "manual";
  pinned?: string;
  recommended?: string;
  automatic?: string;
  tests: Record<string, RouteTest>;
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
      label: "不稳定",
      reasons: ["API 或服务器身份验证未稳定通过"],
    };
  score -= Math.min(45, Math.max(0, (m.apiTtfbMs - 150) / 40));
  reasons.push(`API 首字节 ${Math.round(m.apiTtfbMs)} ms`);
  score -= m.failureRate * 60;
  if (m.failureRate > 0)
    reasons.push(`小样本失败率 ${Math.round(m.failureRate * 100)}%`);
  if (m.jitterMs !== null) {
    score -= Math.min(20, m.jitterMs / 15);
    reasons.push(`延迟波动 ${Math.round(m.jitterMs)} ms`);
  }
  if (m.throughputMbps !== null) {
    const target = bitrate && bitrate > 0 ? (bitrate / 1e6) * 1.2 : 5;
    score -= Math.min(35, Math.max(0, 1 - m.throughputMbps / target) * 35);
    reasons.push(
      `短样本吞吐 ${m.throughputMbps.toFixed(1)} Mbps${bitrate ? "，含当前码率余量" : ""}`,
    );
  } else reasons.push("媒体吞吐未测或样本不可靠，仅按 API 推荐");
  score = Math.max(0, Math.round(score));
  return {
    score,
    label: score >= 80 ? "良好" : score >= 55 ? "一般" : "不稳定",
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
    const urls = new Set(readRoutes(account).map((r) => r.url)),
      tests: RouteQuality["tests"] = {};
    for (const [url, test] of Object.entries(raw.tests || {}).slice(-20)) {
      const t = test as Partial<RouteTest>;
      if (
        urls.has(url) &&
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
          ...routeScore(metrics, bitrate),
        };
      }
    }
    return {
      mode: raw.mode === "auto" ? "auto" : "manual",
      pinned: urls.has(raw.pinned)
        ? raw.pinned
        : raw.mode === "auto"
          ? undefined
          : account.server,
      recommended:
        urls.has(raw.recommended) &&
        tests[raw.recommended] &&
        tests[raw.recommended].score >= 55 &&
        Date.now() - tests[raw.recommended].at < 864e5
          ? raw.recommended
          : undefined,
      automatic: urls.has(raw.automatic) ? raw.automatic : undefined,
      tests,
    };
  } catch {
    return fallback;
  }
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
  write(account, {
    ...q,
    mode,
    pinned: mode === "manual" ? pinned : undefined,
  });
}
export function noteRouteChoice(
  account: Account,
  url: string,
  manual: boolean,
) {
  const q = readRouteQuality(account);
  write(
    account,
    manual ? { ...q, mode: "manual", pinned: url } : { ...q, automatic: url },
  );
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
      ...routeScore(metrics, bitrate),
    };
  q.tests[route.url] = test;
  const winner = Object.entries(q.tests)
    .filter(
      ([, t]) =>
        t.metrics.identityValid && t.score >= 55 && Date.now() - t.at < 864e5,
    )
    .sort(
      (a, b) =>
        b[1].score - a[1].score ||
        (a[1].metrics.apiTtfbMs ?? Infinity) -
          (b[1].metrics.apiTtfbMs ?? Infinity),
    )[0];
  q.recommended = winner?.[0];
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
    throw Error("Smart Route 需要至少两条同服务器、同账号的已验证线路。");
  if (!isTauri()) throw Error("线路品质评估需要 Windows 桌面版。");
  const probeKey = `${key(account)}|${route.url}`;
  if (Date.now() - (recentProbes.get(probeKey) ?? 0) < 60000)
    throw Error("请至少间隔 60 秒再测试这条线路。");
  recentProbes.set(probeKey, Date.now());
  if (recentProbes.size > 200)
    recentProbes.delete(recentProbes.keys().next().value!);
  const checked = await verifyRoute(account, route.url, signal);
  const id = crypto.randomUUID(),
    cancel = () => void invoke("cancel_route_probe", { id }).catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const raw = await invoke<unknown>("route_probe", {
      id,
      server: checked.url,
      expected: checked.serverId,
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
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
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
  return `${test.score}/100 · ${test.reasons.join("；")} · DNS/TCP/TLS 独立阶段未暴露，显示 Unknown`;
}
