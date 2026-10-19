import { describe, it, expect, vi, afterEach } from "vitest";
import { EmbyClient, normalizeServer, ApiError } from "./client";
const account = {
  server: "https://media.example.com/emby",
  userId: "user",
  token: "secret",
  name: "Test",
  deviceId: "device",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Server addresses", () => {
  it("preserves reverse proxy paths and does not duplicate the API prefix", () => {
    expect(normalizeServer(" https://media.example.com/proxy/emby/ ")).toBe(
      "https://media.example.com/proxy/emby",
    );
    expect(normalizeServer("http://localhost:8096")).toBe(
      "http://localhost:8096/emby",
    );
  });
  it("rejects credentials and non-HTTP protocols", () => {
    for (const url of [
      "file:///etc/passwd",
      "https://user:pass@host",
      "https://host/?api_key=x",
      "host",
    ])
      expect(() => normalizeServer(url)).toThrow(ApiError);
  });
});
describe("Emby transport", () => {
  it("rejects media downloads and playlist creation before any network request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = new EmbyClient(account);
    await expect(client.request("/Items/movie/Download")).rejects.toThrow(
      "禁止媒体下载",
    );
    await expect(
      client.request("/Playlists", {}, { Name: "片单" }),
    ).rejects.toThrow("禁止创建播放列表");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("allows reading existing server playlists", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"Items":[],"TotalRecordCount":0}'));
    vi.stubGlobal("fetch", fetch);
    await new EmbyClient(account).playlistItems("existing", 0);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
  });
  it("uses series artwork when an episode has no own poster", () => {
    const urls = new EmbyClient(account).images({
      Id: "ep",
      Name: "Episode",
      Type: "Episode",
      SeriesId: "series",
      SeriesPrimaryImageTag: "cover",
    });
    expect(new URL(urls[0]).pathname).toBe("/emby/Items/series/Images/Primary");
    expect(new URL(urls[0]).searchParams.get("tag")).toBe("cover");
  });
  it("prefers a poster for grid episodes and gives detail posters a larger image request", () => {
    const api = new EmbyClient(account),
      item = {
        Id: "ep",
        Name: "Episode",
        Type: "Episode",
        ImageTags: { Thumb: "thumb", Primary: "poster" },
      };
    expect(new URL(api.image(item)!).pathname).toBe(
      "/emby/Items/ep/Images/Primary",
    );
    expect(
      Number(
        new URL(
          api.image({ ...item, Type: "Movie" }, false, 600)!,
        ).searchParams.get("maxWidth"),
      ),
    ).toBeGreaterThanOrEqual(600);
  });
  it("authenticates with Pw and validates the returned session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ User: { Id: "u", Name: "Miry" }, AccessToken: "t" }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const client = new EmbyClient({ ...account, token: "" });
    const result = await client.login("name", "password");
    expect(result.token).toBe("t");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("/Users/AuthenticateByName");
    expect(JSON.parse(options.body)).toEqual({
      Username: "name",
      Pw: "password",
    });
    expect(options.headers["X-Emby-Token"]).toBeUndefined();
  });
  it("handles unauthorized responses without exposing response contents", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("sensitive data", { status: 401 })),
    );
    await expect(new EmbyClient(account).views()).rejects.toMatchObject({
      status: 401,
    });
  });
  it("keeps pagination and search values encoded", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"Items":[],"TotalRecordCount":0}'));
    vi.stubGlobal("fetch", fetch);
    await new EmbyClient(account).items({ SearchTerm: "a&b", StartIndex: 30 });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get("SearchTerm")).toBe("a&b");
    expect(url.searchParams.get("StartIndex")).toBe("30");
    expect(fetch.mock.calls[0][1].headers["X-Emby-Token"]).toBe("secret");
  });
  it.each([true, false])(
    "isolates search directions in cache and preserves responses when server honors sorting: %s",
    async (honorsSorting) => {
      const items = [
        { Id: "a", Name: "Sample A", Type: "Movie", CommunityRating: 8.4 },
        { Id: "b", Name: "Sample B", Type: "Movie", CommunityRating: 10 },
        { Id: "c", Name: "Sample C", Type: "Movie", CommunityRating: 6.2 },
      ];
      const fetch = vi.fn(async (address: string) => {
        const direction = new URL(address).searchParams.get("SortOrder");
        const ordered = honorsSorting
          ? [...items].sort(
              (a, b) =>
                (a.CommunityRating - b.CommunityRating) *
                (direction === "Descending" ? -1 : 1),
            )
          : items;
        return new Response(
          JSON.stringify({ Items: ordered, TotalRecordCount: 3 }),
        );
      });
      vi.stubGlobal("fetch", fetch);
      const client = new EmbyClient(account);
      const query = {
        SearchTerm: "Sample",
        SortBy: "CommunityRating,SortName",
        IncludeItemTypes: "Movie",
        Recursive: true,
        MinCommunityRating: 6,
        StartIndex: 0,
        Limit: 20,
      };
      const ascending = await client.items({
        ...query,
        SortOrder: "Ascending",
      });
      const descending = await client.items({
        ...query,
        SortOrder: "Descending",
      });
      const cachedAscending = await client.items({
        ...query,
        SortOrder: "Ascending",
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      const requests = fetch.mock.calls.map(([address]) => new URL(address));
      for (const request of requests) {
        expect(Object.fromEntries(request.searchParams)).toMatchObject({
          SearchTerm: "Sample",
          SortBy: "CommunityRating,SortName",
          IncludeItemTypes: "Movie",
          Recursive: "true",
          MinCommunityRating: "6",
          StartIndex: "0",
          Limit: "20",
        });
      }
      expect(requests.map((url) => url.searchParams.get("SortOrder"))).toEqual([
        "Ascending",
        "Descending",
      ]);
      expect(ascending.Items.map((item) => item.CommunityRating)).toEqual(
        honorsSorting ? [6.2, 8.4, 10] : [8.4, 10, 6.2],
      );
      expect(descending.Items.map((item) => item.CommunityRating)).toEqual(
        honorsSorting ? [10, 8.4, 6.2] : [8.4, 10, 6.2],
      );
      expect(cachedAscending).toBe(ascending);
      expect(client.cache.stats()).toMatchObject({ entries: 2, hits: 1 });
    },
  );
  it("aborts stalled requests at 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const result = new EmbyClient(account).views();
    const assertion = expect(result).rejects.toThrow("15 秒");
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
  it("supports immediate caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        expect(options.signal.aborted).toBe(true);
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      }),
    );
    await expect(
      new EmbyClient(account).views(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
