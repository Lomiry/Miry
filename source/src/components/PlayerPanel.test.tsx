import { pickSelect } from "../testSelect";
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { preparePlayback, type PlayerSnapshot } from "../player/playback";
import PlayerPanel, { PlayButton } from "./PlayerPanel";
import { EmbyClient } from "../api/client";
import { clearNetworkDiagnostics } from "../api/diagnostics";
import { readSettings, saveSettings } from "../stores/settings";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("../player/playback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../player/playback")>()),
  preparePlayback: vi.fn(),
}));
const api = new EmbyClient({
  server: "https://host.test/emby",
  userId: "user",
  token: "secret",
  name: "Test",
  deviceId: "device",
});
let snapshot: PlayerSnapshot;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(listen).mockImplementation(async () => () => {});
  snapshot = {
    active: true,
    loaded: true,
    title: "测试影片",
    position: 10,
    duration: 100,
    paused: false,
    volume: 75,
    muted: false,
    tracks: [
      { id: 2, type: "audio", title: "中文", selected: true, "ff-index": 5 },
      { id: 4, type: "sub", title: "简体中文", selected: true, "ff-index": 8 },
    ],
    error: "",
    syncError: "",
    finished: false,
  };
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === "player_status" ? snapshot : (undefined as never),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearNetworkDiagnostics();
});
async function openVideoFit() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: "播放设置" }));
  return user;
}
it.each(["fill", "stretch", "fit"] as const)(
  "switches %s through the session-bound native command and persists only after success",
  async (mode) => {
    snapshot.playSessionId = "fit-session";
    snapshot.videoFit = "fit";
    vi.mocked(invoke).mockImplementation(async (command, args) =>
      command === "player_status"
        ? snapshot
        : command === "player_video_fit"
          ? (args as { mode: string }).mode
          : (undefined as never),
    );
    render(<PlayerPanel dock revision={1} onStopped={vi.fn()} />);
    const user = await openVideoFit();
    await pickSelect(user, screen.getByLabelText("画面模式"), mode);
    expect(invoke).toHaveBeenCalledWith("player_video_fit", {
      mode,
      playSessionId: "fit-session",
    });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("miry-settings")!).videoFit).toBe(
        mode,
      ),
    );
    expect(screen.getByLabelText("画面模式").textContent).toContain(
      mode === "fill"
        ? "填充屏幕"
        : mode === "stretch"
          ? "拉伸铺满"
          : "自动适应",
    );
  },
);
it("keeps the old mode and preference after a rejected native change", async () => {
  snapshot.playSessionId = "fit-session";
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "player_video_fit") throw new Error("native rejected");
    return command === "player_status" ? snapshot : (undefined as never);
  });
  render(<PlayerPanel dock revision={1} onStopped={vi.fn()} />);
  const user = await openVideoFit();
  await pickSelect(user, screen.getByLabelText("画面模式"), "fill");
  expect(localStorage.getItem("miry-settings")).toBeNull();
  expect(screen.getByLabelText("画面模式").textContent).toContain("自动适应");
  expect(await screen.findByText(/native rejected/)).toBeTruthy();
});
it.each(["unmount", "new revision"])(
  "discards a delayed mode result after %s",
  async (end) => {
    snapshot.playSessionId = "fit-session";
    let resolve!: (mode: string) => void;
    vi.mocked(invoke).mockImplementation(async (command) =>
      command === "player_status"
        ? snapshot
        : command === "player_video_fit"
          ? await new Promise<string>((r) => {
              resolve = r;
            })
          : (undefined as never),
    );
    const view = render(<PlayerPanel dock revision={1} onStopped={vi.fn()} />);
    const user = await openVideoFit();
    await pickSelect(user, screen.getByLabelText("画面模式"), "fill");
    expect(localStorage.getItem("miry-settings")).toBeNull();
    if (end === "unmount") view.unmount();
    else view.rerender(<PlayerPanel dock revision={2} onStopped={vi.fn()} />);
    await act(async () => resolve("fill"));
    expect(localStorage.getItem("miry-settings")).toBeNull();
  },
);
it("persists only confirmed secondary controls and keeps the primary preferences", async () => {
  snapshot.embedded = true;
  snapshot.playSessionId = "secondary-session";
  saveSettings({
    ...readSettings(),
    subtitlePosition: 77,
    subtitleScale: 1.37,
    secondarySubtitlePosition: 25,
  });
  snapshot.secondarySubtitlePosition = 25;
  const user = userEvent.setup();
  render(<PlayerPanel theater dock revision={1} onStopped={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "字幕" }));
  await user.click(
    screen.getByRole("button", { name: "字幕大小、位置与延迟" }),
  );
  fireEvent.change(screen.getByLabelText("次字幕大小"), {
    target: { value: "2" },
  });
  fireEvent.pointerUp(screen.getByLabelText("次字幕大小"));
  await waitFor(() => expect(readSettings().secondarySubtitleScale).toBe(2));
  await user.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "次字幕垂直位置" }), {
    key: "End",
  });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "secondarySubtitlePosition",
      value: 100,
      expectedSessionId: "secondary-session",
    }),
  );
  expect(readSettings().secondarySubtitlePosition).toBe(25);
  await user.click(screen.getByRole("button", { name: "取消" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "调整次字幕位置" })).toBeNull(),
  );
  expect(readSettings().secondarySubtitlePosition).toBe(25);
  await user.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  await user.click(screen.getByRole("button", { name: "恢复默认" }));
  await user.click(screen.getByRole("button", { name: "确认位置" }));
  await waitFor(() => expect(readSettings().secondarySubtitlePosition).toBe(0));
  expect(readSettings()).toMatchObject({
    subtitlePosition: 77,
    subtitleScale: 1.37,
  });
});
it("offers direct track selection and moves menu focus without seeking the video", async () => {
  snapshot.embedded = true;
  snapshot.paused = true;
  const user = userEvent.setup();
  render(<PlayerPanel theater dock revision={1} onStopped={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "字幕" }));
  expect(
    screen
      .getByRole("menuitemradio", { name: "简体中文" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  await user.click(screen.getByRole("menuitemradio", { name: "关闭字幕" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "subtitle",
    value: -1,
  });
  await user.click(screen.getByRole("button", { name: "音轨" }));
  await user.click(screen.getByRole("menuitemradio", { name: "中文" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "audio",
    value: 2,
  });
  await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: /倍速/ }),
    ),
  );
  vi.mocked(invoke).mockClear();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(
    screen.getByRole("menuitem", { name: /弹幕.*显示/ }),
  );
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(
    screen.getByRole("menuitem", { name: "A–B 循环" }),
  );
  expect(invoke).not.toHaveBeenCalledWith(
    "player_control",
    expect.objectContaining({ action: "seek" }),
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "更多播放操作" }),
    ),
  );
});

