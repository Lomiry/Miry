import { expect, it } from "vitest";
import {
  mediaContext,
  defaultQuery,
  normalizeTitle,
  rank,
  coordinates,
  BoundedCache,
  type DanmakuMatch,
} from "./online";
const movie = {
  title: "Movie 2: Dawn",
  original: "Original 2",
  year: 1983,
  movie: true,
};
const match = (patch: Partial<DanmakuMatch> = {}): DanmakuMatch => ({
  provider: "dandanplay",
  id: "1",
  animeId: "1",
  title: movie.title,
  episodeTitle: "Movie",
  movie: true,
  year: 1983,
  ...patch,
});
it("matches movie exact title/year and original title without discarding sequel digits", () => {
  expect(rank(movie, [match()]).selected?.id).toBe("1");
  expect(rank(movie, [match({ title: "Original 2" })]).selected?.id).toBe("1");
  expect(normalizeTitle(" ＭＯＶＩＥ ２：Dawn ")).toBe(
    normalizeTitle(movie.title),
  );
  expect(normalizeTitle("Movie 1: Dawn")).not.toBe(normalizeTitle(movie.title));
});
it("uses year to reject duplicate titles and never picks an ambiguous first result", () => {
  expect(
    rank(movie, [match({ id: "old", year: 1963 }), match()]).selected?.id,
  ).toBe("1");
  expect(rank(movie, [match(), match({ id: "2" })]).selected).toBeUndefined();
  expect(rank(movie, [match({ year: undefined })]).selected).toBeUndefined();
  expect(rank(movie, []).selected).toBeUndefined();
});
it.each([
  [1, 1, "Anime", "第1话"],
  [2, 5, "Anime Season 2", "EP05 · Start"],
])(
  "proves series/season/episode S%dE%d",
  (season, episode, title, episodeTitle) => {
    const c = { title: "Anime", movie: false, season, episode };
    const m = match({
      title,
      episodeTitle,
      movie: false,
      ...coordinates(title),
      episode: coordinates(episodeTitle).episode,
    });
    expect(rank(c, [m]).selected).toBeDefined();
    expect(rank({ ...c, episode: episode + 1 }, [m]).selected).toBeUndefined();
    expect(rank({ ...c, season: 3 }, [m]).selected).toBeUndefined();
  },
);
it("constructs metadata only; an episode TMDb id is never sent as series id", () => {
  const c = mediaContext({
    Id: "e",
    Name: "Episode title",
    OriginalTitle: "Episode original",
    Type: "Episode",
    SeriesName: "Anime",
    ParentIndexNumber: 2,
    IndexNumber: 5,
    ProviderIds: { Tmdb: "123" },
  });
  expect(c).toMatchObject({
    title: "Anime",
    season: 2,
    episode: 5,
    tmdb: undefined,
    original: undefined,
  });
  expect(defaultQuery(c)).toBe("Anime S02E05");
  expect(defaultQuery(movie)).toBe("Movie 2: Dawn");
});
it("bounds cache entries, bytes, LRU and expiry", () => {
  let now = 0;
  const c = new BoundedCache<number>(2, 10, 100, () => now);
  c.set("a", 1, 4);
  c.set("b", 2, 4);
  expect(c.get("a")).toBe(1);
  c.set("c", 3, 4);
  expect(c.get("b")).toBeUndefined();
  c.set("huge", 4, 11);
  expect(c.get("huge")).toBeUndefined();
  now = 101;
  expect(c.get("a")).toBeUndefined();
  c.clear();
  expect(c.get("c")).toBeUndefined();
});
it("ranks Dune 2021 above the 1984 film and Part Two without collapsing sequels", () => {
  const result = rank({ title: "Dune", year: 2021, movie: true }, [
    match({ id: "old", title: "Dune", year: 1984 }),
    match({ id: "sequel", title: "Dune: Part Two", year: 2024 }),
    match({ id: "correct", title: "Dune", year: 2021 }),
  ]);
  expect(result.selected?.id).toBe("correct");
  expect(result.candidates[0]).toMatchObject({
    recommended: true,
    reason: "标题和年份一致",
  });
  expect(
    rank({ title: "Dune", year: 2021, movie: true }, [
      match({ title: "Dune 2", year: 2021 }),
    ]).selected,
  ).toBeUndefined();
  expect(
    rank({ title: "Dune", year: 2021, movie: true }, [
      match({ title: "Dune: Part Two", year: 2021 }),
    ]).selected,
  ).toBeUndefined();
});
it("rejects equally strong title/original ambiguity, and keeps weak results selectable", () => {
  const context = { title: "沙丘", original: "Dune", year: 2021, movie: true };
  const result = rank(context, [
    match({ title: "沙丘", year: 2021 }),
    match({ id: "2", title: "Dune", year: 2021 }),
  ]);
  expect(result.selected).toBeUndefined();
  expect(result.candidates.every((m) => !m.recommended)).toBe(true);
  expect(
    rank(context, [match({ title: "Dune", year: 2021 })]).selected?.reason,
  ).toBe("原标题和年份一致");
  expect(
    rank(context, [
      match({ title: "Dune", year: 2021, tmdbMatched: true }),
      match({ id: "2", title: "沙丘", year: 2021 }),
    ]).selected?.reason,
  ).toBe("TMDb一致");
  expect(
    rank(context, [match({ title: "Dune", year: 1984, tmdbMatched: true })])
      .selected,
  ).toBeUndefined();
  const fuzzy = rank({ title: "Interstellar", year: 2014, movie: true }, [
    match({ title: "Interstellar Extended", year: 2014 }),
  ]);
  expect(fuzzy.candidates[0].score).toBe(65);
  expect(fuzzy.selected).toBeUndefined();
});
it("keeps movie extras selectable without confusing them with the feature", () => {
  const result = rank(movie, [
    match({ id: "extra", episodeTitle: "S1 Making of" }),
    match({ episodeTitle: "第1话 正片" }),
  ]);
  expect(result.selected?.id).toBe("1");
  expect(result.candidates).toHaveLength(2);
  expect(result.candidates[1]).toMatchObject({
    evidence: "weak",
    recommended: false,
    reason: "附加内容，请手动确认",
  });
});
it.each(["第5话", "第5話", "第5集"])(
  "does not mistake an episode number for a season: %s",
  (title) => {
    expect(coordinates(title)).toEqual({ season: undefined, episode: 5 });
  },
);
it("does not mistake a Chinese season number for an episode", () => {
  expect(coordinates("作品 第2季")).toEqual({ season: 2, episode: undefined });
});
it("parses Chinese season names and recommends exact S02E05, never vague titles", () => {
  const result = rank(
    { title: "间谍过家家", movie: false, season: 2, episode: 5 },
    [
      match({
        title: "间谍过家家 第二季",
        movie: false,
        ...coordinates("间谍过家家 第二季"),
        episode: 5,
      }),
    ],
  );
  expect(result.selected?.reason).toBe("剧名、S02E05一致");
  expect(coordinates("第十一季").season).toBe(11);
  expect(
    rank({ title: "间谍过家家", movie: false, season: 2, episode: 5 }, [
      match({ title: "间谍教室 第二季", movie: false, season: 2, episode: 5 }),
    ]).selected,
  ).toBeUndefined();
});
it("rejects wrong season/episode and S2 without season; resolves compact coordinates; ambiguous episodes stay manual", () => {
  const context = { title: "Anime", movie: false, season: 2, episode: 5 };
  const episode = match({
    title: "Anime Season 2",
    movie: false,
    season: 2,
    episode: 5,
  });
  expect(
    rank({ ...context, title: "Anime Season 2" }, [episode]).selected,
  ).toBeDefined();
  expect(coordinates("S02E05")).toEqual({ season: 2, episode: 5 });
  expect(
    rank(context, [episode, { ...episode, id: "2", episode: 6 }]).selected?.id,
  ).toBe("1");
  expect(rank(context, [{ ...episode, season: 1 }]).candidates[0].reason).toBe(
    "季数不同",
  );
  expect(
    rank(context, [{ ...episode, season: undefined, title: "Anime" }]).selected,
  ).toBeUndefined();
  expect(
    rank(context, [episode, { ...episode, id: "2" }]).selected,
  ).toBeUndefined();
});
