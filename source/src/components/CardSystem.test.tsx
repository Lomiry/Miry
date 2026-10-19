// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import PosterCard from "./PosterCard";
import ContinueWatchingCard from "./ContinueWatchingCard";
import EpisodeCard from "./EpisodeCard";
import { EmbyClient } from "../api/client";
import { artworkCandidates } from "../api/artwork";
import type { Item } from "../types/emby";
const api = new EmbyClient({
  server: "https://example.test/emby",
  userId: "u",
  token: "t",
  name: "QA",
  deviceId: "d",
});
const item = {
  Id: "a",
  Name: "一个很长的中英文标题 A Long Film Title",
  Type: "Movie",
  ImageTags: { Primary: "p" },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each(["Movie", "Series", "Episode", "Season", "BoxSet", "Playlist"])(
  "uses a portrait poster for %s even with landscape metadata",
  (Type) => {
    const view = render(
      <PosterCard
        item={{ ...item, Type }}
        api={api}
        landscape
        onDetail={vi.fn()}
        onPlay={vi.fn()}
      />,
    );
    expect(
      view.container
        .querySelector(".poster")
        ?.classList.contains("poster-landscape"),
    ).toBe(false);
    expect(
      view.container
        .querySelector(".card-caption strong")
        ?.getAttribute("title"),
    ).toBe(item.Name);
  },
);
it("anchors playback, favorites and later inside the poster and keeps metadata separate", () => {
  const view = render(
    <PosterCard
      item={item}
      api={api}
      onDetail={vi.fn()}
      onPlay={vi.fn()}
      onUserData={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  const poster = view.container.querySelector(".poster");
  expect(
    screen
      .getByRole("button", { name: "快速播放 " + item.Name })
      .closest(".poster"),
  ).toBe(poster);
  expect(
    screen
      .getByRole("button", { name: "收藏 " + item.Name })
      .closest(".poster"),
  ).toBe(poster);
  expect(
    view.container.querySelector(".card-caption")?.closest(".poster"),
  ).toBeNull();
  expect(view.container.querySelector("button button")).toBeNull();
});
it("uses an explicit still-image variant for continue watching", () => {
  const view = render(
    <ContinueWatchingCard item={item} api={api} onDetail={vi.fn()} />,
  );
  expect(view.container.querySelector(".poster-landscape")).toBeTruthy();
});
it.each(["Movie", "Series", "BoxSet", "Playlist"])(
  "uses available list year, genres and rating without metadata requests for %s",
  (Type) => {
    const request = vi.spyOn(api, "request");
    const view = render(
      <PosterCard
        item={{
          ...item,
          Type,
          ProductionYear: 1983,
          CommunityRating: 7.4,
          Genres: ["动作", "冒险", "剧情"],
        }}
        api={api}
        onDetail={vi.fn()}
      />,
    );
    expect(
      view.container.querySelector(".card-caption small")?.textContent,
    ).toBe("1983 · 动作 / 冒险 · 7.4");
    expect(request).not.toHaveBeenCalled();
  },
);
it.each([
  {
    Genres: [],
    ProductionYear: 1983,
    CommunityRating: 7.4,
    expected: "1983 · 7.4",
  },
  {
    Genres: [" ", "动作", " 动作 ", "冒险", "剧情"],
    ProductionYear: 1983,
    CommunityRating: 7.4,
    expected: "1983 · 动作 / 冒险 · 7.4",
  },
  {
    Genres: ["动作"],
    ProductionYear: undefined,
    CommunityRating: undefined,
    expected: "动作",
  },
  {
    Genres: ["动作"],
    ProductionYear: 1983,
    CommunityRating: undefined,
    expected: "1983 · 动作",
  },
  {
    Genres: ["动作"],
    ProductionYear: undefined,
    CommunityRating: 7.4,
    expected: "动作 · 7.4",
  },
  {
    Genres: ["", " "],
    ProductionYear: undefined,
    CommunityRating: undefined,
    expected: null,
  },
])(
  "keeps genre metadata bounded without empty separators: $expected",
  ({ Genres, ProductionYear, CommunityRating, expected }) => {
    const view = render(
      <PosterCard
        item={{ ...item, Genres, ProductionYear, CommunityRating }}
        api={null}
        onDetail={vi.fn()}
      />,
    );
    const metadata = view.container.querySelector(".poster-metadata");
    if (expected === null) expect(metadata).toBeNull();
    else expect(metadata?.textContent).toBe(expected);
  },
);
it.each([
  [1983, undefined, "1983"],
  [undefined, 7.4, "7.4"],
  [1983, 0, "1983"],
  [0, 7.4, "7.4"],
  [undefined, undefined, null],
  [0, 0, null],
  [-1, -1, null],
  [NaN, NaN, null],
  [Infinity, Infinity, null],
  [undefined, 0.01, null],
])(
  "omits missing or invalid poster metadata (%s, %s)",
  (ProductionYear, CommunityRating, expected) => {
    const view = render(
      <PosterCard
        item={{ ...item, ProductionYear, CommunityRating }}
        api={null}
        onDetail={vi.fn()}
      />,
    );
    const meta = view.container.querySelector(".card-caption small");
    if (expected === null) expect(meta).toBeNull();
    else expect(meta?.textContent).toBe(expected);
  },
);
it("retains dedicated episode and continue-watching captions", () => {
  const episode = {
    ...item,
    Type: "Episode",
    IndexNumber: 3,
    ProductionYear: 1983,
    CommunityRating: 7.4,
  };
  const view = render(
    <>
      <EpisodeCard item={episode} />
      <ContinueWatchingCard item={episode} api={null} onDetail={vi.fn()} />
    </>,
  );
  const captions = view.container.querySelectorAll(".card-caption small");
  expect(captions).toHaveLength(2);
  for (const caption of captions)
    expect(caption.textContent).toContain("第 3 集");
});
it("keeps fallback buttons usable after all poster sources fail", () => {
  const detail = vi.fn(),
    view = render(
      <PosterCard item={item} api={api} onDetail={detail} onPlay={vi.fn()} />,
    );
  expect(view.container.querySelector(".art-skeleton")).toBeTruthy();
  fireEvent.error(screen.getByRole("img"));
  expect(
    screen.getByRole("img", { name: item.Name + " · 默认封面" }),
  ).toBeTruthy();
  expect(view.container.querySelector(".art-skeleton")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "查看详情 " + item.Name }),
  );
  expect(detail).toHaveBeenCalledWith(item);
});
it("creates up to four collection cells and reuses the same query while rerendering", async () => {
  const request = vi.spyOn(api, "items").mockResolvedValue({
    Items: Array.from({ length: 6 }, (_, i) => ({ ...item, Id: String(i) })),
    TotalRecordCount: 6,
  });
  const collection = { Id: "box", Name: "经典电影", Type: "BoxSet" };
  const view = render(
    <PosterCard item={collection} api={api} onDetail={vi.fn()} />,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll(".mosaic-cell")).toHaveLength(4),
  );
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({ ParentId: "box", Limit: 4, Recursive: false }),
    expect.any(AbortSignal),
  );
  view.rerender(
    <PosterCard
      item={{ ...collection, Name: "经典作品" }}
      api={api}
      onDetail={vi.fn()}
    />,
  );
  expect(request).toHaveBeenCalledOnce();
});
it("falls back gracefully when a collection is empty or unavailable", async () => {
  vi.spyOn(api, "items").mockRejectedValue(new Error("offline"));
  render(
    <PosterCard
      item={{ Id: "empty", Name: "空合集", Type: "BoxSet" }}
      api={api}
      onDetail={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole("img", { name: "空合集 · 默认封面" }),
  ).toBeTruthy();
});
it("uses primary, series and parent posters without promoting thumbnails into grid choices", () => {
  const value: Item = {
    ...item,
    Type: "Episode",
    SeriesId: "series",
    SeriesPrimaryImageTag: "sp",
    ParentId: "parent",
    ParentPrimaryImageTag: "pp",
    ImageTags: { Primary: "p", Thumb: "t" },
  };
  expect(artworkCandidates(value, "poster").map((c) => c[1])).toEqual([
    "Primary",
    "Primary",
    "Primary",
  ]);
  expect(artworkCandidates(value, "episode")[0]).toEqual(["a", "Thumb", "t"]);
  expect(artworkCandidates(value, "backdrop").at(-1)).toEqual([
    "parent",
    "Primary",
    "pp",
  ]);
});
