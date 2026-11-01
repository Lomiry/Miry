// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
    "操作未完成。服务器暂不可用",
  );
  await user.click(screen.getByRole("button", { name: "立即播放" }));
  await waitFor(() => expect(onPlay).toHaveBeenCalled());
});
it("shows current card progress after playing the same media and after completion", async () => {
  const item = { ...episode, UserData: { PlaybackPositionTicks: 50000000 } };
  vi.mocked(resolveQuickPlay).mockResolvedValue(item);
  const onPlay = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <QuickPlay api={api} item={item} onPlay={onPlay} compact resumeLabel />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "快速播放 Episode" }));
  await waitFor(() => expect(onPlay).toHaveBeenCalledTimes(1));
  view.rerender(
    <QuickPlay
      api={api}
      item={{ ...item, UserData: { PlaybackPositionTicks: 170000000 } }}
      onPlay={onPlay}
      compact
      resumeLabel
    />,
  );
  expect(
    screen.getByRole("button", { name: "快速播放 Episode" }).textContent,
  ).toBe("继续播放 · 00:17");
  view.rerender(
    <QuickPlay
      api={api}
      item={{ ...item, UserData: { Played: true, PlaybackPositionTicks: 0 } }}
      onPlay={onPlay}
      compact
      resumeLabel
    />,
  );
  expect(
    screen.getByRole("button", { name: "快速播放 Episode" }).textContent,
  ).toBe("快速播放");
  expect(resolveQuickPlay).toHaveBeenCalledTimes(1);
});
it("keeps a resolved episode's position when the card represents its series", async () => {
  vi.mocked(resolveQuickPlay).mockResolvedValue(episode);
  const onPlay = vi.fn().mockResolvedValue(undefined);
  const view = render(<QuickPlay api={api} item={show} onPlay={onPlay} />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "立即播放" }));
  await screen.findByRole("button", { name: "继续观看 · 02:00" });
  view.rerender(<QuickPlay api={api} item={{ ...show }} onPlay={onPlay} />);
  expect(screen.getByRole("button", { name: "继续观看 · 02:00" })).toBeTruthy();
});
it("does not restore old progress when a pending lookup completes after the card updates", async () => {
  const item = { ...episode, UserData: { PlaybackPositionTicks: 50000000 } };
  let finish!: (value: typeof item) => void;
  vi.mocked(resolveQuickPlay).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onPlay = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <QuickPlay api={api} item={item} onPlay={onPlay} compact resumeLabel />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "快速播放 Episode" }));
  view.rerender(
    <QuickPlay
      api={api}
      item={{ ...item, UserData: { PlaybackPositionTicks: 170000000 } }}
      onPlay={onPlay}
      compact
      resumeLabel
    />,
  );
  await act(async () => finish(item));
  await waitFor(() => expect(onPlay).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole("button", { name: "快速播放 Episode" }).textContent,
  ).toBe("继续播放 · 00:17");
  expect(resolveQuickPlay).toHaveBeenCalledTimes(1);
});
