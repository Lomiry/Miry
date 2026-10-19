import { pickSelect } from "./testSelect";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Client interaction", () => {
  it("offers direct series playback, inline episodes, and returns to the last page", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
    await user.click(await screen.findByRole("button", { name: "电视剧" }));
    await user.click(
      await screen.findByRole("button", {
        name: /^查看详情 流人/,
      }),
    );
    expect(await screen.findByLabelText("选择季")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "立即播放" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "演示内容没有视频文件，请连接自己的 Emby 服务器后播放。",
    );
    await user.click(await screen.findByRole("button", { name: /第 2 集/ }));
    await screen.findByRole("heading", { name: "第 2 集" });
    await user.click(screen.getByRole("button", { name: "返回上一页" }));
    expect(await screen.findByRole("heading", { name: "流人" })).toBeTruthy();
    expect(await screen.findByLabelText("选择季")).toBeTruthy();
  });
  it("opens demo, navigates through series, season and episode, and exits", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
    await user.click(await screen.findByRole("button", { name: "电视剧" }));
    await user.click(
      await screen.findByRole("button", {
        name: /^查看详情 流人/,
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "查看 第 1 季详情",
      }),
    );
    await user.click(await screen.findByRole("button", { name: /第 2 集/ }));
    expect(
      await screen.findByRole("heading", { name: "第 2 集" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "退出登录" }));
    expect(
      await screen.findByRole("heading", { name: "连接你的媒体库" }),
    ).toBeTruthy();
  });
  it("searches and displays empty results", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
    const search = await screen.findByRole("textbox", { name: "搜索媒体" });
    await user.type(search, "沙丘{Enter}");
    expect(
      await screen.findByRole("button", {
        name: /^查看详情 沙丘：第二部/,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /^查看详情 降临/,
      }),
    ).toBeNull();
    await user.clear(search);
    await user.type(search, "没有这部电影{Enter}");
    expect(
      await screen.findByRole("heading", { name: "没有搜索结果" }),
    ).toBeTruthy();
  });
  it("cancels a stalled login and re-enables the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      ),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText("服务器地址"),
      "https://media.example.com",
    );
    await user.type(screen.getByLabelText("用户名"), "tester");
    await user.click(screen.getByRole("button", { name: "连接服务器" }));
    await user.click(await screen.findByRole("button", { name: "取消连接" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("已取消连接。"),
    );
    expect(screen.getByRole("button", { name: "连接服务器" })).toHaveProperty(
      "disabled",
      false,
    );
  });
  it("uses session storage by default and clears saved state on 401", async () => {
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("AuthenticateByName")
          ? new Response(
              JSON.stringify({
                User: { Id: "user", Name: "Tester" },
                AccessToken: "token",
              }),
            )
          : url.includes("System/Info/Public")
            ? new Response(
                JSON.stringify({
                  Id: "server",
                  ServerName: "Test",
                  Version: "4.9",
                }),
              )
            : new Response("denied", { status: 401 }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText("服务器地址"),
      "https://media.example.com",
    );
    await user.type(screen.getByLabelText("用户名"), "tester");
    await user.click(screen.getByRole("button", { name: "连接服务器" }));
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1));
    expect(
      await screen.findByRole("heading", { name: "连接你的媒体库" }),
    ).toBeTruthy();
    expect(sessionStorage.getItem("miry-account")).toBeNull();
    expect(localStorage.getItem("miry-account")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("登录失效或用户名密码错误，请重新登录。"),
    );
  });
  it("persists favorites and watched changes in demo navigation and saves settings", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开演示媒体库" }));
    await user.click(await screen.findByRole("button", { name: "电影" }));
    await user.click(
      await screen.findByRole("button", {
        name: /^查看详情 沙丘：第二部/,
      }),
    );
    const favorites = screen.getAllByRole("button", {
      name: "收藏",
    });
    await user.click(favorites[favorites.length - 1]);
    await screen.findByRole("button", { name: "取消收藏" });
    await user.click(screen.getByRole("button", { name: "标为已看" }));
    await screen.findByRole("button", { name: "标为未看" });
    await user.click(screen.getByRole("button", { name: "收藏" }));
    expect(
      await screen.findByRole("button", {
        name: /^查看详情 沙丘：第二部/,
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "设置" }));
    const toggle = screen.getByRole("checkbox", { name: /自动播放下一集/ });
    await user.click(toggle);
    expect(JSON.parse(localStorage.getItem("miry-settings")!).autoNext).toBe(
      false,
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "电影" }));
    await pickSelect(user, screen.getByLabelText("观看状态"), "played");
    expect(
      await screen.findByRole("button", {
        name: /^查看详情 沙丘：第二部/,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /^查看详情 降临/,
      }),
    ).toBeNull();
  });
});