it("copies the original native HTTP failure without a server address or token", async () => {
  snapshot = {
    ...snapshot,
    active: false,
    loaded: false,
    error: "播放器：[curl] HTTP error 404",
    networkDetails: [
      "Failed to open https://host.test/emby/videos/movie/original.mkv?api_key=secret",
    ],
    loadElapsedMs: 123,
  };
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<PlayerPanel theater api={api} revision={1} onStopped={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "复制播放诊断" }));
  const diagnostics = write.mock.calls[0][0];
  expect(diagnostics).toContain('"stage": "native-playback"');
  expect(diagnostics).toContain('"status": 404');
  expect(diagnostics).toContain('"elapsedMs": 123');
  expect(diagnostics).not.toContain("host.test");
  expect(diagnostics).not.toContain("secret");
  expect(diagnostics).not.toContain("original.mkv");
});
it("keeps fullscreen layout when the native event arrives before the command resolves, then exits with Escape", async () => {
  snapshot.embedded = true;
  const change = vi.fn();
  let event: ((e: { payload: boolean }) => void) | undefined;
  vi.mocked(listen).mockImplementation(async (name, handler) => {
    if (name === "player-fullscreen") event = handler as typeof event;
    return () => {};
  });
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_status") return snapshot;
    if (
      command === "player_control" &&
      (args as { action: string }).action === "fullscreen"
    ) {
      snapshot = {
        ...snapshot,
        fullscreen: (args as { value: number }).value === 1,
      };
      event?.({ payload: snapshot.fullscreen! });
    }
    return undefined as never;
  });
  const user = userEvent.setup();
  render(
    <PlayerPanel
      theater
      dock
      revision={1}
      onStopped={vi.fn()}
      onFullscreenChange={change}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "全屏" }));
  expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();
  expect(screen.getByLabelText("播放器控制").className).toContain(
    "player-fullscreen",
  );
  expect(change).toHaveBeenLastCalledWith(true);
  fireEvent.keyDown(document.body, { key: "Escape" });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "fullscreen",
      value: 0,
    }),
  );
  await screen.findByRole("button", { name: "全屏" });
  expect(change).toHaveBeenLastCalledWith(false);
});
it("allows F while a transport button is focused and keeps advanced controls collapsed", async () => {
  snapshot.embedded = true;
  render(<PlayerPanel theater dock revision={1} onStopped={vi.fn()} />);
  const pause = await screen.findByRole("button", { name: "暂停" });
  expect(pause.textContent).toBe("");
  expect(pause.getAttribute("aria-label")).toBe("暂停");
  expect(screen.getByRole("button", { name: "字幕" })).toBeTruthy();
  fireEvent.keyDown(pause, { key: "f" });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "fullscreen",
      value: 1,
    }),
  );
});
it("reduces stopped-player polling to one request every eight seconds", async () => {
  vi.useFakeTimers();
  snapshot.active = false;
  render(<PlayerPanel revision={1} onStopped={vi.fn()} />);
  await act(async () => {});
  const polls = () =>
    vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "player_status").length;
  expect(polls()).toBe(1);
  await act(async () => vi.advanceTimersByTime(7000));
  expect(polls()).toBe(1);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(polls()).toBe(2);
});
it("closes playback settings before exiting fullscreen and restores button focus", async () => {
  snapshot.embedded = true;
  snapshot.fullscreen = true;
  const user = userEvent.setup();
  render(<PlayerPanel theater dock revision={1} onStopped={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: "播放设置" }));
  expect(screen.getByRole("dialog", { name: "播放设置" })).toBeTruthy();
  vi.mocked(invoke).mockClear();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "播放设置" })).toBeNull();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "更多播放操作" }),
    ),
  );
  expect(invoke).not.toHaveBeenCalledWith("player_control", {
    action: "fullscreen",
    value: 0,
  });
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "fullscreen",
      value: 0,
    }),
  );
});

