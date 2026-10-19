// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickPlay from "./QuickPlay";
import { EmbyClient } from "../api/client";
import { resolveQuickPlay } from "../player/quickPlay";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("../player/quickPlay", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveQuickPlay: vi.fn(),
}));
const api = new EmbyClient({
  server: "https://example.com/emby",
  userId: "u",
  token: "t",
  name: "t",
  deviceId: "d",
});
const show = { Id: "s", Type: "Series", Name: "Show" };
const episode = {
  Id: "e",
  Type: "Episode",
  Name: "Episode",
  IndexNumber: 3,
  UserData: { PlaybackPositionTicks: 1200000000 },
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("plays the resolved episode directly and offers restart of that episode", async () => {
  vi.mocked(resolveQuickPlay).mockResolvedValue(episode);
  const onPlay = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<QuickPlay api={api} item={show} onPlay={onPlay} />);
  await user.click(screen.getByRole("button", { name: "立即播放" }));
  await screen.findByRole("button", { name: "继续观看 · 02:00" });
  expect(onPlay.mock.calls[0][0]).toEqual(episode);
  expect(onPlay.mock.calls[0][1]).toBe(false);
  await user.click(screen.getByRole("button", { name: "本集从头播放" }));
  await waitFor(() => expect(onPlay.mock.calls[1][1]).toBe(true));
});
it("cancels a stalled lookup without launching the player", async () => {
  vi.mocked(resolveQuickPlay).mockImplementation(
    (_api, _item, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  const onPlay = vi.fn();
  const user = userEvent.setup();
  render(<QuickPlay api={api} item={show} onPlay={onPlay} />);
  await user.click(screen.getByRole("button", { name: "立即播放" }));
  await user.click(screen.getByRole("button", { name: "取消快速播放" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "立即播放" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  expect(onPlay).not.toHaveBeenCalled();
});
it("shows server errors and allows retry", async () => {
  vi.mocked(resolveQuickPlay)
    .mockRejectedValueOnce(new Error("服务器暂不可用"))
    .mockResolvedValueOnce(episode);
  const onPlay = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<QuickPlay api={api} item={show} onPlay={onPlay} />);
  await user.click(screen.getByRole("button", { name: "立即播放" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "服务器暂不可用",
  );
  await user.click(screen.getByRole("button", { name: "立即播放" }));
  await waitFor(() => expect(onPlay).toHaveBeenCalled());
});
