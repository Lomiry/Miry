import { pickSelect } from "./testSelect";
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount } from "./stores/account";
import type { Item } from "./types/emby";
import { readAccount } from "./stores/account";
import { readSortPreference } from "./stores/browsePreferences";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
const movies: Item[] = Array.from({ length: 65 }, (_, i) => ({
  Id: `movie-${i + 1}`,
  Name: `测试电影 ${String(i + 1).padStart(2, "0")}`,
  Type: "Movie",
  Genres: ["剧情"],
}));
const series: Item = { Id: "show", Name: "测试剧集", Type: "Series" };
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  saveAccount(
    {
      server: "https://media.example.com/emby",
      userId: "u",
      name: "Tester",
      token: "test-token",
      deviceId: "test-device",
    },
    false,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("persists sort and direction through home, another library, sidebar snapshots, detail and remount", async () => {
  const calls = server(),
    user = userEvent.setup();
  const view = render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await pickSelect(user, screen.getByLabelText("媒体排序"), "DateCreated");
  await user.click(screen.getByRole("button", { name: "降序，切换为升序" }));
  await user.click(screen.getByRole("button", { name: "首页" }));
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 剧集档案" }),
  );
  await waitFor(() =>
    expect(
      calls
        .filter((q) => q.searchParams.get("ParentId") === "series")
        .at(-1)
        ?.searchParams.get("SortOrder"),
    ).toBe("Ascending"),
  );
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "DateCreated",
  );
  await pickSelect(user, screen.getByLabelText("媒体排序"), "CommunityRating");
  await user.click(screen.getByRole("button", { name: "电影档案" }));
  await screen.findAllByText("1–30 / 65");
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "CommunityRating",
  );
  await user.click(
    screen.getByRole("button", { name: "查看详情 测试电影 01" }),
  );
  await screen.findByRole("heading", { name: "测试电影 01" });
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("1–30 / 65");
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "CommunityRating",
  );
  view.unmount();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "CommunityRating",
  );
  expect(
    calls
      .filter((q) => q.searchParams.get("ParentId") === "movies")
      .at(-1)
      ?.searchParams.get("SortBy"),
  ).toBe("CommunityRating,SortName");
  expect(readSortPreference(readAccount())).toEqual({
    sort: "CommunityRating",
    sortOrder: "Descending",
  });
});

