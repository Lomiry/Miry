import { pickSelect } from "./testSelect";
// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount } from "./stores/account";
import { readLibraryPreferences } from "./stores/libraryPreferences";
import { searchScope } from "./stores/searchHistory";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
const account = {
  server: "https://first.test/emby",
  userId: "u",
  name: "A",
  token: "test-token",
  deviceId: "d",
};
const movie = {
  Id: "movie",
  Name: "测试电影",
  Type: "Movie",
  People: [
    {
      Id: "person",
      Name: "测试演员",
      Role: "主演",
      Type: "Actor",
      PrimaryImageTag: "photo",
    },
  ],
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function server() {
  const fetch = vi.fn(async (address: string, _init?: RequestInit) => {
    const url = new URL(address);
    const json = /\/Views$/.test(url.pathname)
      ? {
          Items: [
            { Id: "movies", Name: "电影库", Type: "CollectionFolder" },
            { Id: "series", Name: "剧集库", Type: "CollectionFolder" },
          ],
          TotalRecordCount: 2,
        }
      : /\/Items\/movie$/.test(url.pathname)
        ? movie
        : /\/Items\/person$/.test(url.pathname)
          ? {
              Id: "person",
              Name: "测试演员",
              Type: "Person",
              Overview: "<p>人物介绍 &amp; 生平</p>",
              ImageTags: { Primary: "photo" },
            }
          : url.searchParams.has("PersonIds")
            ? {
                Items:
                  url.searchParams.get("IncludeItemTypes") === "Series"
                    ? []
                    : [movie],
                TotalRecordCount: 31,
              }
            : url.searchParams.get("SortBy") === "DateCreated"
              ? { Items: [movie], TotalRecordCount: 1 }
              : { Items: [], TotalRecordCount: 0 };
    return new Response(JSON.stringify(json));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("synchronizes library visibility and ordering across home, sidebar, reloads and server switches", async () => {
  saveAccount(
    { ...account, server: "https://second.test/emby", name: "B" },
    false,
  );
  saveAccount(account, false);
  server();
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await screen.findByRole("button", { name: "打开媒体库 电影库" });
  await user.click(screen.getByRole("button", { name: "整理媒体库" }));
  const dialog = within(screen.getByRole("dialog", { name: "设置" }));
  await user.click(dialog.getByRole("button", { name: "上移媒体库 剧集库" }));
  await user.click(dialog.getByRole("checkbox", { name: "显示媒体库 电影库" }));
  await user.click(dialog.getByRole("button", { name: "关闭设置" }));
  expect(
    screen.queryByRole("button", { name: "打开媒体库 电影库" }),
  ).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "媒体库" })).queryByRole(
      "button",
      { name: "电影库" },
    ),
  ).toBeNull();
  expect(readLibraryPreferences(searchScope(account))).toEqual({
    hidden: ["movies"],
    order: ["series", "movies"],
  });
  unmount();
  render(<App />);
  await screen.findByRole("button", { name: "打开媒体库 剧集库" });
  expect(
    screen.queryByRole("button", { name: "打开媒体库 电影库" }),
  ).toBeNull();
  await pickSelect(user, screen.getByLabelText("当前服务器"), {
    name: "second.test",
  });
  expect(
    await screen.findByRole("button", { name: "打开媒体库 电影库" }),
  ).toBeTruthy();
  await pickSelect(user, screen.getByLabelText("当前服务器"), {
    name: "first.test",
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "打开媒体库 电影库" }),
    ).toBeNull(),
  );
});
it("opens a person from cast, reads biography, filters and pages works, and returns to the film", async () => {
  saveAccount(account, false);
  const fetch = server();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    (await screen.findByText("测试电影", { selector: "strong" })).closest(
      "button",
    )!,
  );
  await user.click(
    await screen.findByRole("button", { name: "查看人物 测试演员" }),
  );
  expect(await screen.findByText("人物介绍 & 生平")).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: "快速播放 测试电影" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "下一页" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes("PersonIds=person") && url.includes("StartIndex=30"),
      ),
    ).toBe(true),
  );
  await screen.findByText("第 2 页 / 2");
  await user.click(
    within(screen.getByRole("group", { name: "人物作品筛选" })).getByRole(
      "button",
      { name: "剧集" },
    ),
  );
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes("PersonIds=person") &&
          url.includes("IncludeItemTypes=Series") &&
          url.includes("StartIndex=0"),
      ),
    ).toBe(true),
  );
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  expect(
    await screen.findByRole("button", { name: "查看人物 测试演员" }),
  ).toBeTruthy();
  expect(
    fetch.mock.calls.every(
      ([, init]) => !(init as RequestInit | undefined)?.body,
    ),
  ).toBe(true);
  expect(
    fetch.mock.calls.some(([url]) =>
      /PlaybackInfo|Download|Authenticate/.test(url),
    ),
  ).toBe(false);
});