it("shows an embedded viewport and skips the current intro range before using loop controls", async () => {
  snapshot.embedded = true;
  snapshot.loopA = 10;
  const user = userEvent.setup();
  render(
    <PlayerPanel
      theater
      revision={1}
      onStopped={vi.fn()}
      introSeconds={20}
      outroSeconds={15}
    />,
  );
  await screen.findByLabelText("视频画面");
  expect(screen.queryByText("视频在独立窗口播放")).toBeNull();
  await user.click(screen.getByRole("button", { name: "跳过片头" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "seek",
    value: 20,
  });
  expect(screen.queryByRole("button", { name: "跳过片头" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: "播放设置" }));
  expect(screen.queryByRole("button", { name: "跳过片尾" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "返回更多菜单" }));
  await user.click(screen.getByRole("menuitem", { name: "A–B 循环" }));
  await user.click(screen.getByRole("button", { name: /标记 A/ }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "loopA",
    value: 20,
  });
  await user.click(screen.getByRole("button", { name: "取消循环" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "clearLoop",
    value: undefined,
  });
});

it("controls chapters, versions, secondary subtitles and restores the native window from the playback page", async () => {
  snapshot.tracks.push({
    id: 6,
    type: "sub",
    title: "English",
    selected: false,
  });
  const change = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(
    <PlayerPanel
      theater
      dock
      revision={1}
      onStopped={vi.fn()}
      sourceId="a"
      onSourceChange={change}
      item={{
        Id: "m",
        Name: "Movie",
        Type: "Movie",
        MediaSources: [
          { Id: "a", Name: "原版" },
          { Id: "b", Name: "备用版" },
        ],
        Chapters: [
          { Name: "开场", StartPositionTicks: 0 },
          { Name: "第二章", StartPositionTicks: 300000000 },
        ],
      }}
    />,
  );
  await screen.findByText("视频在独立窗口播放");
  const more = async () => {
    await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  };
  await more();
  await user.click(screen.getByRole("menuitem", { name: "章节" }));
  await user.click(screen.getByRole("menuitem", { name: /第二章/ }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "seek",
    value: 30,
  });
  await more();
  await user.click(screen.getByRole("menuitem", { name: "播放版本" }));
  await user.click(screen.getByRole("menuitemradio", { name: "备用版" }));
  expect(change).toHaveBeenCalledWith("b");
  await more();
  await user.click(screen.getByRole("menuitem", { name: "播放设置" }));
  await pickSelect(user, screen.getByLabelText("次字幕"), "6");
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "secondarySubtitle",
    value: 6,
  });
  fireEvent.change(screen.getByLabelText("字幕大小"), {
    target: { value: "1.25" },
  });
  fireEvent.pointerUp(screen.getByLabelText("字幕大小"));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "subtitleScale",
      value: 1.25,
    }),
  );
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "subtitleScale",
    value: 1.25,
  });
  await user.click(screen.getByRole("button", { name: "恢复视频窗口" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "show",
    value: undefined,
  });
});