it("invalidates saved filtered pages after marking a detail watched", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await pickSelect(user, screen.getByLabelText("观看状态"), "unplayed");
  await screen.findAllByText("1–30 / 65");
  await user.click(
    screen.getByRole("button", { name: "查看详情 测试电影 01" }),
  );
  await screen.findByRole("heading", { name: "测试电影 01" });
  await user.click(screen.getByRole("button", { name: "标为已看" }));
  await screen.findByRole("button", { name: "标为未看" });
  const before = calls.filter(
    (q) => q.searchParams.get("ParentId") === "movies",
  ).length;
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("1–30 / 64");
  expect(movieNames()).not.toContain("测试电影 01");
  expect(
    calls.filter((q) => q.searchParams.get("ParentId") === "movies").length,
  ).toBeGreaterThan(before);
  expect(screen.getByLabelText("观看状态").getAttribute("data-value")).toBe(
    "unplayed",
  );
});
function server(
  failure?: { items: boolean; total?: number },
  slow?: {
    start: number;
    order?: string;
    finish?: () => void;
    signal?: AbortSignal;
  },
  sorted = false,
) {
  const calls: URL[] = [];
  const playedIds = new Set<string>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      calls.push(url);
      let result: unknown = { Items: [], TotalRecordCount: 0 };
      if (url.pathname.endsWith("/Views"))
        result = {
          Items: [
            {
              Id: "movies",
              Name: "电影档案",
              Type: "CollectionFolder",
              CollectionType: "movies",
            },
            {
              Id: "series",
              Name: "剧集档案",
              Type: "CollectionFolder",
              CollectionType: "tvshows",
            },
          ],
          TotalRecordCount: 2,
        };
      else if (url.pathname.endsWith("/Genres"))
        result = {
          Items: [{ Id: "drama", Name: "剧情", Type: "Genre" }],
          TotalRecordCount: 1,
        };
      else if (url.pathname.includes("/PlayedItems/")) {
        playedIds.add(url.pathname.split("/").at(-1)!);
        result = { Played: true };
      } else if (/\/Items\/movie-\d+$/.test(url.pathname))
        result = movies[Number(url.pathname.split("-").at(-1)) - 1];
      else if (url.pathname.endsWith("/Items")) {
        const p = url.searchParams;
        if (failure?.items && p.get("ParentId") === "movies")
          return new Response("{}", { status: 503 });
        const list =
          p.get("ParentId") === "series" ||
          p.get("IncludeItemTypes") === "Series"
            ? [series]
            : p.get("ParentId") === "movies" && p.get("Recursive") !== "true"
              ? [{ Id: "nested", Name: "子文件夹", Type: "Folder" }]
              : p.get("IncludeItemTypes") === "Movie"
                ? movies
                : [...movies, series];
        const searched = p.has("SearchTerm")
          ? list.filter((i) => i.Name.includes(p.get("SearchTerm")!))
          : list;
        const filtered =
          p.get("IsPlayed") === "true"
            ? searched.slice(0, 1)
            : p.get("IsPlayed") === "false"
              ? searched.filter((item) => !playedIds.has(item.Id))
              : searched;
        const ordered = sorted
          ? [...filtered].sort(
              (a, b) =>
                a.Name.localeCompare(b.Name) *
                (p.get("SortOrder") === "Descending" ? -1 : 1),
            )
          : filtered;
        const remaining = ordered.slice(0, failure?.total ?? ordered.length);
        const start = Number(p.get("StartIndex") || 0),
          limit = Number(p.get("Limit") || 30);
        result = {
          Items: remaining.slice(start, start + limit),
          TotalRecordCount: remaining.length,
        };
      }
      const response = new Response(JSON.stringify(result));
      if (
        slow &&
        url.pathname.endsWith("/Items") &&
        url.searchParams.get("ParentId") === "movies" &&
        Number(url.searchParams.get("StartIndex")) === slow.start &&
        (!slow.order || url.searchParams.get("SortOrder") === slow.order)
      ) {
        slow.signal = init?.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          slow.finish = () => resolve(response);
        });
      }
      return response;
    }),
  );
  return calls;
}
it.each([true, false])(
  "sends independent rating directions for filtered search and displays server order: honors sorting %s",
  async (honorsSorting) => {
    server();
    const fallback = globalThis.fetch;
    const calls: URL[] = [];
    const samples = movies.slice(0, 3).map((item, i) => ({
      ...item,
      CommunityRating: [8.4, 10, 6.2][i],
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string, init?: RequestInit) => {
        const url = new URL(address);
        if (
          !url.pathname.endsWith("/Items") ||
          !url.searchParams.has("SearchTerm")
        )
          return fallback(address, init);
        calls.push(url);
        const ordered =
          honorsSorting &&
          url.searchParams.get("SortBy") === "CommunityRating,SortName"
            ? [...samples].sort(
                (a, b) =>
                  (a.CommunityRating - b.CommunityRating) *
                  (url.searchParams.get("SortOrder") === "Descending" ? -1 : 1),
              )
            : samples;
        return new Response(
          JSON.stringify({ Items: ordered, TotalRecordCount: 3 }),
        );
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
    );
    await screen.findAllByText("1–30 / 65");
    await pickSelect(user, screen.getByLabelText("每页显示"), "20");
    await pickSelect(user, screen.getByLabelText("评分"), "6");
    await user.type(screen.getByLabelText("搜索媒体"), "测试电影{Enter}");
    await screen.findByRole("heading", { name: "“测试电影”的搜索结果" });
    await pickSelect(
      user,
      screen.getByLabelText("媒体排序"),
      "CommunityRating",
    );
    await waitFor(() =>
      expect(movieNames()).toEqual(
        (honorsSorting ? [samples[1], samples[0], samples[2]] : samples).map(
          (item) => item.Name,
        ),
      ),
    );
    await user.click(screen.getByRole("button", { name: "降序，切换为升序" }));
    await waitFor(() =>
      expect(movieNames()).toEqual(
        (honorsSorting ? [samples[2], samples[0], samples[1]] : samples).map(
          (item) => item.Name,
        ),
      ),
    );
    const ratingCalls = calls.filter(
      (url) => url.searchParams.get("SortBy") === "CommunityRating,SortName",
    );
    expect(ratingCalls.map((url) => url.searchParams.get("SortOrder"))).toEqual(
      ["Descending", "Ascending"],
    );
    for (const url of ratingCalls) {
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        SearchTerm: "测试电影",
        SortBy: "CommunityRating,SortName",
        StartIndex: "0",
        Limit: "20",
        MinCommunityRating: "6",
      });
    }
    expect(
      screen.getByText(
        "搜索排序仅在服务器支持时生效；若顺序不变，可在媒体库中筛选并排序。",
      ),
    ).toBeTruthy();
  },
);
function topPager() {
  return within(screen.getByRole("navigation", { name: "影片翻页" }));
}
function movieNames() {
  return [...document.querySelectorAll(".content .card-caption > strong")]
    .map((e) => e.textContent)
    .filter((name) => name?.startsWith("测试电影"));
}
it("direct jump retains server/library/filter/sort/list state and same-page submit leaves requests and scroll untouched", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await pickSelect(user, screen.getByLabelText("媒体排序"), "ProductionYear");
  await pickSelect(user, screen.getByLabelText("题材"), "剧情");
  await pickSelect(user, screen.getByLabelText("观看状态"), "unplayed");
  await screen.findAllByText("1–30 / 65");
  await user.click(screen.getByRole("button", { name: "列表视图" }));
  const input = topPager().getByLabelText("跳转到页码");
  await user.clear(input);
  await user.type(input, "3{Enter}");
  await screen.findAllByText("61–65 / 65");
  expect(
    screen.getByRole("button", { name: "查看详情 测试电影 61" }),
  ).toBeTruthy();
  const query = calls
    .filter(
      (url) =>
        url.pathname.endsWith("/Items") &&
        url.searchParams.get("ParentId") === "movies",
    )
    .at(-1)!;
  expect(query.origin).toBe("https://media.example.com");
  expect(query.searchParams.get("StartIndex")).toBe("60");
  expect(query.searchParams.get("SortBy")).toBe("ProductionYear,SortName");
  expect(query.searchParams.get("Genres")).toBe("剧情");
  expect(query.searchParams.get("IsPlayed")).toBe("false");
  expect(
    screen
      .getByRole("button", { name: "列表视图" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  const main = document.querySelector("main")!;
  main.scrollTop = 420;
  const before = calls.length;
  await user.click(topPager().getByRole("button", { name: "跳转" }));
  expect(calls).toHaveLength(before);
  expect(main.scrollTop).toBe(420);
  expect(
    screen.getByRole("button", { name: "查看详情 测试电影 61" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "查看详情 测试电影 61" }),
  );
  await screen.findByRole("heading", { name: "测试电影 61" });
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("61–65 / 65");
  expect(topPager().getByLabelText("跳转到页码")).toHaveProperty("value", "3");
  await waitFor(() => expect(main.scrollTop).toBe(420));
});

it("changes server page size, resets bounds and keeps the selector available on single-page results and restart", async () => {
  const calls = server(),
    user = userEvent.setup();
  const view = render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("31–60 / 65");
  for (const size of [20, 50, 100, 30]) {
    await pickSelect(user, screen.getByLabelText("每页显示"), String(size));
    await screen.findAllByText(`1–${Math.min(65, size)} / 65`);
    expect(topPager().getByLabelText("跳转到页码")).toHaveProperty(
      "value",
      "1",
    );
    const q = calls.find(
      (u) =>
        u.searchParams.get("ParentId") === "movies" &&
        u.searchParams.get("Limit") === String(size) &&
        u.searchParams.get("StartIndex") === "0",
    )!;
    expect(q.searchParams.get("StartIndex")).toBe("0");
    expect(q.searchParams.get("Limit")).toBe(String(size));
  }
  await pickSelect(user, screen.getByLabelText("每页显示"), "50");
  await screen.findAllByText("1–50 / 65");
  view.unmount();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–50 / 65");
  expect(screen.getByLabelText("每页显示").getAttribute("data-value")).toBe(
    "50",
  );
});

it("restores custom page size, direction, page and cached cards after search and detail", async () => {
  const calls = server(undefined, undefined, true),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await user.click(screen.getByRole("button", { name: "升序，切换为降序" }));
  await pickSelect(user, screen.getByLabelText("每页显示"), "custom");
  const input = screen.getByLabelText("自定义每页数量");
  await user.clear(input);
  await user.type(input, "17{Enter}");
  await screen.findAllByText("1–17 / 65");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("18–34 / 65");
  const names = movieNames();
  const main = document.querySelector("main")!;
  main.scrollTop = 345;
  await user.click(
    screen.getByRole("button", { name: `查看详情 ${names[0]}` }),
  );
  await screen.findByRole("heading", { name: names[0]! });
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("18–34 / 65");
  expect(movieNames()).toEqual(names);
  expect(main.scrollTop).toBe(345);
  await user.type(screen.getByLabelText("搜索媒体"), "测试电影{Enter}");
  await pickSelect(user, screen.getByLabelText("题材"), "剧情");
  await pickSelect(user, screen.getByLabelText("观看状态"), "unplayed");
  await pickSelect(user, screen.getByLabelText("每页显示"), "50");
  await screen.findAllByText("1–50 / 65");
  const q = calls.filter((u) => u.searchParams.has("SearchTerm")).at(-1)!;
  expect(Object.fromEntries(q.searchParams)).toMatchObject({
    SearchTerm: "测试电影",
    SortBy: "SortName",
    SortOrder: "Descending",
    Genres: "剧情",
    IsPlayed: "false",
    Limit: "50",
    StartIndex: "0",
  });
  await user.click(screen.getByLabelText("清空搜索关键词"));
  await screen.findAllByText("18–34 / 65");
  expect(movieNames()).toEqual(names);
  expect(screen.getByLabelText("自定义每页数量")).toHaveProperty("value", "17");
  expect(screen.getByRole("button", { name: "降序，切换为升序" })).toBeTruthy();
});

it("sorts the complete query in both directions and traverses equal-score pages without gaps", async () => {
  const calls = server(undefined, undefined, true),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  // The fixture has equal/missing scores, so its server resolves ties by SortName.
  await pickSelect(user, screen.getByLabelText("媒体排序"), "CommunityRating");
  await screen.findAllByText("1–30 / 65");
  const descending = movies.map((m) => m.Name).reverse();
  const seen = [...movieNames()];
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("31–60 / 65");
  seen.push(...movieNames());
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("61–65 / 65");
  seen.push(...movieNames());
  expect(seen).toEqual(descending);
  expect(new Set(seen).size).toBe(65);
  await user.click(screen.getByRole("button", { name: "降序，切换为升序" }));
  await screen.findAllByText("1–30 / 65");
  expect(movieNames()).toEqual(movies.slice(0, 30).map((m) => m.Name));
  expect(
    calls
      .filter((u) => u.searchParams.get("ParentId") === "movies")
      .at(-1)!
      .searchParams.get("SortOrder"),
  ).toBe("Ascending");
});

it("cancels a pending descending query when size and direction change, isolating cached pages", async () => {
  const slow: {
    start: number;
    order?: string;
    finish?: () => void;
    signal?: AbortSignal;
  } = { start: 0, order: "Descending" };
  server(undefined, slow, true);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await user.click(screen.getByRole("button", { name: "升序，切换为降序" }));
  await waitFor(() => expect(slow.finish).toBeTypeOf("function"));
  await user.click(screen.getByRole("button", { name: "降序，切换为升序" }));
  await pickSelect(user, screen.getByLabelText("每页显示"), "50");
  await screen.findAllByText("1–50 / 65");
  expect(slow.signal?.aborted).toBe(true);
  await act(async () => slow.finish!());
  expect(movieNames()).toEqual(movies.slice(0, 50).map((m) => m.Name));
});

it("clamps a page after the server total shrinks and handles zero results", async () => {
  const failure = { items: false, total: 65 };
  server(failure);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  const input = topPager().getByLabelText("跳转到页码");
  await user.clear(input);
  await user.type(input, "3{Enter}");
  await screen.findAllByText("61–65 / 65");
  failure.total = 10;
  await user.click(screen.getByRole("button", { name: "刷新" }));
  await screen.findAllByText("1–10 / 10");
  expect(topPager().getByLabelText("跳转到页码")).toHaveProperty("value", "1");
  failure.total = 0;
  await user.click(screen.getByRole("button", { name: "刷新" }));
  await screen.findByRole("heading", { name: "这里还没有内容" });
  expect(topPager().getByRole("button", { name: "下一页" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByLabelText("每页显示")).toBeTruthy();
});
it("direct jump preserves multipage search and clearing restores the prior library", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await user.type(screen.getByLabelText("搜索媒体"), "测试电影{Enter}");
  const input = await screen.findByLabelText("跳转到页码");
  await user.clear(input);
  await user.type(input, "2");
  await user.click(screen.getByRole("button", { name: "跳转" }));
  await screen.findByText("测试电影 31", { selector: "strong" });
  expect(screen.getByLabelText("搜索媒体")).toHaveProperty("value", "测试电影");
  const query = calls
    .filter((url) => url.searchParams.has("SearchTerm"))
    .at(-1)!;
  expect(query.searchParams.get("SearchTerm")).toBe("测试电影");
  expect(query.searchParams.get("StartIndex")).toBe("30");
  await user.click(screen.getByLabelText("清空搜索关键词"));
  await screen.findAllByText("1–30 / 65");
  expect(screen.getByLabelText("搜索媒体")).toHaveProperty("value", "");
});
it("a second jump cancels the pending older page and a late response cannot replace the newest cards", async () => {
  const slow: { start: number; finish?: () => void; signal?: AbortSignal } = {
    start: 30,
  };
  server(undefined, slow);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  const input = topPager().getByLabelText("跳转到页码");
  await user.clear(input);
  await user.type(input, "2{Enter}");
  await waitFor(() => expect(slow.finish).toBeTypeOf("function"));
  expect(input).toBe(document.activeElement);
  expect(input).toHaveProperty("disabled", false);
  await user.clear(input);
  await user.type(input, "3{Enter}");
  await screen.findAllByText("61–65 / 65");
  expect(slow.signal?.aborted).toBe(true);
  await act(async () => {
    slow.finish!();
  });
  expect(movieNames()).toEqual(movies.slice(60).map((i) => i.Name));
  expect(topPager().getByLabelText("跳转到页码")).toHaveProperty("value", "3");
});
it("shows every nested movie across pages without gaps, displays ranges at both ends and scrolls to the new page", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  expect(
    calls
      .find(
        (url) =>
          url.searchParams.get("ParentId") === "movies" &&
          url.pathname.endsWith("/Items"),
      )
      ?.searchParams.get("IncludeItemTypes"),
  ).toBe("Movie");
  const seen = [...movieNames()];
  const main = document.querySelector("main")!;
  main.scrollTop = 1600;
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("31–60 / 65");
  expect(main.scrollTop).toBe(0);
  seen.push(...movieNames());
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("61–65 / 65");
  seen.push(...movieNames());
  expect(seen).toEqual(movies.map((m) => m.Name));
  expect(topPager().getByRole("button", { name: "下一页" })).toHaveProperty(
    "disabled",
    true,
  );
  const pages = calls.filter(
    (url) =>
      url.pathname.endsWith("/Items") &&
      url.searchParams.get("ParentId") === "movies",
  );
  expect(pages.map((url) => url.searchParams.get("StartIndex"))).toEqual([
    "0",
    "30",
    "60",
  ]);
  expect(
    pages.every(
      (url) =>
        url.searchParams.get("Recursive") === "true" &&
        url.searchParams.get("EnableTotalRecordCount") === "true",
    ),
  ).toBe(true);
  expect(calls.some((url) => /PlaybackInfo|Download/.test(url.pathname))).toBe(
    false,
  );
});
it("opens the complete catalog from home and preserves the recent sort when viewing all", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "最近加入" });
  await waitFor(() => expect(movieNames()).toHaveLength(12));
  expect(calls.some((url) => url.searchParams.get("SortBy") === "Random")).toBe(
    true,
  );
  await user.click(screen.getByRole("button", { name: "全部电影" }));
  await screen.findAllByText("1–30 / 65");
  await pickSelect(user, screen.getByLabelText("媒体排序"), "ProductionYear");
  await user.click(screen.getByRole("button", { name: "首页" }));
  await screen.findByRole("heading", { name: "最近加入" });
  await user.click(screen.getByRole("button", { name: "查看全部" }));
  await screen.findByRole("heading", { name: "全部影片" });
  await waitFor(() => expect(movieNames()).toHaveLength(30));
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "DateCreated",
  );
  await user.click(screen.getByRole("button", { name: "回到首页" }));
  await user.click(await screen.findByRole("button", { name: "全部电影" }));
  await screen.findAllByText("1–30 / 65");
  expect(screen.getByLabelText("媒体类型").getAttribute("data-value")).toBe(
    "Movie",
  );
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "ProductionYear",
  );
  expect(screen.getByRole("button", { name: "降序，切换为升序" })).toBeTruthy();
  const query = calls
    .filter(
      (url) =>
        url.pathname.endsWith("/Items") &&
        url.searchParams.get("IncludeItemTypes") === "Movie",
    )
    .at(-1)!;
  expect(query.searchParams.has("ParentId")).toBe(false);
  expect(query.searchParams.get("Recursive")).toBe("true");
  expect(query.searchParams.get("IncludeItemTypes")).toBe("Movie");
});
it("preserves sidebar library filters, scroll and cached data on repeated navigation", async () => {
  const calls = server();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await pickSelect(user, screen.getByLabelText("观看状态"), "played");
  await waitFor(() => expect(movieNames()).toHaveLength(1));
  const main = document.querySelector<HTMLElement>(".browse-main")!;
  main.scrollTop = 123;
  const requests = () =>
    calls.filter((url) => url.searchParams.get("ParentId") === "movies").length;
  const count = requests();
  const nav = within(screen.getByRole("navigation", { name: "主要导航" }));
  for (let i = 0; i < 3; i++) {
    await user.click(nav.getByRole("button", { name: /^首页$/ }));
    await user.click(nav.getByRole("button", { name: /^电影档案$/ }));
    await waitFor(() => expect(movieNames()).toHaveLength(1));
    expect(screen.getByLabelText("观看状态").getAttribute("data-value")).toBe(
      "played",
    );
    expect(main.scrollTop).toBe(123);
  }
  expect(requests()).toBe(count);
});
it("clears unrelated filters when opening another library and restores them when navigating back", async () => {
  server();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await pickSelect(user, screen.getByLabelText("题材"), "剧情");
  await pickSelect(user, screen.getByLabelText("观看状态"), "played");
  await waitFor(() => expect(movieNames()).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "剧集档案" }));
  await screen.findByText("测试剧集", { selector: "strong" });
  expect(screen.getByLabelText("题材").getAttribute("data-value")).toBe("");
  expect(screen.getByLabelText("观看状态").getAttribute("data-value")).toBe(
    "all",
  );
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await waitFor(() => expect(movieNames()).toHaveLength(1));
  expect(screen.getByLabelText("题材").getAttribute("data-value")).toBe("剧情");
  expect(screen.getByLabelText("观看状态").getAttribute("data-value")).toBe(
    "played",
  );
  await user.click(screen.getByRole("button", { name: "重置筛选" }));
  await waitFor(() => expect(movieNames()).toHaveLength(30));
  expect(screen.getByLabelText("观看状态").getAttribute("data-value")).toBe(
    "all",
  );
});
it("returns from a movie detail to the same page and filter state", async () => {
  const calls = server();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await pickSelect(user, screen.getByLabelText("题材"), "剧情");
  await screen.findAllByText("1–30 / 65");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  const poster = await screen.findByText("测试电影 31", { selector: "strong" });
  const panel = document.querySelector("main")!;
  panel.scrollTop = 520;
  const requests = calls.filter(
    (url) =>
      url.pathname.endsWith("/Items") &&
      url.searchParams.get("ParentId") === "movies",
  ).length;
  await user.click(poster.closest("button")!);
  await screen.findByRole("heading", { name: "测试电影 31" });
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("31–60 / 65");
  expect(screen.getByLabelText("题材").getAttribute("data-value")).toBe("剧情");
  await waitFor(() => expect(panel.scrollTop).toBe(520));
  expect(
    calls.filter(
      (url) =>
        url.pathname.endsWith("/Items") &&
        url.searchParams.get("ParentId") === "movies",
    ),
  ).toHaveLength(requests);
});
it("switches to informative list rows without resetting the third page, filters or sorting", async () => {
  const calls = server();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await pickSelect(user, screen.getByLabelText("媒体排序"), "ProductionYear");
  await pickSelect(user, screen.getByLabelText("题材"), "剧情");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("31–60 / 65");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("61–65 / 65");
  const count = calls.length;
  await user.click(screen.getByRole("button", { name: "列表视图" }));
  expect(document.querySelectorAll(".media-row")).toHaveLength(5);
  expect(screen.getByLabelText("媒体排序").getAttribute("data-value")).toBe(
    "ProductionYear",
  );
  expect(screen.getByLabelText("题材").getAttribute("data-value")).toBe("剧情");
  expect(calls).toHaveLength(count);
  document.querySelector("main")!.scrollTop = 250;
  await user.click(
    screen.getByRole("button", { name: "查看详情 测试电影 61" }),
  );
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findAllByText("61–65 / 65");
  expect(
    screen
      .getByRole("button", { name: "列表视图" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  await waitFor(() =>
    expect(document.querySelector("main")!.scrollTop).toBe(250),
  );
});
it("hides misleading empty content and page counts after a later-page failure, then retries the same page", async () => {
  const failure = { items: false };
  server(failure);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影档案" }),
  );
  await screen.findAllByText("1–30 / 65");
  await user.click(topPager().getByRole("button", { name: "下一页" }));
  await screen.findAllByText("31–60 / 65");
  failure.items = true;
  await user.click(screen.getByRole("button", { name: "刷新" }));
  await screen.findByText(/HTTP 503/);
  expect(screen.queryByRole("heading", { name: "这里还没有内容" })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "影片翻页" })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "列表底部翻页" })).toBeNull();
  failure.items = false;
  await user.click(screen.getByRole("button", { name: "重试" }));
  await screen.findAllByText("31–60 / 65");
  expect(movieNames()[0]).toBe("测试电影 31");
});
it("restores the search keyword, cached results and their scroll position after detail", async () => {
  const calls = server(),
    user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "最近加入" });
  await user.type(screen.getByLabelText("搜索媒体"), "测试电影{Enter}");
  await screen.findByRole("heading", { name: /测试电影/ });
  const main = document.querySelector("main")!;
  main.scrollTop = 450;
  await user.click(
    (await screen.findByText("测试电影 01", { selector: "strong" })).closest(
      "button",
    )!,
  );
  await screen.findByRole("heading", { name: "测试电影 01" });
  const requests = calls.filter((url) =>
    url.searchParams.get("SearchTerm"),
  ).length;
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findByRole("heading", { name: /测试电影/ });
  expect(screen.getByLabelText("搜索媒体")).toHaveProperty("value", "测试电影");
  expect(movieNames()).toHaveLength(30);
  await waitFor(() => expect(main.scrollTop).toBe(450));
  expect(
    calls.filter((url) => url.searchParams.get("SearchTerm")),
  ).toHaveLength(requests);
});
