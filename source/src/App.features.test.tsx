import { pickSelect } from "./testSelect";
// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount } from "./stores/account";
import { recordHistory } from "./stores/history";
const first = {
  server: "https://a.test/emby",
  userId: "u",
  token: "token-a",
  name: "A",
  deviceId: "d",
};
const second = {
  ...first,
  server: "https://b.test/emby",
  token: "token-b",
  name: "B",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mockServer() {
  const fetch = vi.fn(async (address: string) => {
    const url = new URL(address),
      host = url.hostname;
    const result = url.pathname.endsWith("/Views")
      ? {
          Items: [{ Id: "movies", Name: "电影", Type: "CollectionFolder" }],
          TotalRecordCount: 1,
        }
      : /Resume|NextUp|Genres/.test(url.pathname)
        ? { Items: [], TotalRecordCount: 0 }
        : {
            Items: [{ Id: "same-id", Name: `${host}影片`, Type: "Movie" }],
            TotalRecordCount: 1,
          };
    return new Response(JSON.stringify(result));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("does not mount the route navigation for a single endpoint", async () => {
  saveAccount(first, false);
  mockServer();
  render(<App />);
  await screen.findByRole("button", { name: /^查看详情 a.test影片/ });
  expect(
    screen.queryByRole("button", { name: "连接线路", hidden: true }),
  ).toBeNull();
});
it("switches servers and aggregates results with each account's credentials", async () => {
  saveAccount(second, false);
  saveAccount(first, false);
  const fetch = mockServer(),
    user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", {
    name: /^查看详情 a.test影片/,
  });
  await pickSelect(user, screen.getByLabelText("当前服务器"), "0");
  await screen.findByRole("button", {
    name: /^查看详情 b.test影片/,
  });
  expect(
    screen.getAllByRole("button", { name: /查看详情 a.test影片/ }).length,
  ).toBeGreaterThan(0);
  await user.click(screen.getByRole("checkbox", { name: "全部服务器" }));
  await user.type(screen.getByLabelText("搜索媒体"), "影片{Enter}");
  await screen.findByRole("heading", { name: "a.test" });
  await screen.findByRole("heading", { name: "b.test" });
  expect(screen.queryByText("本页暂无内容")).toBeNull();
  expect(screen.getByLabelText("当前服务器").innerHTML).not.toContain(
    "https://",
  );
  const calls = fetch.mock.calls as unknown as [string, RequestInit][];
  const searches = calls.filter(
    ([url]) => new URL(url).searchParams.get("SearchTerm") === "影片",
  );
  expect(searches).toHaveLength(2);
  for (const [url, options] of searches)
    expect((options.headers as Record<string, string>)["X-Emby-Token"]).toBe(
      new URL(url).hostname === "a.test" ? first.token : second.token,
    );
});
it("drops the previous account's search origin on server switch while retaining the page-size preference", async () => {
  saveAccount(second, false);
  saveAccount(first, false);
  localStorage.setItem("miry-browse-page-size", "73");
  const fetch = mockServer(),
    user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "打开媒体库 电影" }),
  );
  await screen.findAllByText("1–1 / 1");
  await user.type(screen.getByLabelText("搜索媒体"), "影片{Enter}");
  await screen.findByRole("heading", { name: /影片/ });
  await pickSelect(user, screen.getByLabelText("当前服务器"), "0");
  await screen.findByRole("heading", { name: "最近加入" });
  await user.type(screen.getByLabelText("搜索媒体"), "影片{Enter}");
  await screen.findByRole("heading", { name: /影片/ });
  await user.click(screen.getByLabelText("清空搜索关键词"));
  await screen.findByRole("heading", { name: "最近加入" });
  await user.click(screen.getByRole("button", { name: "打开媒体库 电影" }));
  await screen.findAllByText("1–1 / 1");
  expect(screen.getByLabelText("每页显示").getAttribute("data-value")).toBe(
    "custom",
  );
  expect(screen.getByLabelText("自定义每页数量")).toHaveProperty("value", "73");
  const calls = fetch.mock.calls.map(([address]) => new URL(address));
  expect(
    calls.some(
      (url) =>
        url.hostname === "b.test" &&
        url.searchParams.get("ParentId") === "movies" &&
        url.searchParams.get("Limit") === "73",
    ),
  ).toBe(true);
});
it("keeps local history scoped and lets the user clear it", async () => {
  saveAccount(first, false);
  recordHistory(first, { Id: "h", Name: "观看记录影片", Type: "Movie" }, 60);
  recordHistory(first, { Id: "h2", Name: "另一条记录", Type: "Movie" });
  recordHistory(second, { Id: "h", Name: "其他服务器影片", Type: "Movie" });
  mockServer();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", {
    name: /^查看详情 a.test影片/,
  });
  await user.click(screen.getByRole("button", { name: "观看记录" }));
  await screen.findByRole("button", {
    name: /^查看详情 观看记录影片/,
  });
  expect(screen.queryByText("其他服务器影片")).toBeNull();
  expect(
    screen.getByRole("button", { name: "快速播放 观看记录影片" }).textContent,
  ).toContain("继续播放 · 01:00");
  await user.click(
    screen.getByRole("button", { name: "删除观看记录 另一条记录" }),
  );
  expect(screen.queryByText("另一条记录")).toBeNull();
  await user.click(screen.getByRole("button", { name: "清空观看记录" }));
  expect(
    await screen.findByRole("heading", { name: "还没有观看记录" }),
  ).toBeTruthy();
});
it("removes decorative copy and combines genre, year and score filters", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
  expect(screen.queryByText("媒体空间")).toBeNull();
  expect(screen.queryByText("YOUR STORIES. YOUR SPACE.")).toBeNull();
  expect(screen.queryByText("EMBY CLIENT")).toBeNull();
  await user.click(screen.getByRole("button", { name: "电影" }));
  await pickSelect(user, screen.getByLabelText("题材"), "科幻");
  await pickSelect(user, screen.getByLabelText("最低评分"), "8");
  await user.type(screen.getByLabelText("上映年份"), "2024");
  await screen.findByRole("button", {
    name: /^查看详情 沙丘：第二部/,
  });
  expect(screen.queryByRole("button", { name: /星际穿越/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "列表视图" }));
  expect(localStorage.getItem("miry-layout")).toBe("list");
  await user.click(screen.getByRole("button", { name: "重置筛选" }));
  await screen.findByRole("button", {
    name: /^查看详情 星际穿越/,
  });
});
it("focuses the add-server form and closes it with Escape", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
  await user.click(screen.getByRole("button", { name: "添加服务器" }));
  expect(
    await screen.findByRole("dialog", { name: "添加服务器" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("服务器地址")),
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("adds to watch later, removes from the list, and opens demo collections and playlists", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
  await user.click(
    (await screen.findAllByRole("button", { name: "加入待看 星际穿越" }))[0],
  );
  await user.click(screen.getByRole("button", { name: /待看清单/ }));
  await user.click(
    await screen.findByRole("button", { name: "移出待看 星际穿越" }),
  );
  await screen.findByRole("heading", { name: "待看清单为空" });
  await user.click(screen.getByRole("button", { name: "合集" }));
  await user.click(
    await screen.findByRole("button", { name: /查看详情 精选电影/ }),
  );
  await screen.findByRole("button", { name: "播放本页片单" });
  await user.click(screen.getByRole("button", { name: "播放列表" }));
  await screen.findByRole("button", { name: "查看详情 周末片单" });
});