it("provides dock transport, episode controls and expandable audio settings", async () => {
  const user = userEvent.setup(),
    onNext = vi.fn().mockResolvedValue(undefined),
    onPrevious = vi.fn().mockResolvedValue(undefined),
    select = vi.fn().mockResolvedValue(undefined);
  render(
    <PlayerPanel
      dock
      revision={1}
      onStopped={vi.fn()}
      onNext={onNext}
      onPrevious={onPrevious}
      queuePresentation={{
        items: [
          { Id: "q1", Name: "第一集", Type: "Episode" },
          { Id: "q2", Name: "第二集", Type: "Episode" },
        ],
        index: 0,
        busy: false,
        autoNext: true,
      }}
      onQueueSelect={select}
    />,
  );
  await screen.findByText("测试影片");
  expect(screen.getByRole("button", { name: "字幕" })).toBeTruthy();
  expect(screen.queryByLabelText("次字幕")).toBeNull();
  await user.click(screen.getByRole("button", { name: "快进 10 秒" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "seek",
    value: 20,
  });
  await user.click(screen.getByRole("button", { name: "上一集" }));
  expect(onPrevious).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "下一集" }));
  expect(onNext).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: "播放队列" }));
  await user.click(screen.getByRole("menuitemradio", { name: "第二集" }));
  expect(select).toHaveBeenCalledWith(1);
});

