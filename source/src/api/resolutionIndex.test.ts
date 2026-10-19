// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { itemResolutions, ResolutionIndex } from "./resolutionIndex";
import { EmbyClient } from "./client";
import type { Item } from "../types/emby";
const account = {
  server: "https://a.test/emby",
  userId: "u",
  token: "t",
  name: "A",
  deviceId: "d",
};
const movie = (id: string, w = 3840, h = 1608): Item => ({
  Id: id,
  Name: "1080p filename",
  Type: "Movie",
  MediaSources: [
    {
      Id: "s",
      MediaStreams: [{ Type: "Video", Index: 0, Width: w, Height: h }],
    },
  ],
});
it.each([
  [3840, 2160, "4K"],
  [3840, 1608, "4K"],
  [4096, 2160, "4K"],
  [1920, 1080, "1080p"],
  [1920, 800, "1080p"],
  [1280, 720, "720p"],
  [720, 480, "SD"],
])("classifies %i x %i from dimensions", (w, h, result) =>
  expect([...itemResolutions(movie("m", w as number, h as number))]).toEqual([
    result,
  ]),
);
it("matches any playable version and never guesses missing dimensions", () => {
  const m = movie("m");
  m.MediaSources!.push(...movie("x", 1920, 800).MediaSources!);
  expect([...itemResolutions(m)]).toEqual(["4K", "1080p"]);
  expect(
    itemResolutions({ Id: "m", Name: "4K UHD REMUX", Type: "Movie" }).size,
  ).toBe(0);
});
it("indexes the complete list, returns exact filtered totals and caches across pages and resolutions", async () => {
  const api = new EmbyClient(account),
    index = new ResolutionIndex(),
    all = Array.from({ length: 65 }, (_, i) =>
      movie(String(i), i < 34 ? 3840 : 1920),
    );
  const request = vi.spyOn(api, "items").mockImplementation(async (q) =>
    q.Ids
      ? {
          Items: all.filter((i) => String(q.Ids).split(",").includes(i.Id)),
          TotalRecordCount: 30,
        }
      : { Items: all, TotalRecordCount: 65 },
  );
  const signal = new AbortController().signal;
  expect(
    await index.page(api, { IncludeItemTypes: "Movie" }, "4K", 0, signal),
  ).toMatchObject({ TotalRecordCount: 34, Items: expect.any(Array) });
  expect(
    (
      await index.page(api, { IncludeItemTypes: "Movie" }, "4K", 1, signal)
    ).Items.map((i) => i.Id),
  ).toEqual(["30", "31", "32", "33"]);
  await index.page(api, { IncludeItemTypes: "Movie" }, "1080p", 0, signal);
  expect(request.mock.calls.filter(([q]) => !q.Ids)).toHaveLength(1);
  expect(
    request.mock.calls.every(
      ([q]) => q.Fields === "MediaSources,MediaStreams,SeriesId" || !!q.Ids,
    ),
  ).toBe(true);
});
it("aggregates episode versions for a series without per-item requests", async () => {
  const api = new EmbyClient(account),
    series = { Id: "series", Name: "Series", Type: "Series" },
    episode = { ...movie("ep"), Type: "Episode", SeriesId: "series" };
  vi.spyOn(api, "items").mockImplementation(async (q) => ({
    Items: q.Ids
      ? [series]
      : q.IncludeItemTypes === "Episode"
        ? [episode]
        : [series],
    TotalRecordCount: 1,
  }));
  expect(
    await new ResolutionIndex().page(
      api,
      { IncludeItemTypes: "Series" },
      "4K",
      0,
      new AbortController().signal,
    ),
  ).toEqual({ Items: [series], TotalRecordCount: 1 });
});
it("cancels and never publishes a partial index", async () => {
  const api = new EmbyClient(account),
    controller = new AbortController();
  controller.abort();
  vi.spyOn(api, "items");
  await expect(
    new ResolutionIndex().page(api, {}, "4K", 0, controller.signal),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(api.items).not.toHaveBeenCalled();
});
it("rejects an incomplete scan instead of claiming a complete total", async () => {
  const api = new EmbyClient(account);
  vi.spyOn(api, "items").mockResolvedValue({
    Items: [],
    TotalRecordCount: 100,
  });
  await expect(
    new ResolutionIndex().page(api, {}, "4K", 0, new AbortController().signal),
  ).rejects.toThrow("分页不完整");
});
it("bounds cached scopes to three and invalidates on explicit cache refresh", async () => {
  const api = new EmbyClient(account),
    index = new ResolutionIndex(),
    request = vi.spyOn(api, "items").mockImplementation(async (q) => ({
      Items: q.Ids ? [movie("m")] : [movie("m")],
      TotalRecordCount: 1,
    }));
  for (let n = 0; n < 4; n++)
    await index.page(
      api,
      { ParentId: String(n) },
      "4K",
      0,
      new AbortController().signal,
    );
  const scans = () => request.mock.calls.filter(([q]) => !q.Ids).length;
  expect(scans()).toBe(4);
  await index.page(
    api,
    { ParentId: "0" },
    "4K",
    0,
    new AbortController().signal,
  );
  expect(scans()).toBe(5);
  api.cache.clear();
  await index.page(
    api,
    { ParentId: "0" },
    "4K",
    0,
    new AbortController().signal,
  );
  expect(scans()).toBe(6);
});
it("reuses the existing resolution index for a new size and isolates sort, server and user scopes", async () => {
  const index = new ResolutionIndex(),
    all = Array.from({ length: 65 }, (_, i) => movie(String(i)));
  const request = vi
    .spyOn(EmbyClient.prototype, "items")
    .mockImplementation(async (q) => ({
      Items: q.Ids
        ? all.filter((i) => String(q.Ids).split(",").includes(i.Id)).reverse()
        : all,
      TotalRecordCount: 65,
    }));
  const api = new EmbyClient(account),
    signal = new AbortController().signal;
  const query = {
    ParentId: "library",
    SortBy: "Runtime,SortName",
    SortOrder: "Descending",
    Limit: 20,
  };
  const first = await index.page(api, query, "4K", 0, signal, 20);
  const second = await index.page(
    api,
    { ...query, Limit: 50 },
    "4K",
    1,
    signal,
    50,
  );
  expect(first.Items.map((i) => i.Id)).toEqual(
    all.slice(0, 20).map((i) => i.Id),
  );
  expect(second.Items.map((i) => i.Id)).toEqual(all.slice(50).map((i) => i.Id));
  const scans = () => request.mock.calls.filter(([q]) => !q.Ids).length;
  expect(scans()).toBe(1);
  expect(request.mock.calls.at(-1)![0].Limit).toBe(50);
  await index.page(
    api,
    { ...query, SortOrder: "Ascending" },
    "4K",
    0,
    signal,
    20,
  );
  await index.page(
    new EmbyClient({ ...account, userId: "other" }),
    query,
    "4K",
    0,
    signal,
    20,
  );
  await index.page(
    new EmbyClient({ ...account, server: "https://other.test/emby" }),
    query,
    "4K",
    0,
    signal,
    20,
  );
  expect(scans()).toBe(4);
});
