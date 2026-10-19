import { expect, it, vi } from "vitest";
import { DandanplayProvider } from "./dandanplay";
import { rank } from "./online";
vi.mock("./searchDiagnostics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./searchDiagnostics")>()),
  developmentDiagnostic: vi.fn(),
}));
const payload = {
  success: true,
  animes: [
    {
      animeId: "1",
      animeTitle: "Movie",
      type: "movie",
      startDate: "1983-10-01",
      episodes: [{ episodeId: "9007199254740993", episodeTitle: "Movie" }],
    },
  ],
};
const signal = () => new AbortController().signal;
it("official schema search/year enrichment, high confidence and session caches", async () => {
  const request = vi.fn(async (q: { kind: string }) =>
      q.kind === "anime"
        ? payload
        : {
            ...payload,
            animes: payload.animes.map((a) => ({ ...a, startDate: undefined })),
          },
    ),
    p = new DandanplayProvider(request);
  const result = await p.match(
    { title: "Movie", year: 1983, movie: true },
    signal(),
  );
  expect(result.selected?.id).toBe("9007199254740993");
  expect(request).toHaveBeenCalledTimes(2);
  await p.match({ title: "Movie", year: 1983, movie: true }, signal());
  await p.search("Movie 1983", signal());
  expect(request).toHaveBeenCalledTimes(4);
  await p.search("Movie 1983", signal());
  expect(request).toHaveBeenCalledTimes(4);
  expect(request.mock.calls.flat()).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ serverId: expect.anything() }),
    ]),
  );
});
it("prefers official TMDb mapping and sends no unrecognized provider ids", async () => {
  const request = vi.fn(async () => payload),
    p = new DandanplayProvider(request);
  expect(
    (await p.match({ title: "Localized", tmdb: 123, movie: true }, signal()))
      .selected,
  ).toBeDefined();
  expect(request).toHaveBeenCalledWith(
    { kind: "search", tmdbId: 123, movie: true, episode: undefined },
    expect.anything(),
  );
  expect(request).toHaveBeenCalledTimes(1);
});
it("stops after a reliable Name match instead of always querying OriginalTitle", async () => {
  const request = vi.fn(async (q: { kind: string; anime?: string }) => {
    const animeTitle = q.anime === "Localized" ? "Localized" : "Original";
    return {
      success: true,
      animes: [
        {
          animeId: q.anime === "Localized" ? "2" : "1",
          animeTitle,
          type: "movie",
          startDate: "2021-01-01",
          episodes: [
            {
              episodeId: q.anime === "Localized" ? "2" : "1",
              episodeTitle: "Movie",
            },
          ],
        },
      ],
    };
  });
  const p = new DandanplayProvider(request);
  const result = await p.match(
    { title: "Localized", original: "Original", year: 2021, movie: true },
    signal(),
  );
  expect(result.selected?.title).toBe("Localized");
  expect(result.candidates).toHaveLength(1);
  expect(request).toHaveBeenCalledTimes(1);
});
it("never requests an empty manual query", async () => {
  const request = vi.fn(async () => payload),
    p = new DandanplayProvider(request);
  expect(await p.search("  ", signal())).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});