it("handles playback keys while preserving keys inside form fields", async () => {
  render(
    <>
      <input aria-label="搜索" />
      <PlayerPanel revision={1} onStopped={vi.fn()} />
    </>,
  );
  await screen.findByText("测试影片");
  // The title can render before the document keyboard effect is installed.
  await act(async () => {});
  vi.mocked(invoke).mockClear();
  fireEvent.keyDown(screen.getByLabelText("搜索"), { code: "Space", key: " " });
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "pause",
      value: undefined,
    }),
  );
});
it("starts playback through the native bridge with prepared resume parameters", async () => {
  const launch = { itemId: "movie", startSeconds: 12 };
  vi.mocked(preparePlayback).mockResolvedValue(launch as never);
  const onStarted = vi.fn();
  const user = userEvent.setup();
  render(
    <PlayButton
      api={api}
      item={{
        Id: "movie",
        Name: "Test",
        Type: "Movie",
        UserData: { PlaybackPositionTicks: 120000000 },
      }}
      onStarted={onStarted}
    />,
  );
  await user.click(screen.getByRole("button", { name: /继续播放/ }));
  expect(invoke).toHaveBeenCalledWith("player_start", { launch });
  expect(onStarted).toHaveBeenCalledOnce();
});
it("controls pause, seek and mpv track IDs and waits for stop", async () => {
  const user = userEvent.setup();
  render(<PlayerPanel revision={1} onStopped={vi.fn()} />);
  await screen.findByText("测试影片");
  await user.click(screen.getByRole("button", { name: "暂停" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "pause",
    value: undefined,
  });
  await user.click(screen.getByRole("button", { name: "字幕" }));
  await user.click(screen.getByRole("menuitemradio", { name: "关闭字幕" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "subtitle",
    value: -1,
  });
  await user.click(screen.getByRole("button", { name: "音轨" }));
  await user.click(screen.getByRole("menuitemradio", { name: "中文" }));
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "audio",
    value: 2,
  });
  const seek = screen.getByRole("slider", { name: "播放位置" });
  fireEvent.pointerDown(seek);
  fireEvent.change(seek, { target: { value: "40" } });
  expect(invoke).not.toHaveBeenCalledWith("player_control", {
    action: "seek",
    value: 40,
  });
  fireEvent.pointerUp(seek);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_control", {
      action: "seek",
      value: 40,
    }),
  );
  await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  await waitFor(() =>
    expect(screen.getByRole("menuitem", { name: "停止播放" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  await user.click(screen.getByRole("menuitem", { name: "停止播放" }));
  expect(invoke).toHaveBeenCalledWith("player_stop", {});
});
it("keeps sync failures visible after playback stops", async () => {
  snapshot = {
    ...snapshot,
    active: false,
    syncError: "播放进度同步失败，请检查网络。",
  };
  render(<PlayerPanel revision={1} onStopped={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "播放进度同步失败，请检查网络。",
  );
});
it("waits for the shared stop before leaving playback and prevents a duplicate return", async () => {
  let finish!: () => void;
  const stop = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const leave = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <PlayerPanel
      theater
      dock
      revision={1}
      onStopped={vi.fn()}
      onStop={stop}
      onTheater={leave}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "退出播放" }));
  expect(stop).toHaveBeenCalledOnce();
  expect(leave).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "退出播放" })).toHaveProperty(
    "disabled",
    true,
  );
  await act(async () => finish());
  await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  view.rerender(
    <PlayerPanel
      theater={false}
      dock
      revision={1}
      onStopped={vi.fn()}
      onStop={stop}
      onTheater={leave}
    />,
  );
  expect(screen.queryByLabelText("播放器控制")).toBeNull();
});
it("waits for terminal synchronization before notifying a stopped player", async () => {
  vi.useFakeTimers();
  const stopped = vi.fn();
  render(<PlayerPanel revision={1} onStopped={stopped} />);
  await act(async () => {});
  snapshot = { ...snapshot, active: false, syncComplete: false };
  await act(async () => vi.advanceTimersByTime(1000));
  expect(stopped).not.toHaveBeenCalled();
  snapshot = { ...snapshot, syncComplete: true };
  await act(async () => vi.advanceTimersByTime(1000));
  expect(stopped).toHaveBeenCalledOnce();
});
it("keeps chrome mounted and only makes it inert once its own fade finishes", async () => {
  vi.useFakeTimers();
  snapshot.embedded = true;
  const { container } = render(
    <PlayerPanel theater dock revision={1} onStopped={vi.fn()} />,
  );
  await act(async () => {});
  const panel = document.querySelector(".player-chrome")!;
  const heading = container.querySelector(".player-heading")!;
  const console = container.querySelector(".player-console")!;
  const pause = screen.getByRole("button", { name: "暂停" });
  await act(async () => vi.advanceTimersByTime(2800));
  expect(panel.className).toContain("chrome-fading");
  expect(heading.hasAttribute("inert")).toBe(false);
  expect(console.hasAttribute("inert")).toBe(false);
  fireEvent.transitionEnd(pause, { propertyName: "opacity" });
  expect(panel.className).toContain("chrome-fading");
  fireEvent.transitionEnd(console, { propertyName: "opacity" });
  expect(panel.className).toContain("chrome-hidden");
  expect(heading.hasAttribute("inert")).toBe(true);
  expect(console.hasAttribute("inert")).toBe(true);
  expect(container.querySelector(".player-heading")).toBe(heading);
  expect(container.querySelector(".player-console")).toBe(console);
  fireEvent.pointerMove(panel);
  expect(panel.className).toContain("chrome-visible");
  expect(console.hasAttribute("inert")).toBe(false);
  expect(screen.getByRole("button", { name: "暂停" })).toBe(pause);
});
it("allows a fading transport control to wake chrome and receive the click", async () => {
  vi.useFakeTimers();
  snapshot.embedded = true;
  render(<PlayerPanel theater dock revision={1} onStopped={vi.fn()} />);
  await act(async () => {});
  const panel = document.querySelector(".player-chrome")!;
  await act(async () => vi.advanceTimersByTime(2890));
  expect(panel.className).toContain("chrome-fading");
  const pause = screen.getByRole("button", { name: "暂停" });
  fireEvent.pointerDown(pause);
  fireEvent.click(pause);
  await act(async () => {});
  expect(panel.className).toContain("chrome-visible");
  expect(invoke).toHaveBeenCalledWith("player_control", {
    action: "pause",
    value: undefined,
  });
});
