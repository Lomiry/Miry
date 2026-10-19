import { expect, it, vi } from "vitest";
import { DandanplayProvider } from "./dandanplay";
import { requestScope, readProviderCounters } from "./requestDiagnostics";
import { SharedRequests } from "./sharedRequests";
vi.mock("./searchDiagnostics", async (original) => ({
  ...(await original<typeof import("./searchDiagnostics")>()),
  developmentDiagnostic: vi.fn(),
}));
const signal = () => new AbortController().signal;
const empty = { success: true, animes: [] };
const movie = {
  success: true,
  animes: [
    {
      animeId: "1",
      animeTitle: "Movie",
      type: "movie",
      startDate: "2021-01-01",
      episodes: [{ episodeId: "1", episodeTitle: "Movie" }],
    },
  ],
};
const comments = { comments: [{ p: "0,1,16777215,0", m: "comment" }] };
const context = {
  title: "Movie",
  original: "Original",
  year: 2021,
  movie: true,
  tmdb: 123,
};
it("TMDb success uses exactly one search and one comments request; caches do not request again", async () => {
  const scope = requestScope("budget-movie", "one");
  const request = vi.fn(async (q: { kind: string }) =>
    q.kind === "comments" ? comments : movie,
  );
  const p = new DandanplayProvider(request);
  const result = await p.match(context, signal(), scope);
  expect(result.selected?.recommended).toBe(true);
  await p.getComments("1", signal(), false, scope);
  await p.match({ ...context }, signal(), scope);
  await p.getComments("1", signal(), false, scope);
  expect(request).toHaveBeenCalledTimes(2);
  expect(scope.counters).toMatchObject({
    providerSearchRequests: 1,
    providerCommentRequests: 1,
    providerFallbackRequests: 0,
    providerCacheHits: 2,
  });
  await p.getComments("1", signal(), true, scope);
  expect(scope.counters.providerCommentRequests).toBe(2);
});
it("reliable Name stops OriginalTitle and equivalent names are never queried twice", async () => {
  const request = vi.fn(async () => movie);
  const p = new DandanplayProvider(request);
  await p.match({ ...context, tmdb: undefined }, signal());
  expect(request).toHaveBeenCalledTimes(1);
  const zero = vi.fn(async () => empty);
  await new DandanplayProvider(zero).match(
    { title: "Movie!", original: "ｍｏｖｉｅ", movie: true },
    signal(),
  );
  expect(zero).toHaveBeenCalledTimes(1);
});
it("automatic worst-case budget is three episode searches and two optional movie year lookups", async () => {
  const scope = requestScope("worst-auto", "one");
  const request = vi.fn(async (q: { kind: string; tmdbId?: number }) =>
    q.tmdbId || q.kind === "anime"
      ? empty
      : {
          ...movie,
          animes: movie.animes.map((m) => ({
            ...m,
            animeTitle: "Unrelated",
            startDate: undefined,
          })),
        },
  );
  await new DandanplayProvider(request).match(context, signal(), scope);
  expect(request.mock.calls.map(([q]) => q.kind)).toEqual([
    "search",
    "search",
    "anime",
    "search",
    "anime",
  ]);
  expect(scope.counters).toMatchObject({
    providerSearchRequests: 5,
    providerFallbackRequests: 4,
  });
});
it("manual raw-first variants are serial and bounded by three searches plus three year lookups", async () => {
  const scope = requestScope("worst-manual", "one");
  const request = vi.fn(async (q: { kind: string }) =>
    q.kind === "anime"
      ? empty
      : {
          ...movie,
          animes: movie.animes.map((m) => ({
            ...m,
            animeTitle: "Unrelated",
            startDate: undefined,
          })),
        },
  );
  await new DandanplayProvider(request).search(
    "Movie 2021",
    signal(),
    context,
    scope,
  );
  expect(request).toHaveBeenCalledTimes(6);
  expect(scope.counters).toMatchObject({
    providerSearchRequests: 6,
    providerFallbackRequests: 4,
  });
});
it("concurrent duplicate pipelines share transport and comments; one caller cancellation preserves the other", async () => {
  const scope = requestScope("concurrent", "one");
  let resolve!: (value: unknown) => void;
  let wireSignal!: AbortSignal;
  const request = vi.fn((_q: unknown, s: AbortSignal) => {
    wireSignal = s;
    return new Promise<unknown>((r) => {
      resolve = r;
    });
  });
  const p = new DandanplayProvider(request);
  const first = new AbortController();
  const a = p.match(context, first.signal, scope);
  const b = p.match(context, signal(), scope);
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const cancelled = expect(a).rejects.toMatchObject({ name: "AbortError" });
  first.abort();
  await cancelled;
  expect(wireSignal.aborted).toBe(false);
  resolve(movie);
  expect((await b).selected?.id).toBe("1");
  request.mockImplementation(async () => comments);
  await Promise.all([
    p.getComments("1", signal(), false, scope),
    p.getComments("1", signal(), false, scope),
  ]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(scope.counters.providerCoalescedRequests).toBe(2);
});
it("cancels an abandoned transport and does not cache its late result", async () => {
  const scope = requestScope("cancelled", "one");
  let resolve!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise<unknown>((r) => {
        resolve = r;
      }),
  );
  const p = new DandanplayProvider(request);
  const c = new AbortController();
  const pending = p.search("Movie", c.signal, context, scope);
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const cancelled = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  c.abort();
  await cancelled;
  resolve(movie);
  await Promise.resolve();
  request.mockImplementation(async () => movie);
  await p.search("Movie", signal(), context, scope);
  expect(request).toHaveBeenCalledTimes(2);
  expect(scope.counters.providerCancelledRequests).toBe(1);
});
it("synchronous cleanup before dispatch sends no transport request", async () => {
  const flights = new SharedRequests();
  const request = vi.fn(async () => movie);
  const c = new AbortController();
  const a = flights.run("same", c.signal, request);
  const cancelled = expect(a).rejects.toMatchObject({ name: "AbortError" });
  c.abort();
  await cancelled;
  expect(request).not.toHaveBeenCalled();
  await flights.run("same", signal(), request);
  expect(request).toHaveBeenCalledTimes(1);
});
it("cache keys isolate Server/User/item/fingerprint and session counters export no identity", async () => {
  const scope = requestScope(
    "private-server/user/item/fingerprint",
    "private-session",
  );
  const other = requestScope(
    "other-server/user/item/fingerprint",
    "private-session",
  );
  const request = vi.fn(async (q: { kind: string }) =>
    q.kind === "comments" ? comments : movie,
  );
  const p = new DandanplayProvider(request);
  await p.match(context, signal(), scope);
  await p.getComments("1", signal(), false, scope);
  await p.match(context, signal(), other);
  await p.getComments("1", signal(), false, other);
  expect(request).toHaveBeenCalledTimes(4);
  const next = requestScope(scope.cacheScope, "next-session");
  await p.match(context, signal(), next);
  expect(next.counters.providerCacheHits).toBe(1);
  expect(next.counters.providerSearchRequests).toBe(0);
  expect(JSON.stringify(readProviderCounters())).not.toMatch(
    /private|server|user|fingerprint/,
  );
  for (let n = 0; n < 30; n++) requestScope("bounded" + n, "one");
  expect(readProviderCounters()).toHaveLength(24);
});
it("429 cuts off all subsequent transport calls while zero results never throttle", async () => {
  const scope = requestScope("limited", "one");
  const request = vi.fn(async () => ({ success: false, errorCode: 429 }));
  const p = new DandanplayProvider(request);
  await expect(
    p.search("Movie", signal(), context, scope),
  ).rejects.toMatchObject({ code: 429 });
  await expect(p.match(context, signal(), scope)).rejects.toMatchObject({
    status: 429,
  });
  await expect(p.getComments("1", signal(), true, scope)).rejects.toMatchObject(
    { status: 429 },
  );
  p.clear();
  await expect(
    p.search("After configuration cleanup", signal()),
  ).rejects.toMatchObject({
    status: 429,
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(scope.counters).toMatchObject({
    providerSearchRequests: 1,
    providerCommentRequests: 0,
    provider429Responses: 1,
  });
  const zero = vi.fn(async () => empty);
  const normal = new DandanplayProvider(zero);
  await normal.search("Missing", signal());
  await normal.search("Another", signal());
  expect(zero).toHaveBeenCalledTimes(2);
});
it("native throttle guard is not counted as another HTTP 429 response", async () => {
  const scope = requestScope("native-blocked", "one");
  const request = vi.fn(async () => {
    throw { kind: "rate-limited", status: 429 };
  });
  const p = new DandanplayProvider(request);
  await expect(
    p.search("Movie", signal(), context, scope),
  ).rejects.toMatchObject({ kind: "rate-limited" });
  expect(scope.counters).toMatchObject({
    providerSearchRequests: 0,
    provider429Responses: 0,
  });
  await expect(
    p.search("Another", signal(), undefined, scope),
  ).rejects.toMatchObject({ status: 429 });
  expect(request).toHaveBeenCalledTimes(1);
});
it("concurrent identical manual searches share one lookup; TTL expiry permits a fresh fetch", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const scope = requestScope("ttl-and-manual", "one");
    const request = vi.fn(async (q: { kind: string }) =>
      q.kind === "comments" ? comments : movie,
    );
    const p = new DandanplayProvider(request);
    await Promise.all([
      p.search("Movie", signal(), context, scope),
      p.search("Movie", signal(), context, scope),
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    await p.search("Movie", signal(), context, scope);
    await p.getComments("1", signal(), false, scope);
    await p.getComments("1", signal(), false, scope);
    expect(request).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000 + 1);
    await p.search("Movie", signal(), context, scope);
    await p.getComments("1", signal(), false, scope);
    expect(request).toHaveBeenCalledTimes(4);
  } finally {
    vi.useRealTimers();
  }
});
