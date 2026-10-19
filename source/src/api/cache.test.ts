// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { MetadataCache } from "./cache";
import { EmbyClient } from "./client";
const account = {
  server: "https://a.test/emby",
  userId: "u",
  name: "A",
  token: "secret",
  deviceId: "d",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("evicts least-used metadata, expires entries and enforces a byte budget", () => {
  vi.useFakeTimers();
  const cache = new MetadataCache(2, 120);
  cache.set("a", "A", 1000);
  cache.set("b", "B", 1000);
  cache.get("a");
  cache.set("c", "C", 1000);
  expect(cache.get("b")).toBeUndefined();
  expect(cache.get("a")).toBe("A");
  cache.set("big", "x".repeat(100), 1000);
  expect(cache.get("big")).toBeUndefined();
  vi.advanceTimersByTime(1001);
  expect(cache.get("a")).toBeUndefined();
  expect(cache.stats().bytes).toBeLessThanOrEqual(120);
});
it("avoids 99 of 100 repeated listing requests while keeping item/connection checks live", async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("System/Info/Public")
            ? { Id: "server", ServerName: "Test", Version: "4.9" }
            : { Items: [], TotalRecordCount: 0 },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const client = new EmbyClient(account);
  for (let i = 0; i < 100; i++)
    await client.items({ ParentId: "movies", StartIndex: 0 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(client.cache.stats().hits).toBe(99);
  await client.item("m");
  await client.item("m");
  await client.serverInfo();
  await client.serverInfo();
  expect(fetch).toHaveBeenCalledTimes(5);
  client.cache.clear();
  await client.items({ ParentId: "movies", StartIndex: 0 });
  expect(fetch).toHaveBeenCalledTimes(6);
});
it("separates accounts and invalidates metadata after user changes", async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("/FavoriteItems/")
            ? { IsFavorite: true }
            : { Items: [], TotalRecordCount: 0 },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const one = new EmbyClient(account),
    two = new EmbyClient({ ...account, userId: "other", token: "other" });
  await one.views();
  await two.views();
  await one.setFavorite("m", true);
  await one.views();
  expect(fetch).toHaveBeenCalledTimes(4);
});
it("ignores a response that completes after cache invalidation", async () => {
  let deliver!: () => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          deliver = () =>
            resolve(new Response('{"Items":[],"TotalRecordCount":0}'));
        }),
    ),
  );
  const client = new EmbyClient(account),
    request = client.views();
  client.cache.clear();
  deliver();
  await request;
  expect(client.cache.stats().entries).toBe(0);
});
