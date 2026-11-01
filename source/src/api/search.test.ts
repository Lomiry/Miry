import { expect, it, vi } from "vitest";
import {
  candidateLimit,
  normalizeSearch,
  rankSearchCandidates,
  searchMedia,
  searchScore,
  searchVariants,
} from "./search";
import type { Item } from "../types/emby";
const movie = (Id: string, Name: string, OriginalTitle?: string): Item => ({
  Id,
  Name,
  OriginalTitle,
  Type: "Movie",
});
const signal = () => new AbortController().signal;
it("normalizes width, punctuation, case and Chinese/English spacing", () => {
  expect(normalizeSearch(" ＳＴＡＲ：　Ｗａｒｓ！ ")).toBe("star wars");
  expect(searchScore(movie("a", "星际·穿越"), "星际　穿越")).toBe(100);
  expect(searchScore(movie("a", "STAR-WARS"), "star wars")).toBe(100);
});
it("ranks exact names, original-title aliases, partial names then small typos and deduplicates", () => {
  const list = [
    movie("typo", "Dine"),
    movie("partial", "Dune Part Two"),
    movie("alias", "沙丘", "Dune"),
    movie("exact", "Dune"),
    movie("exact", "Dune"),
    movie("unrelated", "Other"),
  ];
  expect(rankSearchCandidates(list, "Dune").map((item) => item.Id)).toEqual([
    "exact",
    "alias",
    "partial",
    "typo",
  ]);
  expect(
    searchScore(movie("x", "Interstellar"), "Intersetllar"),
  ).toBeGreaterThan(0);
  expect(searchScore(movie("x", "沙丘"), "沙河")).toBe(0);
});
it("recalls previously absent typo candidates through bounded server queries and keeps primary order/count", async () => {
  const items = vi
    .fn()
    .mockResolvedValueOnce({
      Items: [movie("direct", "Server match")],
      TotalRecordCount: 1,
    })
    .mockResolvedValue({
      Items: [
        movie("a", "Interstellar"),
        movie("b", "Unrelated"),
        movie("direct", "Server match"),
      ],
      TotalRecordCount: 999999,
    });
  const result = await searchMedia(
    { items },
    {
      SearchTerm: "interstllar",
      StartIndex: 0,
      Limit: 30,
      Genres: "Drama",
      SortBy: "SortName",
    },
    signal(),
  );
  expect(result.Items.map((item) => item.Id)).toEqual(["direct"]);
  expect(result.TotalRecordCount).toBe(1);
  expect(result.suggestions.map((item) => item.Id)).toEqual(["a"]);
  expect(items).toHaveBeenCalledTimes(3);
  for (const [query] of items.mock.calls.slice(1))
    expect(query).toMatchObject({
      StartIndex: 0,
      Limit: candidateLimit,
      Genres: "Drama",
      Fields: "OriginalTitle",
    });
});
it("cannot invent matches when the server supplies insufficient candidates", async () => {
  const items = vi.fn().mockResolvedValue({ Items: [], TotalRecordCount: 0 });
  expect(
    (
      await searchMedia(
        { items },
        { SearchTerm: "interstllar", Limit: 30 },
        signal(),
      )
    ).suggestions,
  ).toEqual([]);
  expect(items).toHaveBeenCalledTimes(3);
  expect(searchVariants("a")).toEqual([]);
});
it.each([{ StartIndex: 30 }, { Limit: 1 }])(
  "does not run supplements for later/full pages %o",
  async (query) => {
    const items = vi.fn().mockResolvedValue({
      Items: [movie("a", "Result")],
      TotalRecordCount: 100,
    });
    await searchMedia(
      { items },
      { SearchTerm: "query", Limit: 30, ...query },
      signal(),
    );
    expect(items).toHaveBeenCalledTimes(1);
  },
);
it("does not supplement an exact match and preserves primary failures", async () => {
  const items = vi
    .fn()
    .mockResolvedValueOnce({
      Items: [movie("a", "沙丘", "Dune")],
      TotalRecordCount: 1,
    })
    .mockRejectedValue(new Error("offline"));
  expect(
    (await searchMedia({ items }, { SearchTerm: "Dune" }, signal()))
      .suggestions,
  ).toEqual([]);
  expect(items).toHaveBeenCalledTimes(1);
  await expect(
    searchMedia({ items }, { SearchTerm: "Dune" }, signal()),
  ).rejects.toThrow("offline");
});
it("preserves primary results on supplemental failure and rejects stale cancelled output", async () => {
  const items = vi
    .fn()
    .mockResolvedValueOnce({
      Items: [movie("a", "Direct")],
      TotalRecordCount: 1,
    })
    .mockRejectedValue(new Error("offline"));
  expect(
    (await searchMedia({ items }, { SearchTerm: "query" }, signal())).Items,
  ).toHaveLength(1);
  const controller = new AbortController();
  items.mockImplementation(async () => {
    controller.abort();
    return { Items: [], TotalRecordCount: 0 };
  });
  await expect(
    searchMedia({ items }, { SearchTerm: "query" }, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
it("cancels both in-flight variants without committing their output", async () => {
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  const items = vi
    .fn()
    .mockResolvedValueOnce({ Items: [], TotalRecordCount: 0 })
    .mockImplementation((_query, abortSignal: AbortSignal) => {
      signals.push(abortSignal);
      return new Promise((_resolve, reject) =>
        abortSignal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    });
  const request = searchMedia(
    { items },
    { SearchTerm: "interstllar" },
    controller.signal,
  );
  await vi.waitFor(() => expect(signals).toHaveLength(2));
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(signals.every((value) => value.aborted)).toBe(true);
});
it("bounds supplemental timeout and candidate processing for a huge server response", async () => {
  vi.useFakeTimers();
  try {
    const items = vi
      .fn()
      .mockResolvedValueOnce({ Items: [], TotalRecordCount: 0 })
      .mockImplementation(
        (_query, abortSignal: AbortSignal) =>
          new Promise((_resolve, reject) =>
            abortSignal.addEventListener("abort", () =>
              reject(new DOMException("timeout", "AbortError")),
            ),
          ),
      );
    const request = searchMedia({ items }, { SearchTerm: "query" }, signal());
    await vi.advanceTimersByTimeAsync(5000);
    expect((await request).suggestions).toEqual([]);
    const huge = Array.from({ length: 10000 }, (_, index) =>
      movie(String(index), index < 240 ? "Other" : "Dune"),
    );
    expect(rankSearchCandidates(huge, "Dune")).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});
