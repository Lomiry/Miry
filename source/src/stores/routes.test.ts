// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  verifyRoute,
  readRoutes,
  saveRoute,
  deleteRoute,
  activeRoutes,
  routeDisplayName,
  captureRoute,
  currentRoute,
  updateRouteFailure,
} from "./routes";
import { connectionId } from "./connections";
import { readHistory, recordHistory } from "./history";
import { setLanguage } from "../i18n/core";
const account = {
  server: "https://a.test/emby",
  serverId: "server-a",
  userId: "u",
  token: "secret",
  name: "A",
  deviceId: "d",
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  setLanguage("zh-CN", false);
});
it("translates generated route names after persistence while keeping explicit user labels intact", () => {
  const generated = readRoutes(account)[0];
  saveRoute(account, generated);
  saveRoute(account, {
    name: "默认线路",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: "u",
  });
  const saved = localStorage.getItem("miry-routes:" + connectionId(account));
  setLanguage("en-US");
  expect(
    routeDisplayName(
      readRoutes(account).find((r) => r.url === account.server)!,
      0,
    ),
  ).toBe("Default route");
  expect(
    routeDisplayName(
      readRoutes(account).find((r) => r.url === "https://b.test/emby")!,
      1,
    ),
  ).toBe("默认线路");
  expect(localStorage.getItem("miry-routes:" + connectionId(account))).toBe(
    saved,
  );
});
it("activates only distinct verified endpoints for the same server and account", () => {
  expect(activeRoutes(account)).toEqual([]);
  saveRoute(account, {
    name: "other",
    url: "https://b.test/emby",
    serverId: "other",
    userId: "u",
  });
  expect(activeRoutes(account)).toEqual([]);
  saveRoute(account, {
    name: "other",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: "different",
  });
  expect(activeRoutes(account)).toEqual([]);
  saveRoute(account, {
    name: "other",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: "u",
  });
  expect(activeRoutes(account)).toHaveLength(2);
  expect(activeRoutes({ ...account, userId: "different" })).toEqual([]);
});
it("rejects an authenticated user mismatch after matching server identity", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/Users/u")
              ? { Id: "wrong" }
              : { Id: "server-a", ServerName: "A", Version: "4.9" },
          ),
        ),
    ),
  );
  await expect(
    verifyRoute(account, "https://b.test", new AbortController().signal),
  ).rejects.toThrow("账号身份");
});
it("verifies public identity before sending the account token for authenticated user identity", async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("/Users/u")
            ? { Id: "u" }
            : { Id: "server-a", ServerName: "A", Version: "4.9" },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(
    await verifyRoute(account, "https://b.test", new AbortController().signal),
  ).toMatchObject({ url: "https://b.test", serverId: "server-a" });
  const options = (
    fetch.mock.calls as unknown as [string, RequestInit][]
  )[0][1];
  expect(options.headers).not.toHaveProperty("X-Emby-Token");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("rejects a route belonging to another server", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ Id: "other", ServerName: "Other", Version: "4.9" }),
        ),
    ),
  );
  await expect(
    verifyRoute(account, "https://b.test", new AbortController().signal),
  ).rejects.toThrow("其他服务器");
});
it("can verify a saved backup when the original route is unavailable", async () => {
  const older = { ...account, serverId: undefined };
  saveRoute(older, {
    name: "备用",
    url: "https://b.test/emby",
    serverId: "server-a",
  });
  const fetch = vi.fn(async (url: string) => {
    if (url.startsWith(account.server)) throw new Error("Offline");
    return new Response(
      JSON.stringify(
        url.endsWith("/Users/u")
          ? { Id: "u" }
          : { Id: "server-a", ServerName: "A", Version: "4.9" },
      ),
    );
  });
  vi.stubGlobal("fetch", fetch);
  await expect(
    verifyRoute(older, "https://b.test", new AbortController().signal),
  ).resolves.toMatchObject({ serverId: "server-a" });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("cancels route verification", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url, options: RequestInit) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    ),
  );
  const request = verifyRoute(account, "https://b.test", controller.signal);
  controller.abort();
  await expect(request).rejects.toHaveProperty("name", "AbortError");
});
it("reads legacy routes and preserves new configuration without persisting credentials", () => {
  saveRoute(account, {
    name: "old",
    url: "https://old.test/emby",
    serverId: "server-a",
    userId: "u",
  });
  expect(activeRoutes(account)).toHaveLength(2);
  saveRoute(account, {
    ...readRoutes(account)[1],
    enabled: false,
    priority: 2,
    ignoreCertificateErrors: true,
    token: "never-store",
  } as any);
  expect(activeRoutes(account)).toEqual([]);
  expect(JSON.stringify(readRoutes(account))).not.toContain("never-store");
  expect(readRoutes(account)[1]).toMatchObject({
    priority: 2,
    enabled: false,
    ignoreCertificateErrors: true,
  });
});
it("cannot activate pending or missing identities", () => {
  saveRoute(account, {
    name: "pending",
    url: "https://p.test/emby",
    serverId: "server-a",
    userId: "u",
    status: "pending",
  });
  expect(activeRoutes(account)).toEqual([]);
  expect(activeRoutes({ ...account, serverId: undefined })).toEqual([]);
});
it("normalizes before deduplication and refuses to demote an existing verified endpoint", () => {
  saveRoute(account, {
    name: "backup",
    url: "https://b.test",
    serverId: "server-a",
    userId: "u",
  });
  saveRoute(account, {
    name: "edited",
    url: "HTTPS://B.TEST:443/",
    serverId: "server-a",
    userId: "u",
  });
  expect(readRoutes(account)).toHaveLength(2);
  expect(() =>
    saveRoute(account, {
      name: "pending",
      url: "https://b.test",
      serverId: "",
      status: "pending",
    }),
  ).toThrow("此地址已存在");
});
it("keeps root and explicitly prefixed routes distinct without rewriting legacy entries", () => {
  for (const url of ["https://b.test", "https://b.test/emby"])
    saveRoute(account, {
      name: "backup",
      url,
      serverId: "server-a",
      userId: "u",
    });
  expect(readRoutes(account).map((r) => r.url)).toContain("https://b.test");
  expect(readRoutes(account).map((r) => r.url)).toContain(
    "https://b.test/emby",
  );
});
it("patches failure only once and rejects obsolete generations including delete/recreate", () => {
  const route = {
    name: "backup",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: "u",
  };
  saveRoute(account, route);
  const lease = captureRoute(account, route),
    before = readRoutes(account).find((r) => r.url === route.url)!;
  const writes = vi.spyOn(Storage.prototype, "setItem");
  expect(
    currentRoute({ ...account, serverId: "other" }, lease),
  ).toBeUndefined();
  expect(currentRoute({ ...account, userId: "other" }, lease)).toBeUndefined();
  updateRouteFailure(account, lease, "synthetic failure");
  updateRouteFailure(account, lease, "synthetic failure");
  expect(writes).toHaveBeenCalledTimes(1);
  expect(currentRoute(account, lease)).toMatchObject({
    ...before,
    failure: "synthetic failure",
  });
  deleteRoute(account, route.url);
  saveRoute(account, route);
  expect(currentRoute(account, lease)).toBeUndefined();
  writes.mockRestore();
});
it("keeps legacy entries readable and advances a generation only for a configuration change", () => {
  const route = {
    name: "legacy",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: "u",
    priority: 100,
  };
  localStorage.setItem(
    "miry-routes:" + connectionId(account),
    JSON.stringify([route]),
  );
  const lease = captureRoute(account, route);
  expect(currentRoute(account, lease)).toMatchObject(route);
  const before = localStorage.getItem("miry-routes:" + connectionId(account));
  saveRoute(account, route);
  expect(localStorage.getItem("miry-routes:" + connectionId(account))).toBe(
    before,
  );
  saveRoute(account, { ...route, priority: 1 });
  expect(currentRoute(account, lease)).toBeUndefined();
  expect(
    readRoutes(account).find((r) => r.url === route.url)?.revision,
  ).toBeTypeOf("string");
});
it("keeps identity and viewing history across routes and stores no credentials", () => {
  recordHistory(account, { Id: "m", Name: "Movie", Type: "Movie" }, 120);
  saveRoute(account, {
    name: "备用",
    url: "https://b.test/emby",
    serverId: "server-a",
  });
  const switched = {
    ...account,
    homeServer: account.server,
    server: "https://b.test/emby",
  };
  expect(connectionId(switched)).toBe(connectionId(account));
  expect(readHistory(switched)).toEqual(readHistory(account));
  expect(
    localStorage.getItem("miry-routes:" + connectionId(account)),
  ).not.toContain("secret");
  expect(readRoutes(switched)).toHaveLength(2);
  expect(() => deleteRoute(switched, switched.server)).toThrow();
  deleteRoute(account, switched.server);
  expect(readRoutes(account)).toHaveLength(1);
});
