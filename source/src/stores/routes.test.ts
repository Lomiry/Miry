// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  verifyRoute,
  readRoutes,
  saveRoute,
  deleteRoute,
  activeRoutes,
} from "./routes";
import { connectionId } from "./connections";
import { readHistory, recordHistory } from "./history";
const account = {
  server: "https://a.test/emby",
  serverId: "server-a",
  userId: "u",
  token: "secret",
  name: "A",
  deviceId: "d",
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
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
  ).toMatchObject({ url: "https://b.test/emby", serverId: "server-a" });
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
