// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import PlayerChrome, { contextPlacement } from "./PlayerChrome";
import type { PlayerUiModel } from "../player/uiModel";
import { playerMotion } from "../player/motion";
import { defaultShortcuts } from "../player/shortcuts";
import { danmakuDefaults } from "../danmaku/types";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
let model: PlayerUiModel;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  model = {
    state: {
      active: true,
      loaded: true,
      title: "本地测试",
      position: 10,
      duration: 100,
      paused: false,
      volume: 75,
      muted: false,
      tracks: [
        { id: 1, type: "sub", title: "简体中文", selected: true },
        { id: 2, type: "audio", title: "原声", selected: true },
      ],
      error: "",
      syncError: "",
      finished: false,
      embedded: true,
    },
    revision: 1,
    theater: true,
    canHide: true,
    busy: false,
    error: "",
    diagnosticFeedback: "",
    introSeconds: 90,
    outroSeconds: 60,
    previousDisabled: false,
    nextDisabled: false,
    capabilities: {
      return: true,
      previous: false,
      next: false,
      restart: true,
      versions: false,
    },
    routes: [
      { name: "线路 1", selected: true },
      { name: "线路 2", selected: false },
    ],
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
it.each([
  [1280, 520],
  [850, 520],
  [400, 376],
  [320, 296],
])(
  "fits danmaku panel to viewport %d with width %d",
  async (width, expected) => {
    model.danmaku = {
      name: "",
      count: 0,
      skipped: 0,
      status: "",
      settings: danmakuDefaults,
      offset: 0,
      bound: false,
    };
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: 800,
        width,
        height: 800,
        toJSON: () => ({}),
      });
    try {
      render(<PlayerChrome model={model} dispatch={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
      await tick(40);
      fireEvent.click(screen.getByRole("menuitem", { name: /弹幕/ }));
      await tick(40);
      expect(screen.getByRole("dialog", { name: "弹幕" }).style.width).toBe(
        `${expected}px`,
      );
    } finally {
      bounds.mockRestore();
    }
  },
);
it("protects editable danmaku input from shortcuts and closes only its popover on Escape", async () => {
  model.inputConfig = true;
  model.state.fullscreen = true;
  model.danmaku = {
    name: "",
    count: 0,
    skipped: 0,
    status: "",
    settings: danmakuDefaults,
    offset: 0,
    bound: false,
    online: {
      configured: true,
      mock: true,
      query: "Dune 2021",
      candidates: [],
      status: "",
      loading: false,
    },
  };
  const dispatch = vi.fn(async () => {});
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  await tick(40);
  fireEvent.click(screen.getByRole("menuitem", { name: /弹幕/ }));
  await tick(40);
  fireEvent.click(screen.getByText("搜索其他弹幕"));
  const input = screen.getByLabelText("在线弹幕搜索");
  for (const key of [
    " ",
    "f",
    "h",
    "1",
    "Backspace",
    "ArrowLeft",
    "ArrowRight",
    "Enter",
  ])
    fireEvent.keyDown(input, { key, code: key === " " ? "Space" : undefined });
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape", isComposing: true });
  expect(screen.getByRole("dialog", { name: "弹幕" })).toBeTruthy();
  fireEvent.keyDown(input, { key: "Escape" });
  await tick(200);
  expect(screen.queryByRole("dialog", { name: "弹幕" })).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
});
it.each([
  ["DirectPlay", "直接播放"],
  ["DirectStream", "直接串流"],
  ["Transcode", "转码"],
])(
  "shows actual %s play method and cropped video resolution",
  (method, label) => {
    model.state.playMethod = method;
    model.state.videoParams = { w: 1920, h: 800 };
    model.state.mediaQuality = {
      hdr: "HDR10",
      bitDepth: 10,
      primaries: "BT.2020",
      dvProfile: null,
      evidence: "emby",
    };
    render(<PlayerChrome model={model} dispatch={vi.fn(async () => {})} />);
    expect(screen.getByLabelText("当前播放清晰度").textContent).toContain(
      "1080p",
    );
    fireEvent.click(screen.getByRole("button", { name: "字幕" }));
    fireEvent.click(
      screen.getByRole("button", { name: "字幕大小、位置与延迟" }),
    );
    expect(screen.getByText(`播放方式：${label}`)).toBeTruthy();
    if (method === "Transcode")
      expect(screen.queryByText(/媒体：HDR10/)).toBeNull();
  },
);
it("clamps pointer menus at all viewport edges", () => {
  expect(contextPlacement(900, 700, 300, 400, 1000, 800)).toEqual({
    left: 690,
    top: 390,
  });
  expect(contextPlacement(-2, -3, 300, 400, 1000, 800)).toEqual({
    left: 10,
    top: 10,
  });
  expect(contextPlacement(120, 160, 300, 400, 1000, 800)).toEqual({
    left: 120,
    top: 160,
  });
});
it("positions context menu and clamps the next open after toggle close", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} owned />);
  const root = document.querySelector<HTMLElement>(".player-chrome")!;
  root.getBoundingClientRect = () =>
    ({ left: 20, top: 40, width: 800, height: 600 }) as DOMRect;
  fireEvent.contextMenu(root, { clientX: 120, clientY: 140 });
  const menu = screen.getByRole("menu", { name: "更多" });
  expect(menu.style.left).toBe("100px");
  expect(menu.style.top).toBe("100px");
  fireEvent.contextMenu(root, { clientX: 815, clientY: 635 });
  await tick(150);
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.contextMenu(root, { clientX: 815, clientY: 635 });
  const reopened = screen.getByRole("menu", { name: "更多" });
  expect(reopened.style.left).toBe("490px");
  expect(reopened.style.top).toBe("150px");
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  fireEvent.pointerDown(document.body);
  await tick(200);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
});
it.each([".player-heading strong", ".player-console", ".player-timeline"])(
  "dismisses from %s without a video pause",
  async (selector) => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayerChrome model={model} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
    const target = document.querySelector(selector)!;
    fireEvent.pointerDown(target);
    fireEvent.click(target);
    await tick(1000);
    expect(screen.queryByRole("menu", { name: "更多" })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  },
);
it("deduplicates sync/route feedback and gives current dismissal and session suppression separate actions", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  model.routeHint = { reason: "持续缓冲" };
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "关闭线路提示" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenLastCalledWith({ kind: "route-dismiss" });
  fireEvent.click(screen.getByRole("button", { name: "本次不再提醒" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenLastCalledWith({ kind: "route-suppress" });
  view.rerender(
    <PlayerChrome
      model={{
        ...model,
        state: { ...model.state, syncError: "播放进度暂时无法同步" },
      }}
      dispatch={dispatch}
    />,
  );
  expect(screen.queryByRole("button", { name: "查看线路" })).toBeNull();
  expect(screen.getByText("播放进度暂时无法同步")).toBeTruthy();
});
it("dismisses and executes a target control, switches menus, and does not reopen the same trigger", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const more = screen.getByRole("button", { name: "更多播放操作" });
  fireEvent.click(more);
  const play = screen.getByRole("button", { name: "暂停" });
  fireEvent.pointerDown(play);
  fireEvent.click(play);
  await tick(200);
  expect(screen.queryByRole("menu", { name: "更多" })).toBeNull();
  expect(dispatch).toHaveBeenCalledOnce();
  fireEvent.click(more);
  const subtitle = screen.getByRole("button", { name: "字幕" });
  fireEvent.pointerDown(subtitle);
  fireEvent.click(subtitle);
  await tick(32);
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  expect(screen.getByRole("menu", { name: "字幕" })).toBeTruthy();
  fireEvent.pointerDown(subtitle);
  fireEvent.click(subtitle);
  await tick(200);
  expect(screen.queryByRole("menu")).toBeNull();
});
it("keeps the danmaku panel open while choosing a nested portal Select and restores its trigger", async () => {
  model.danmaku = {
    name: "local.xml",
    count: 10,
    skipped: 0,
    status: "",
    settings: danmakuDefaults,
    offset: 0,
    bound: true,
  };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  await tick(40);
  fireEvent.click(screen.getByRole("menuitem", { name: /弹幕/ }));
  await tick(40);
  const trigger = screen.getByRole("combobox", { name: "同屏弹幕密度" });
  fireEvent.click(trigger);
  await tick(40);
  const high = screen.getByRole("option", { name: "高 · 最多 96 条" });
  fireEvent.pointerDown(high);
  fireEvent.click(high);
  await tick(150);
  expect(screen.getByRole("dialog", { name: "弹幕" })).toBeTruthy();
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "settings",
    patch: { density: 96 },
  });
  expect(document.activeElement).toBe(trigger);
});
it("holds chrome while a menu is open, closes the menu on blank video first, then restarts idle time", async () => {
  render(<PlayerChrome model={model} dispatch={vi.fn()} />);
  const chrome = document.querySelector(".player-chrome")!;
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  await tick(9000);
  expect(chrome.className).toContain("chrome-visible");
  fireEvent.pointerDown(chrome);
  expect(document.querySelector(".player-popover")?.className).toContain(
    "popover-closing",
  );
  expect(chrome.className).toContain("chrome-visible");
  await tick(120);
  expect(document.querySelector(".player-popover")).toBeNull();
  await tick(2799);
  expect(chrome.className).toContain("chrome-visible");
  await tick(1);
  expect(chrome.className).toContain("chrome-fading");
});
it("pauses the hide timer for editing and keeps drag values stable across native snapshots", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined),
    view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  const seek = screen.getByRole("slider", { name: "播放位置" });
  fireEvent.pointerDown(seek);
  fireEvent.change(seek, { target: { value: "45" } });
  view.rerender(
    <PlayerChrome
      model={{ ...model, state: { ...model.state, position: 12 } }}
      dispatch={dispatch}
    />,
  );
  await tick(4000);
  expect(seek).toHaveProperty("value", "45");
  expect(document.querySelector(".player-chrome")!.className).toContain(
    "chrome-visible",
  );
  fireEvent.pointerUp(seek);
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledWith({
    kind: "control",
    action: "seek",
    value: 45,
  });
});
it("keeps low frequency functions out of the primary bar and sends routes through the existing owner callback", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  expect(screen.getByRole("button", { name: "字幕" }).textContent).toBe("");
  expect(screen.getByRole("button", { name: "音轨" })).toBeTruthy();
  expect(screen.queryByText("停止播放")).toBeNull();
  expect(screen.queryByText("线路")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /线路/ }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "线路 2" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledWith({ kind: "route", index: 1 });
});
it("does not exit fullscreen when Escape closes a menu and restores the selected track focus", async () => {
  model.state.fullscreen = true;
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const anchor = screen.getByRole("button", { name: "字幕" });
  fireEvent.click(anchor);
  await tick(32);
  expect(document.activeElement).toBe(
    screen.getByRole("menuitemradio", { name: "简体中文" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await tick(120);
  expect(document.activeElement).toBe(anchor);
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: "Escape" });
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledWith({
    kind: "control",
    action: "fullscreen",
    value: 0,
  });
});
it("uses delayed single click, double click fullscreen, and right click without leaking through controls", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const root = document.querySelector(".player-chrome")!;
  fireEvent.click(root);
  await tick(159);
  expect(dispatch).not.toHaveBeenCalled();
  await tick(1);
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "pause",
    value: undefined,
  });
  dispatch.mockClear();
  fireEvent.click(root, { detail: 1 });
  fireEvent.doubleClick(root);
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "fullscreen",
    value: 1,
  });
  dispatch.mockClear();
  fireEvent.contextMenu(root);
  expect(screen.getByRole("menu", { name: "更多" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "暂停" }));
  expect(dispatch).not.toHaveBeenCalled();
});
it("shares the requested asymmetric chrome and restrained popover motion tokens", () => {
  expect(playerMotion).toEqual({
    chrome: { in: 240, out: 280 },
    popover: { in: 160, out: 120 },
    menu: { in: 160, out: 120 },
  });
});
it("toggles context menu closed on the second right click and consumes outside clicks without pausing", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const root = document.querySelector(".player-chrome")!;
  fireEvent.pointerDown(root, { button: 2 });
  fireEvent.contextMenu(root);
  expect(screen.getByRole("menu", { name: "更多" })).toBeTruthy();
  fireEvent.pointerDown(root, { button: 2 });
  fireEvent.contextMenu(root);
  await tick(150);
  expect(screen.queryByRole("menu", { name: "更多" })).toBeNull();
  fireEvent.contextMenu(root);
  fireEvent.click(screen.getByRole("menuitem", { name: /倍速/ }));
  expect(screen.getByRole("menu", { name: "播放速度" })).toBeTruthy();
  fireEvent.pointerDown(root);
  fireEvent.click(root);
  await tick(200);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.contextMenu(root);
  fireEvent.keyDown(document.body, { key: "Escape" });
  await tick(150);
  expect(screen.queryByRole("menu")).toBeNull();
});
it("does not undo a committed single click or fullscreen on a slow second click", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const root = document.querySelector(".player-chrome")!;
  fireEvent.click(root, { detail: 1 });
  await tick(160);
  fireEvent.click(root, { detail: 2 });
  fireEvent.doubleClick(root);
  await tick(500);
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch.mock.calls[0][0].action).toBe("pause");
});
it("keeps the current secondary option and checkmark with duplicate language names", async () => {
  model.state.secondarySubtitle = 3;
  model.state.tracks = [
    { id: 1, type: "sub", title: "简体", selected: true, "main-selection": 0 },
    { id: 3, type: "sub", title: "简体", selected: true, "main-selection": 1 },
    { id: 5, type: "sub", title: "英文" },
  ];
  render(
    <PlayerChrome
      model={model}
      dispatch={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  fireEvent.click(screen.getByRole("combobox", { name: "次字幕" }));
  expect(
    screen.getByRole("option", { name: "简体" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getAllByRole("option")).toHaveLength(3);
  expect(screen.getByRole("option", { name: "关闭" })).toBeTruthy();
});
it("arbitrates a quick double click without waiting for the system interval", async () => {
  model.state.doubleClickMs = 700;
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  const root = document.querySelector(".player-chrome")!;
  fireEvent.click(root, { detail: 1 });
  await tick(100);
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.click(root, { detail: 2 });
  fireEvent.doubleClick(root);
  await tick(1000);
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch).toHaveBeenCalledWith({
    kind: "control",
    action: "fullscreen",
    value: 1,
  });
});
it("does not fullscreen on a control or popover double click", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.doubleClick(screen.getByRole("slider", { name: "播放位置" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.doubleClick(screen.getByRole("menu", { name: "字幕" }));
  await tick(300);
  expect(dispatch).not.toHaveBeenCalled();
});
it("adjusts subtitle position and restores the default", async () => {
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  const slider = screen.getByRole("slider", { name: "字幕垂直位置" });
  fireEvent.change(slider, { target: { value: "65" } });
  await tick(50);
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "subtitlePosition",
    value: 65,
    persist: false,
  });
  fireEvent.click(screen.getByRole("button", { name: "恢复默认字幕位置" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "subtitlePosition",
    value: 100,
  });
});
it("does not let a delayed track selection close a different menu opened in the meantime", async () => {
  let finish!: () => void;
  const dispatch = vi.fn(() => new Promise<void>((r) => (finish = r)));
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "简体中文" }));
  fireEvent.click(screen.getByRole("button", { name: "音轨" }));
  await act(async () => finish());
  expect(screen.getByRole("menu", { name: "音轨" })).toBeTruthy();
  expect(document.querySelector(".player-popover")?.className).not.toContain(
    "popover-closing",
  );
  expect(dispatch).toHaveBeenCalledOnce();
});
it("uses custom and default keyboard actions once and ignores menu and slider focus", async () => {
  model.shortcuts = { ...defaultShortcuts, pause: "KeyZ" };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { code: "KeyZ", key: "z" });
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "pause",
    value: undefined,
  });
  fireEvent.keyDown(screen.getByRole("slider", { name: "播放位置" }), {
    key: "m",
    code: "KeyM",
  });
  expect(dispatch).toHaveBeenCalledOnce();
  fireEvent.keyDown(document.body, { key: "s", code: "KeyS" });
  await tick(32);
  expect(screen.getByRole("menu", { name: "字幕" })).toBeTruthy();
  fireEvent.keyDown(document.body, { key: "m", code: "KeyM" });
  expect(dispatch).toHaveBeenCalledOnce();
});
it("shows only a current skip range, dispatches its end and expires an ignored prompt", async () => {
  model.introSeconds = 20;
  model.outroSeconds = 15;
  const dispatch = vi.fn().mockResolvedValue(undefined),
    view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "跳过片头" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "seek",
    value: 20,
  });
  expect(screen.queryByRole("button", { name: "跳过片头" })).toBeNull();
  view.rerender(
    <PlayerChrome
      model={{ ...model, state: { ...model.state, position: 88 } }}
      dispatch={dispatch}
    />,
  );
  expect(screen.getByRole("button", { name: "跳过片尾" })).toBeTruthy();
  await tick(10000);
  expect(screen.queryByRole("button", { name: "跳过片尾" })).toBeNull();
});
