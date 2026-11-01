import { expect, it, vi } from "vitest";
import { LogvarProvider } from "./logvar";
import { sourceDefaults } from "./sources";
const source = {
  ...sourceDefaults.sources[0],
  id: "custom",
  protocol: "logvar" as const,
  endpoint: "https://danmaku.example.com",
};
const signal = () => new AbortController().signal;
const value = {
  success: true,
  animes: [
    {
      animeId: 1,
      animeTitle: "Example S02",
      type: "tvseries",
      episodes: [{ episodeId: 2, episodeTitle: "第3集" }],
    },
  ],
};
it("adapts the published episodes envelope and reuses ranking and comment normalization", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(value)
    .mockResolvedValue({
      count: 3,
      comments: [
        { p: "2,1,16777215", m: "hello" },
        { p: "2,1,16777215", m: "hello" },
        { p: "3,5,255", m: "top" },
      ],
    });
  const p = new LogvarProvider(source, transport);
  const match = await p.match(
    { title: "Example", season: 2, episode: 3, movie: false },
    signal(),
  );
  expect(match.selected).toMatchObject({
    provider: "logvar",
    id: "2",
    season: 2,
    episode: 3,
  });
  const comments = await p.getComments("2", signal());
  expect(comments.entries.map((e) => e.text)).toEqual([
    "hello",
    "hello",
    "top",
  ]);
  expect(comments.entries[2]).toMatchObject({ mode: "top", color: "#0000ff" });
  expect(comments.entries[0]).not.toHaveProperty("source");
  expect(transport.mock.calls.map((c) => c[1])).toEqual([
    { kind: "search", title: "Example", episode: "3" },
    { kind: "comments", id: "2" },
  ]);
});
it("coalesces equal requests, caches results, isolates accounts and honors reload", async () => {
  const transport = vi.fn().mockResolvedValue(value);
  const p = new LogvarProvider(source, transport);
  await Promise.all([
    p.search("Example", signal()),
    p.search("Example", signal()),
  ]);
  await p.search("Example", signal());
  expect(transport).toHaveBeenCalledTimes(1);
  const scope = { cacheScope: "another-account", counters: {} as never };
  await p.search("Example", signal(), undefined, scope);
  expect(transport).toHaveBeenCalledTimes(2);
  transport.mockResolvedValue({ comments: [{ p: "1,1,255", m: "x" }] });
  await p.getComments("2", signal());
  await p.getComments("2", signal());
  expect(transport).toHaveBeenCalledTimes(3);
  await p.getComments("2", signal(), true);
  expect(transport).toHaveBeenCalledTimes(4);
});
it.each([
  { success: false, errorCode: 401 },
  { success: false, errorCode: 429 },
  { unexpected: [] },
  { comments: [{ p: "invalid", m: "x" }] },
])(
  "rejects error or malformed payload without accepting a false success",
  async (v) => {
    const p = new LogvarProvider(source, vi.fn().mockResolvedValue(v));
    await expect(p.getComments("1", signal())).rejects.toBeDefined();
  },
);
it("keeps a valid empty response distinct from invalid data", async () => {
  const p = new LogvarProvider(
    source,
    vi.fn().mockResolvedValue({ comments: [] }),
  );
  expect((await p.getComments("1", signal())).entries).toEqual([]);
});
it.each(["timeout", "network", "auth", "rate-limit"])(
  "propagates %s without retry",
  async (kind) => {
    const transport = vi.fn().mockRejectedValue({ kind });
    await expect(
      new LogvarProvider(source, transport).search("Example", signal()),
    ).rejects.toEqual({ kind });
    expect(transport).toHaveBeenCalledTimes(1);
  },
);
it("cancels one subscriber without cancelling another; never commits cancelled results", async () => {
  let resolve!: (v: unknown) => void;
  let nativeSignal!: AbortSignal;
  const transport = vi.fn((_source, _query, s) => {
    nativeSignal = s;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const p = new LogvarProvider(source, transport);
  const a = new AbortController(),
    b = new AbortController();
  const first = p.search("Example", a.signal);
  const second = p.search("Example", b.signal);
  await Promise.resolve();
  a.abort();
  await expect(first).rejects.toMatchObject({ name: "AbortError" });
  expect(nativeSignal.aborted).toBe(false);
  resolve(value);
  expect(await second).toHaveLength(1);
});
it("does not send URLs or filesystem paths as media titles", async () => {
  const transport = vi.fn();
  const p = new LogvarProvider(source, transport);
  expect(await p.search("https://private.invalid/video", signal())).toEqual([]);
  expect(await p.search("C:\\private\\movie.mkv", signal())).toEqual([]);
  expect(transport).not.toHaveBeenCalled();
});
it("uses explicit manual episode coordinates and does not filter unrelated searches by the playing episode", async () => {
  const transport = vi.fn().mockResolvedValue(value);
  const p = new LogvarProvider(source, transport);
  const context = { title: "Example", movie: false, season: 2, episode: 3 };
  await p.search("Other S05E09", signal(), context);
  await p.search("Unrelated", signal(), context);
  expect(transport.mock.calls[0][1]).toEqual({
    kind: "search",
    title: "Other",
    episode: "9",
  });
  expect(transport.mock.calls[1][1]).toEqual({
    kind: "search",
    title: "Unrelated",
  });
});
it("tries the original title once when needed and does not cache empty or malformed search data", async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce({ success: true, animes: [] })
    .mockResolvedValue(value);
  const p = new LogvarProvider(source, transport);
  expect(
    (
      await p.match(
        {
          title: "Alias",
          original: "Example",
          movie: false,
          season: 2,
          episode: 3,
        },
        signal(),
      )
    ).selected?.id,
  ).toBe("2");
  expect(transport).toHaveBeenCalledTimes(2);
  transport.mockResolvedValue({ success: true, animes: [] });
  await p.search("Nothing", signal());
  await p.search("Nothing", signal());
  expect(transport).toHaveBeenCalledTimes(4);
  transport.mockResolvedValue({
    success: true,
    animes: [{ animeTitle: "broken" }],
  });
  await expect(p.search("Broken", signal())).rejects.toThrow("format");
});
