// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { saveAccount } from "./stores/account";
import { rememberConnection } from "./stores/connections";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
const account = {
  server: "https://private.test/emby",
  userId: "u",
  token: "private-token",
  name: "用户",
  deviceId: "d",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows server addresses while keeping the access token out of visible content", () => {
  rememberConnection(account, false);
  localStorage.setItem("miry-server", account.server);
  render(<App />);
  expect(screen.getByLabelText("服务器地址")).toHaveProperty("type", "url");
  expect(screen.getByLabelText("服务器地址")).toHaveProperty(
    "value",
    account.server,
  );
  expect(
    screen.getByRole("button", { name: "连接 private.test" }),
  ).toBeTruthy();
  expect(document.body.textContent).toContain("private.test");
  expect(document.body.textContent).not.toContain(account.token);
});

it("blocks single and collection playback in browser previews before requesting a play session", async () => {
  saveAccount(account, false);
  const collection = { Id: "list", Name: "服务器片单", Type: "Playlist" };
  const movie = { Id: "movie", Name: "影片", Type: "Movie" };
  const fetch = vi.fn(async (address: string) => {
    const path = new URL(address).pathname;
    const data = path.endsWith("/Items/list")
      ? collection
      : {
          Items:
            path.includes("Resume") ||
            path.includes("NextUp") ||
            path.includes("Views")
              ? []
              : path.includes("/Playlists/")
                ? [movie]
                : [collection],
          TotalRecordCount: 1,
        };
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", {
      name: /^查看详情 服务器片单/,
    }),
  );
  await user.click(
    await screen.findByRole("button", { name: "快速播放 影片" }),
  );
  expect(await screen.findByText("请在桌面客户端中播放。")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "播放本页片单" }));
  await waitFor(() =>
    expect(
      screen.getAllByText("请在桌面客户端中播放。").length,
    ).toBeGreaterThan(1),
  );
  expect(fetch.mock.calls.some(([url]) => url.includes("PlaybackInfo"))).toBe(
    false,
  );
  expect(invoke).not.toHaveBeenCalledWith("player_start", expect.anything());
});
