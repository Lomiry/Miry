import { afterEach, expect, it, vi } from "vitest";
import { EmbyClient } from "./client";
import { aggregateFavorites } from "./aggregate";
import { favoriteScope } from "./favorites";
import type { Account } from "../types/emby";
const account: Account = {
  server: "https://a.test/proxy/emby",
  serverId: "logical",
  userId: "u",
  token: "secret",
  name: "QA",
  deviceId: "d",
};
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const favorites = new Map<string, Set<string>>();
  const requests: URL[] = [];
  const fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push(url);
      const user = url.pathname.split("/Users/")[1]?.split("/")[0];
      const owner = `${url.hostname === "other.test" ? "other" : "logical"}|${user}`;
      const set = favorites.get(owner) || new Set<string>();
      favorites.set(owner, set);
      const record = (id: string) => ({
        Id: id,
        Name: id,
        Type:
          id === "series"
            ? "Series"
            : id === "season"
              ? "Season"
              : id === "episode"
                ? "Episode"
                : "Movie",
        ProductionYear: 2024,
        Genres: ["剧情"],
        CommunityRating: 8.5,
        UserData: { IsFavorite: set.has(id) },
      });
      if (url.pathname.includes("/FavoriteItems/")) {
        expect(init?.method).toBe("POST");
        const parts = url.pathname.split("/");
        const deleting = parts.at(-1) === "Delete";
        const id = parts.at(deleting ? -2 : -1)!;
        deleting ? set.delete(id) : set.add(id);
        return new Response(JSON.stringify({ IsFavorite: !deleting }));
      }
      const ids = [...set];
      const start = Number(url.searchParams.get("StartIndex") || 0);
      return new Response(
        JSON.stringify({
          Items: ids.slice(start, start + 30).map(record),
          TotalRecordCount: ids.length,
        }),
      );
    },
  );
  vi.stubGlobal("fetch", fetch);
  return { fetch, requests, favorites };
}
it.each(["movie", "series", "season", "episode"])(
  "writes and removes %s using server truth, invalidates stale empty cache, and preserves metadata",
  async (id) => {
    const f = fixture(),
      api = new EmbyClient(account);
    expect((await api.favorites()).Items).toEqual([]);
    await api.favorites();
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect((await api.setFavorite(id, true)).IsFavorite).toBe(true);
    const result = await api.favorites();
    expect(result.Items).toHaveLength(1);
    expect(result.Items[0]).toMatchObject({
      ProductionYear: 2024,
      Genres: ["剧情"],
      CommunityRating: 8.5,
      UserData: { IsFavorite: true },
    });
    expect((await api.setFavorite(id, false)).IsFavorite).toBe(false);
    expect((await api.favorites()).TotalRecordCount).toBe(0);
    expect(f.fetch).toHaveBeenCalledTimes(5);
    const list = f.requests.find((u) => u.pathname.endsWith("/Items"))!;
    expect(list.searchParams.get("IsFavorite")).toBe("true");
    expect(list.searchParams.has("ParentId")).toBe(false);
    expect(list.searchParams.get("IncludeItemTypes")).toContain("Series");
    expect(list.searchParams.get("IncludeItemTypes")).toContain("Movie");
    expect(list.pathname).toContain("/Users/u/Items");
    expect(list.searchParams.get("EnableUserData")).toBe("true");
  },
);
it("invalidates another endpoint client cache for the same logical server and user", async () => {
  const f = fixture(),
    a = new EmbyClient(account),
    b = new EmbyClient({ ...account, server: "https://b.test/proxy/emby" });
  await b.favorites();
  await a.setFavorite("movie", true);
  expect((await b.favorites()).Items[0].Id).toBe("movie");
  expect(favoriteScope(a.account)).toBe(favoriteScope(b.account));
  expect(f.fetch).toHaveBeenCalledTimes(3);
});
it("keeps same item IDs separate across users and servers and does not invalidate unrelated caches", async () => {
  const f = fixture(),
    a = new EmbyClient(account),
    u = new EmbyClient({ ...account, userId: "u2" }),
    s = new EmbyClient({
      ...account,
      server: "https://other.test/emby",
      serverId: "other",
    });
  await u.favorites();
  await s.favorites();
  await a.setFavorite("movie", true);
  expect((await u.favorites()).Items).toEqual([]);
  expect((await s.favorites()).Items).toEqual([]);
  expect(f.fetch).toHaveBeenCalledTimes(3);
  expect(favoriteScope(u.account)).not.toBe(favoriteScope(a.account));
});
it("aggregates each server with its own user, deduplicates alternate endpoints, and preserves pagination and colliding IDs", async () => {
  const f = fixture();
  f.favorites.set(
    "logical|u",
    new Set(Array.from({ length: 31 }, (_, i) => (i ? "m" + i : "movie"))),
  );
  f.favorites.set("other|u2", new Set(["movie"]));
  const connections = [
    account,
    { ...account, server: "https://b.test/emby" },
    {
      ...account,
      server: "https://other.test/emby",
      serverId: "other",
      userId: "u2",
    },
  ].map((account) => ({ account, remember: false }));
  const first = await aggregateFavorites(
    connections,
    0,
    new AbortController().signal,
  );
  expect(first).toHaveLength(2);
  expect(first.map((g) => g.items[0].Id)).toEqual(["movie", "movie"]);
  expect(first[0]).toMatchObject({ total: 31, hasMore: true });
  expect(first[1]).toMatchObject({ total: 1, hasMore: false });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  expect(f.requests[1].pathname).toContain("/Users/u2/Items");
  const next = await aggregateFavorites(
    connections,
    1,
    new AbortController().signal,
  );
  expect(next.map((g) => g.items.length)).toEqual([1, 0]);
  expect(f.requests[2].searchParams.get("StartIndex")).toBe("30");
});
it("keeps successful server results if another fails and propagates cancellation", async () => {
  const spy = vi
    .spyOn(EmbyClient.prototype, "favorites")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ Items: [], TotalRecordCount: 0 });
  const connections = [account, { ...account, serverId: "other" }].map(
    (account) => ({ account, remember: false }),
  );
  expect(
    (
      await aggregateFavorites(connections, 0, new AbortController().signal)
    ).map((g) => g.error),
  ).toEqual(["offline", ""]);
  const controller = new AbortController();
  controller.abort();
  spy.mockRejectedValue(new DOMException("Aborted", "AbortError"));
  await expect(
    aggregateFavorites(connections, 0, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  spy.mockRestore();
});
it("confirms incomplete mutation responses with a single user detail request, never fabricates a favorite flag", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ UserData: { IsFavorite: false } })),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await new EmbyClient(account).setFavorite("movie", true)).toEqual({
    IsFavorite: false,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toContain("/Users/u/Items/movie");
});
it("rejects an unconfirmed state and bounds client metadata cache", async () => {
  const fetch = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    new EmbyClient(account).setFavorite("movie", true),
  ).rejects.toThrow("未确认");
  const api = new EmbyClient(account);
  for (let i = 0; i < 80; i++) await api.items({ StartIndex: i });
  expect(api.cache.stats().entries).toBeLessThanOrEqual(64);
});
