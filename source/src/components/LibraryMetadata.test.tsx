// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { EmbyClient } from "../api/client";
import PosterCard from "./PosterCard";
import { readLater, toggleLater, refreshLater } from "../stores/watchLater";
import type { Item } from "../types/emby";
const account = {
  server: "https://metadata.test/emby",
  userId: "u",
  name: "QA",
  token: "secret",
  deviceId: "d",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("repairs legacy watch-later metadata with one bulk request and keeps membership edits", async () => {
  const api = new EmbyClient(account);
  toggleLater(account, {
    Id: "legacy",
    Name: "Saved",
    Type: "Movie",
    ProductionYear: 2024,
  });
  const fetch = vi.fn(async (_input: string | URL | Request) => {
    toggleLater(account, { Id: "new", Name: "New save", Type: "Movie" });
    return new Response(
      JSON.stringify({
        Items: [
          {
            Id: "legacy",
            Name: "Saved",
            Type: "Movie",
            ProductionYear: 2024,
            Genres: ["剧情"],
            CommunityRating: 8.5,
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  const list = await refreshLater(account, api);
  expect(list.map((i) => i.Id)).toEqual(["new", "legacy"]);
  expect(list[1].CommunityRating).toBe(8.5);
  expect(list[1].Genres).toEqual(["剧情"]);
  expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("Ids")).toBe(
    "legacy",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([
  [
    { ProductionYear: 2024, Genres: ["剧情", "犯罪"], CommunityRating: 8.5 },
    "2024 · 剧情 / 犯罪 · 8.5",
  ],
  [{ Genres: ["剧情", "犯罪"], CommunityRating: 8.5 }, "剧情 / 犯罪 · 8.5"],
  [{ ProductionYear: 2024, Genres: ["剧情"] }, "2024 · 剧情"],
  [{ ProductionYear: 2024, CommunityRating: 8.5 }, "2024 · 8.5"],
  [{ ProductionYear: 2024 }, "2024"],
  [{ CommunityRating: 8.5 }, "8.5"],
  [{}, null],
  [{ ProductionYear: 0, CommunityRating: 0, Genres: [] }, null],
] as const)(
  "carries requested list metadata through cache, persistence and shared card: %j",
  async (metadata, caption) => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const fields = new Set(
        new URL(String(input)).searchParams.get("Fields")!.split(","),
      );
      for (const field of ["ProductionYear", "CommunityRating", "Genres"])
        expect(fields.has(field)).toBe(true);
      const item: Item = { Id: "movie", Name: "Actual list", Type: "Movie" };
      for (const [key, value] of Object.entries(metadata))
        if (fields.has(key)) Object.assign(item, { [key]: value });
      return new Response(
        JSON.stringify({ Items: [item], TotalRecordCount: 1 }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const api = new EmbyClient(account);
    const query = {
      ParentId: "library",
      Fields: "MediaSources",
      IncludeItemTypes: "Movie,Series",
    };
    const first = await api.items(query);
    const cached = await api.items(query);
    expect(cached).toEqual(first);
    expect(api.cache.stats().hits).toBe(1);
    toggleLater(account, cached.Items[0]);
    const saved = readLater(account)[0];
    expect(saved).toMatchObject(metadata);
    const { container } = render(
      <PosterCard item={saved} api={api} onDetail={() => {}} />,
    );
    expect(
      container.querySelector(".poster-metadata")?.textContent ?? null,
    ).toBe(caption);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it.each(["search", "favorites", "collection", "similar", "playlist"])(
  "requests metadata in the shared %s list with one bulk call",
  async (kind) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"Items":[],"TotalRecordCount":0}'));
    vi.stubGlobal("fetch", fetch);
    const api = new EmbyClient(account);
    if (kind === "similar") await api.similar("movie");
    else if (kind === "playlist") await api.playlistItems("list", 0);
    else
      await api.items(
        kind === "search"
          ? { SearchTerm: "film" }
          : kind === "favorites"
            ? { Filters: "IsFavorite" }
            : { ParentId: "collection" },
      );
    const fields = new Set(
      new URL(String(fetch.mock.calls[0][0])).searchParams
        .get("Fields")!
        .split(","),
    );
    for (const field of ["ProductionYear", "CommunityRating", "Genres"])
      expect(fields.has(field)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
