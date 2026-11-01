// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { saveRoute, readRoutes, deleteRoute } from "../stores/routes";
import { setRouteMode } from "./smartRoutes";
import { canFallback, findFallback } from "./routeFallback";
let serial = 0;
const base = {
  server: "https://home.example.test/emby",
  serverId: "s",
  userId: "u",
  token: "test-only",
  name: "demo",
  deviceId: "d",
};
let account = base;
beforeEach(() => {
  localStorage.clear();
  account = { ...base, userId: `u${serial++}` };
});
afterEach(() => vi.unstubAllGlobals());
const add = (host: string, priority = 100) =>
  saveRoute(account, {
    name: host,
    url: `https://${host}.example.test/emby`,
    serverId: "s",
    userId: account.userId,
    priority,
  });
const fetcher = (host: string, wrong = false) =>
  vi.fn(async (url: string) => {
    if (!url.includes(host)) throw Error("offline");
    return new Response(
      JSON.stringify(
        url.includes("/Users/")
          ? { Id: account.userId }
          : { Id: wrong ? "other" : "s", ServerName: "Demo", Version: "4.9" },
      ),
    );
  });
it("never probes or changes a manual pin", async () => {
  add("backup");
  const fetch = fetcher("backup");
  vi.stubGlobal("fetch", fetch);
  expect(
    await findFallback(account, new AbortController().signal),
  ).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("uses priority and falls through a failed route with bounded repeated attempts", async () => {
  add("offline", 0);
  add("working", 1);
  setRouteMode(account, "auto");
  const fetch = fetcher("working");
  vi.stubGlobal("fetch", fetch);
  expect(
    (await findFallback(account, new AbortController().signal))?.route.url,
  ).toContain("working");
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    readRoutes(account).find((r) => r.name === "offline")?.failure,
  ).toBeTruthy();
  expect(
    await findFallback(account, new AbortController().signal),
  ).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("never sends a token to a different server ID", async () => {
  add("wrong");
  setRouteMode(account, "auto");
  const fetch = fetcher("wrong", true);
  vi.stubGlobal("fetch", fetch);
  expect(
    await findFallback(account, new AbortController().signal),
  ).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    (fetch.mock.calls as unknown as [string, RequestInit][])[0][1].headers,
  ).not.toHaveProperty("X-Emby-Token");
});
it("excludes disabled and pending routes and respects cancellation", async () => {
  add("backup");
  saveRoute(account, { ...readRoutes(account)[1], enabled: false });
  setRouteMode(account, "auto");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await findFallback(account, new AbortController().signal);
  expect(fetch).not.toHaveBeenCalled();
  const controller = new AbortController();
  controller.abort();
  await findFallback({ ...account, userId: "other" }, controller.signal);
  expect(fetch).not.toHaveBeenCalled();
});
it("does not treat authentication or malformed responses as transport failures", () => {
  expect(canFallback(new ApiError("auth", 401, "http"))).toBe(false);
  expect(canFallback(new ApiError("bad", 200, "format"))).toBe(false);
  expect(canFallback(new ApiError("tls", 0, "tls"))).toBe(true);
  expect(canFallback(new ApiError("offline", 503, "http"))).toBe(true);
});
it.each([
  "delete",
  "disable",
  "address",
  "priority",
  "tls",
  "recreate",
] as const)(
  "discards a late failure after route %s without overwriting current configuration",
  async (change) => {
    add("backup");
    setRouteMode(account, "auto");
    const route = readRoutes(account).find((r) => r.name === "backup")!;
    let fail!: (error: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      ),
    );
    const operation = findFallback(account, new AbortController().signal);
    if (change === "delete" || change === "address" || change === "recreate")
      deleteRoute(account, route.url);
    if (change !== "delete")
      saveRoute(account, {
        ...route,
        ...(change === "disable" ? { enabled: false } : {}),
        ...(change === "address"
          ? { url: "https://new.example.test/emby" }
          : {}),
        ...(change === "priority" ? { priority: 0 } : {}),
        ...(change === "tls" ? { ignoreCertificateErrors: true } : {}),
      });
    const latest = localStorage.getItem(
      "miry-routes:" + account.server + "|" + account.userId,
    );
    fail(Error("synthetic offline"));
    await operation;
    expect(
      localStorage.getItem(
        "miry-routes:" + account.server + "|" + account.userId,
      ),
    ).toBe(latest);
  },
);
it("discards an old owner's failure", async () => {
  add("backup");
  setRouteMode(account, "auto");
  let current = true,
    fail!: (error: Error) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    ),
  );
  const operation = findFallback(
    account,
    new AbortController().signal,
    () => current,
  );
  const latest = localStorage.getItem(
    "miry-routes:" + account.server + "|" + account.userId,
  );
  current = false;
  fail(Error("synthetic offline"));
  await operation;
  expect(
    localStorage.getItem(
      "miry-routes:" + account.server + "|" + account.userId,
    ),
  ).toBe(latest);
});
