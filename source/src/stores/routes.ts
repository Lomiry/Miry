import { t } from "../i18n/core";
import type { Account } from "../types/emby";
import { connectionId } from "./connections";
import { EmbyClient, normalizeServer } from "../api/client";
export interface ServerRoute {
  name: string;
  generatedName?: "default" | "current" | "number";
  url: string;
  serverId: string;
  userId?: string;
  enabled?: boolean;
  priority?: number;
  status?: "pending" | "verified";
  failure?: string;
  ignoreCertificateErrors?: boolean;
  /** Configuration generation; optional for existing saved routes. */
  revision?: string;
}
export type VerifiedRoute = Awaited<ReturnType<typeof verifyRoute>>;
const key = (account: Account) => "miry-routes:" + connectionId(account);
export function readRoutes(account: Account): ServerRoute[] {
  let list: ServerRoute[] = [];
  try {
    const data = JSON.parse(localStorage.getItem(key(account)) || "[]");
    if (Array.isArray(data))
      list = data
        .filter(
          (r) =>
            typeof r?.name === "string" &&
            typeof r?.serverId === "string" &&
            typeof r?.url === "string",
        )
        .filter((r) => {
          try {
            return normalizeServer(r.url) === r.url;
          } catch {
            return false;
          }
        });
  } catch {
    /* Invalid preferences are ignored. */
  }
  const base = account.homeServer || account.server;
  if (!list.some((r) => r.url === base))
    list.unshift({
      name: t("network.default_route"),
      generatedName: "default",
      url: base,
      serverId: account.serverId || "",
      userId: account.userId,
      ignoreCertificateErrors:
        base === account.server ? account.ignoreCertificateErrors : undefined,
    });
  if (!list.some((r) => r.url === account.server))
    list.push({
      name: t("network.current_route"),
      generatedName: "current",
      url: account.server,
      serverId: account.serverId || "",
      userId: account.userId,
      ignoreCertificateErrors: account.ignoreCertificateErrors,
    });
  return list.slice(0, 20);
}
export function routeDisplayName(route: ServerRoute, index: number) {
  if (route.generatedName === "default") return t("network.default_route");
  if (route.generatedName === "current") return t("network.current_route");
  if (route.generatedName === "number")
    return t("network.route_number", { p0: index + 1 });
  return route.name || t("network.route_number", { p0: index + 1 });
}
const configuration = (route: ServerRoute) => [
  route.name,
  route.generatedName,
  route.url,
  route.serverId,
  route.userId,
  route.enabled !== false,
  route.priority ?? 100,
  route.status ?? "verified",
  route.ignoreCertificateErrors === true,
];
export function routeVersion(account: Account, route: ServerRoute) {
  return JSON.stringify([
    connectionId(account),
    account.serverId,
    route.revision,
    ...configuration(route),
  ]);
}
export function routeConnectionVersion(route: ServerRoute) {
  return JSON.stringify([
    route.url,
    route.serverId,
    route.userId,
    route.ignoreCertificateErrors === true,
  ]);
}
export interface RouteLease {
  url: string;
  version: string;
}
export function captureRoute(account: Account, route: ServerRoute): RouteLease {
  const current = readRoutes(account).find((r) => r.url === route.url);
  return {
    url: route.url,
    version: current ? routeVersion(account, current) : "",
  };
}
export function currentRoute(account: Account, lease: RouteLease) {
  const route = readRoutes(account).find((r) => r.url === lease.url);
  return route && routeVersion(account, route) === lease.version
    ? route
    : undefined;
}
/** Compare and patch synchronously; never resurrect or overwrite configuration. */
export function updateRouteFailure(
  account: Account,
  lease: RouteLease,
  failure: string,
) {
  const route = currentRoute(account, lease);
  if (!route || route.failure === failure) return;
  localStorage.setItem(
    key(account),
    JSON.stringify(
      readRoutes(account).map((r) =>
        r.url === lease.url ? { ...r, failure } : r,
      ),
    ),
  );
  window.dispatchEvent(new Event("miry-route-quality"));
}
export function saveRoute(account: Account, route: ServerRoute) {
  route = { ...route, url: normalizeServer(route.url) };
  if (
    route.status === "pending" &&
    readRoutes(account).some(
      (r) => r.url === route.url && r.status !== "pending",
    )
  )
    throw new Error(t("routeC.duplicate_route"));
  const list = readRoutes(account).filter((r) => r.url !== route.url);
  if (list.length >= 20) throw new Error(t("routeC.max_routes"));
  const previous = readRoutes(account).find((r) => r.url === route.url);
  const same =
    previous &&
    JSON.stringify(configuration(previous)) ===
      JSON.stringify(configuration(route));
  if (same && previous.failure === route.failure) return;
  const revision = same ? previous.revision : crypto.randomUUID();
  // Store configuration only; caller objects must never persist account secrets.
  const {
    name,
    generatedName,
    url,
    serverId,
    userId,
    enabled,
    priority,
    status,
    failure,
    ignoreCertificateErrors,
  } = route;
  localStorage.setItem(
    key(account),
    JSON.stringify([
      ...list,
      {
        name,
        generatedName,
        url: normalizeServer(url),
        serverId,
        userId,
        enabled,
        priority: Number.isFinite(priority)
          ? Math.max(0, Math.min(999, priority!))
          : undefined,
        status,
        failure,
        ignoreCertificateErrors,
        revision,
      },
    ]),
  );
  window.dispatchEvent(new Event("miry-route-quality"));
}
export function deleteRoute(account: Account, url: string) {
  if (url === account.server || url === (account.homeServer || account.server))
    throw new Error(t("network.the_current_and_default_routes_cannot_be"));
  localStorage.setItem(
    key(account),
    JSON.stringify(readRoutes(account).filter((r) => r.url !== url)),
  );
  window.dispatchEvent(new Event("miry-route-quality"));
}
export async function verifyRoute(
  account: Account,
  address: string,
  signal: AbortSignal,
  ignoreCertificateErrors = readRoutes(account).find(
    (r) => r.url === normalizeServer(address),
  )?.ignoreCertificateErrors ??
    (normalizeServer(address) === account.server &&
      account.ignoreCertificateErrors === true),
) {
  const url = normalizeServer(address),
    began = performance.now();
  const publicClient = new EmbyClient({
    ...account,
    server: url,
    token: "",
    userId: "",
    ignoreCertificateErrors,
  });
  const expected =
    account.serverId ||
    readRoutes(account).find((route) => route.serverId)?.serverId ||
    (await new EmbyClient(account).serverInfo(signal)).Id;
  if (typeof expected !== "string" || !expected)
    throw new Error(t("network.the_server_did_not_provide_an_identity"));
  const info = await publicClient.serverInfo(signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (info.Id !== expected)
    throw new Error(t("network.this_address_belongs_to_another_server_use"));
  const identity = await new EmbyClient({
    ...account,
    server: url,
    ignoreCertificateErrors,
  }).request<{
    Id: string;
  }>(`/Users/${encodeURIComponent(account.userId)}`, {}, undefined, signal);
  if (identity.Id !== account.userId)
    throw new Error(t("network.the_account_identity_differs_on_this_route"));
  return {
    url,
    serverId: info.Id,
    userId: identity.Id,
    latency: Math.round(performance.now() - began),
    name: info.ServerName,
    ignoreCertificateErrors,
  };
}
export function activeRoutes(account: Account): ServerRoute[] {
  if (!account.serverId || !account.userId) return [];
  const routes = [
    ...new Map(
      readRoutes(account)
        .filter(
          (r) =>
            r.enabled !== false &&
            r.status !== "pending" &&
            r.serverId === account.serverId &&
            r.userId === account.userId,
        )
        .map((r) => [r.url, r]),
    ).values(),
  ];
  return routes.length >= 2
    ? routes.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    : [];
}