it("manual series query carries title and episode and supports empty result", async () => {
  const request = vi.fn(async () => ({ success: true, animes: [] })),
    p = new DandanplayProvider(request);
  expect(await p.search("Anime S02E05", signal())).toEqual([]);
  expect(request).toHaveBeenNthCalledWith(
    1,
    { kind: "search", anime: "Anime S02E05", episode: undefined },
    expect.anything(),
  );
  expect(request).toHaveBeenCalledWith(
    { kind: "search", anime: "Anime", episode: "5" },
    expect.anything(),
  );
});
it("bounds TMDb → Name → OriginalTitle fallback, merges IDs and stops once reliable", async () => {
  const request = vi.fn(async (q: { anime?: string; tmdbId?: number }) =>
    q.anime === "Original"
      ? {
          ...payload,
          animes: payload.animes.map((a) => ({ ...a, animeTitle: "Original" })),
        }
      : { success: true, animes: [] },
  );
  const p = new DandanplayProvider(request);
  const result = await p.match(
    { title: "Name", original: "Original", year: 1983, movie: true, tmdb: 123 },
    signal(),
  );
  expect(result.selected?.reason).toBe("原标题和年份一致");
  expect(request.mock.calls.map(([q]) => q.tmdbId || q.anime)).toEqual([
    123,
    "Name",
    "Original",
  ]);
});
it("raw manual query wins; normalization and original are only bounded fallbacks", async () => {
  const request = vi.fn(async (q: { anime?: string }) =>
      q.anime === "Movie" ? payload : { success: true, animes: [] },
    ),
    p = new DandanplayProvider(request);
  expect(
    await p.search(" Movie 1983 ", signal(), {
      title: "Movie",
      original: "Original",
      year: 1983,
      movie: true,
    }),
  ).toHaveLength(1);
  expect(request.mock.calls.map(([q]) => q.anime)).toEqual([
    "Movie 1983",
    "Movie",
  ]);
});
it.each([false, true])(
  "never replaces a different manual work with current-media fallback (%s)",
  async (hasCandidates) => {
    const request = vi.fn(async (q: { anime?: string }) =>
      q.anime === "Movie"
        ? payload
        : hasCandidates
          ? {
              ...payload,
              animes: payload.animes.map((a) => ({
                ...a,
                animeTitle: "Another work",
              })),
            }
          : { success: true, animes: [] },
    );
    const p = new DandanplayProvider(request);
    const context = {
      title: "Movie",
      original: "Original",
      year: 1983,
      movie: true,
    };
    const matches = await p.search("Another work", signal(), context);
    expect(request.mock.calls.map(([q]) => q.anime)).toEqual(["Another work"]);
    expect(matches).toHaveLength(hasCandidates ? 1 : 0);
    expect(rank(context, matches).selected).toBeUndefined();
  },
);
it("keeps current OriginalTitle fallback for an equivalent manual title", async () => {
  const request = vi.fn(async (q: { anime?: string }) =>
    q.anime === "Original" ? payload : { success: true, animes: [] },
  );
  const p = new DandanplayProvider(request);
  await p.search("Name!", signal(), {
    title: "Name",
    original: "Original",
    year: 1983,
    movie: true,
  });
  expect(request.mock.calls.map(([q]) => q.anime)).toEqual([
    "Name!",
    "Original",
  ]);
});
it("uses series TMDb numeric episode then Name/original; no year metadata request for episodes", async () => {
  const request = vi.fn(async () => ({ success: true, animes: [] })),
    p = new DandanplayProvider(request);
  await p.match(
    {
      title: "Anime",
      original: "Original",
      movie: false,
      tmdb: 12,
      season: 2,
      episode: 5,
    },
    signal(),
  );
  expect(request).toHaveBeenCalledTimes(3);
  expect(request).toHaveBeenNthCalledWith(
    1,
    { kind: "search", tmdbId: 12, movie: false, episode: "5" },
    expect.anything(),
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    { kind: "search", anime: "Anime", episode: "5" },
    expect.anything(),
  );
});
it("optional year lookup failure preserves candidates; cancellation never retries or poisons cache", async () => {
  const missing = {
    ...payload,
    animes: payload.animes.map((a) => ({ ...a, startDate: undefined })),
  };
  const request = vi.fn(async (q: { kind: string }) => {
    if (q.kind === "anime") throw { status: 500 };
    return missing;
  });
  const p = new DandanplayProvider(request);
  expect(await p.search("Movie", signal())).toHaveLength(1);
  const abort = new AbortController();
  abort.abort();
  await expect(p.search("Movie", abort.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(request).toHaveBeenCalledTimes(2);
});
it("dedupes fallback candidates and preserves trusted TMDb provenance", async () => {
  const request = vi.fn(async (q: { tmdbId?: number }) =>
      q.tmdbId
        ? {
            ...payload,
            animes: [
              ...payload.animes,
              {
                ...payload.animes[0],
                animeId: "2",
                episodes: [{ episodeId: "2", episodeTitle: "Movie" }],
              },
            ],
          }
        : payload,
    ),
    p = new DandanplayProvider(request);
  const result = await p.match(
    { title: "Movie", original: "Original", year: 1983, movie: true, tmdb: 12 },
    signal(),
  );
  expect(result.candidates).toHaveLength(2);
  expect(result.selected).toBeUndefined();
  expect(result.candidates.every((m) => m.tmdbMatched)).toBe(true);
});
it("diagnoses API zero, malformed projection, fallback success and evidence rejection without raw query/URL", async () => {
  const diagnostics = vi.fn(),
    request = vi.fn(async (q: { anime?: string }) =>
      q.anime === "Name"
        ? {
            success: true,
            animes: [{ animeId: "1", animeTitle: "Unknown", episodes: [] }],
          }
        : q.anime === "Original"
          ? payload
          : { success: true, animes: [] },
    ),
    p = new DandanplayProvider(request, diagnostics);
  await p.match(
    { title: "Name", original: "Original", year: 1983, movie: true, tmdb: 12 },
    signal(),
  );
  expect(diagnostics).toHaveBeenCalledWith(
    expect.objectContaining({ outcome: "api-zero" }),
  );
  expect(diagnostics).toHaveBeenCalledWith(
    expect.objectContaining({ outcome: "projection-empty" }),
  );
  expect(diagnostics).toHaveBeenCalledWith(
    expect.objectContaining({ outcome: "fallback-success" }),
  );
  expect(diagnostics).toHaveBeenCalledWith(
    expect.objectContaining({ outcome: "weak-evidence" }),
  );
  expect(JSON.stringify(diagnostics.mock.calls)).not.toMatch(
    /"Name"|"Original"|https?:|secret|token/,
  );
});
it("comments cached across seek/pause/replay; only explicit reload forces request", async () => {
  const request = vi.fn(async () => ({
      comments: [{ p: "0,1,0", m: "text" }],
    })),
    p = new DandanplayProvider(request);
  const first = await p.getComments("123", signal());
  expect(await p.getComments("123", signal())).toBe(first);
  expect(request).toHaveBeenCalledTimes(1);
  await p.getComments("123", signal(), true);
  expect(request).toHaveBeenCalledTimes(2);
});
it.each([401, 403, 500, "timeout"])(
  "isolates provider failure %s",
  async (status) => {
    const p = new DandanplayProvider(async () => {
      throw { status };
    });
    await expect(p.search("Movie", signal())).rejects.toEqual({ status });
  },
);
it("429 stops the session without retry storm", async () => {
  const request = vi.fn(async () => {
      throw { status: 429 };
    }),
    p = new DandanplayProvider(request);
  await expect(p.search("Movie", signal())).rejects.toEqual({ status: 429 });
  await expect(p.getComments("1", signal())).rejects.toEqual({ status: 429 });
  expect(request).toHaveBeenCalledTimes(1);
});
it("爱宠大机密2: HTTP 200 with API 429 is a rate limit, not a schema/network error", async () => {
  const request = vi.fn(async () => ({
    success: false,
    errorCode: 429,
    errorMessage: "private-error-body",
  }));
  const p = new DandanplayProvider(request);
  await expect(
    p.search("爱宠大机密2", signal(), { title: "爱宠大机密2", movie: true }),
  ).rejects.toMatchObject({ kind: "rate-limit", code: 429 });
  await expect(p.search("你的名字。", signal())).rejects.toMatchObject({
    status: 429,
  });
  await expect(p.getComments("1", signal(), true)).rejects.toMatchObject({
    status: 429,
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]).toEqual([
    { kind: "search", anime: "爱宠大机密2", episode: undefined },
    expect.anything(),
  ]);
});
it("zero matches and empty comments are not negative cached or provider-wide failures", async () => {
  const request = vi.fn(
    async (q: { kind: string }): Promise<unknown> =>
      q.kind === "comments" ? { comments: [] } : { success: true, animes: [] },
  );
  const p = new DandanplayProvider(request);
  expect(
    (await p.match({ title: "爱宠大机密2", movie: true }, signal())).candidates,
  ).toEqual([]);
  await p.search("爱宠大机密2", signal());
  await p.getComments("1", signal());
  await p.getComments("1", signal(), true);
  expect(request).toHaveBeenCalledTimes(4);
  request.mockResolvedValue(payload);
  expect(await p.search("Movie", signal())).toHaveLength(1);
});
it("HTTP-200 comments API errors and unusable comments are not cached as empty success", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ success: false, errorCode: 403 })
    .mockResolvedValueOnce({ comments: [{ p: "invalid", m: "bad" }] })
    .mockResolvedValue({ comments: [] });
  const p = new DandanplayProvider(request);
  await expect(p.getComments("1", signal())).rejects.toMatchObject({
    kind: "auth",
  });
  await expect(p.getComments("1", signal())).rejects.toThrow("format");
  expect((await p.getComments("1", signal())).entries).toEqual([]);
  expect(request).toHaveBeenCalledTimes(3);
});
it("rejects malformed response and ignores late aborted result without caching", async () => {
  const p = new DandanplayProvider(async () => ({
    success: true,
    animes: "broken",
  }));
  await expect(p.search("Movie", signal())).rejects.toThrow("format");
  const pending = new AbortController();
  let resolve!: (value: unknown) => void;
  const request = vi.fn(() => new Promise<unknown>((r) => (resolve = r))),
    slow = new DandanplayProvider(request),
    job = slow.search("Movie", pending.signal);
  const cancelled = expect(job).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  pending.abort();
  resolve(payload);
  await cancelled;
});
