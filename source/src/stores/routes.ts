import type { Account } from "../types/emby";
import { connectionId } from "./connections";
import { EmbyClient, normalizeServer } from "../api/client";
export interface ServerRoute {
  name: string;
  url: string;
  serverId: string;
  userId?: string;
}
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
      name: "默认线路",
      url: base,
      serverId: account.serverId || "",
      userId: account.userId,
    });
  if (!list.some((r) => r.url === account.server))
    list.push({
      name: "当前线路",
      url: account.server,
      serverId: account.serverId || "",
      userId: account.userId,
    });
  return list;
}
export function saveRoute(account: Account, route: ServerRoute) {
  const list = readRoutes(account).filter((r) => r.url !== route.url);
  localStorage.setItem(key(account), JSON.stringify([...list, route]));
  window.dispatchEvent(new Event("miry-route-quality"));
}
export function deleteRoute(account: Account, url: string) {
  if (url === account.server || url === (account.homeServer || account.server))
    throw new Error("当前线路和默认线路不能删除。");
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
) {
  const url = normalizeServer(address),
    began = performance.now();
  const publicClient = new EmbyClient({
    ...account,
    server: url,
    token: "",
    userId: "",
  });
  const expected =
    account.serverId ||
    readRoutes(account).find((route) => route.serverId)?.serverId ||
    (await new EmbyClient(account).serverInfo(signal)).Id;
  if (typeof expected !== "string" || !expected)
    throw new Error("当前服务器未提供身份标识，暂时不能确认备用线路。");
  const info = await publicClient.serverInfo(signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (info.Id !== expected)
    throw new Error("这条地址属于其他服务器，请通过“添加服务器”单独登录。");
  const identity = await new EmbyClient({ ...account, server: url }).request<{
    Id: string;
  }>(`/Users/${encodeURIComponent(account.userId)}`, {}, undefined, signal);
  if (identity.Id !== account.userId)
    throw new Error("这条线路的账号身份不一致，请单独登录。");
  return {
    url,
    serverId: info.Id,
    userId: identity.Id,
    latency: Math.round(performance.now() - began),
    name: info.ServerName,
  };
}
export function activeRoutes(account: Account): ServerRoute[] {
  if (!account.serverId || !account.userId) return [];
  const routes = [
    ...new Map(
      readRoutes(account)
        .filter(
          (r) => r.serverId === account.serverId && r.userId === account.userId,
        )
        .map((r) => [r.url, r]),
    ).values(),
  ];
  return routes.length >= 2 ? routes : [];
}
