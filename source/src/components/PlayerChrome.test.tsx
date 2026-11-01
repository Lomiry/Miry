// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import PlayerChrome, { contextPlacement } from "./PlayerChrome";
import type { PlayerAction, PlayerUiModel } from "../player/uiModel";
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
it("uses separate subtitle and danmaku icons in both the toolbar and More fallback", async () => {
  model.controlLayout = { preset: "full" } as PlayerUiModel["controlLayout"];
  model.danmaku = {
    name: "",
    count: 0,
    skipped: 0,
    status: "",
    settings: danmakuDefaults,
    offset: 0,
    bound: false,
  };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  expect(
    screen
      .getByRole("button", { name: "字幕" })
      .querySelector(".lucide-captions"),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "弹幕" })
      .querySelector(".lucide-message-square-text"),
  ).toBeTruthy();
  model.controlLayout = { preset: "minimal" } as PlayerUiModel["controlLayout"];
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  expect(
    screen
      .getByRole("menuitem", { name: /弹幕/ })
      .querySelector(".lucide-message-square-text"),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("menuitem", { name: "字幕" })
      .querySelector(".lucide-captions"),
  ).toBeTruthy();
});

it.each([true, false])(
  "keeps internal/external tracks, Off, and subtitle settings under one entry (external=%s)",
  async (external) => {
    model.state.tracks.push({
      id: 3,
      type: "sub",
      title: "外挂测试",
      external,
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayerChrome model={model} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "字幕" }));
    const menu = screen.getByRole("menu", { name: "字幕" });
    const item = within(menu).getByRole("menuitemradio", { name: "外挂测试" });
    expect(item.closest(".player-menu-group")?.textContent).toContain(
      external ? "外挂字幕" : "内嵌字幕",
    );
    fireEvent.click(item);
    await act(async () => {});
    expect(dispatch).toHaveBeenLastCalledWith({
      kind: "control",
      action: "subtitle",
      value: 3,
      playSessionId: undefined,
    });
    await tick(180);
    fireEvent.click(screen.getByRole("button", { name: "字幕" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "关闭字幕" }));
    await act(async () => {});
    expect(dispatch).toHaveBeenLastCalledWith({
      kind: "control",
      action: "subtitle",
      value: -1,
      playSessionId: undefined,
    });
    await tick(180);
    fireEvent.click(screen.getByRole("button", { name: "字幕" }));
    fireEvent.click(
      screen.getByRole("button", { name: "字幕大小、位置与延迟" }),
    );
    expect(screen.getByRole("slider", { name: "字幕大小" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "字幕延迟" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "次字幕" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "字幕" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "返回字幕" }));
    expect(
      screen.getByRole("menuitemradio", { name: "外挂测试" }),
    ).toBeTruthy();
  },
);

it("keeps subtitle controls out of general picture/audio settings, with no label hover delegation", async () => {
  model.state.playSessionId = "fixture";
  const dispatch = vi
    .fn()
    .mockRejectedValue(new Error("controlled fit failure"));
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "播放设置" }));
  const fit = screen.getByRole("combobox", { name: "画面模式" });
  expect(fit.closest("label")).toBeNull();
  expect(screen.queryByRole("slider", { name: "字幕大小" })).toBeNull();
  expect(screen.getByRole("spinbutton", { name: "音频延迟" })).toBeTruthy();
  fireEvent.click(fit);
  fireEvent.click(screen.getByRole("option", { name: "填充屏幕" }));
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "video-fit", playSessionId: "fixture" }),
  );
  expect(screen.getByRole("alert").textContent).toContain("操作未完成");
});

it("offers a clear empty subtitle state while keeping all subtitle settings reachable", () => {
  model.state.tracks = [];
  render(
    <PlayerChrome
      model={model}
      dispatch={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  expect(screen.getByText("此视频没有可用字幕")).toBeTruthy();
  expect(screen.getByText(/当前播放器未提供本地字幕文件导入/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  expect(screen.getByRole("slider", { name: "字幕大小" })).toBeTruthy();
});
it("keeps pending feedback scoped to the clicked play button instead of every control", async () => {
  let finish!: () => void;
  const dispatch = vi.fn(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "暂停" }));
  expect(
    view.container.querySelectorAll('button[aria-busy="true"]'),
  ).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "暂停" }).getAttribute("aria-busy"),
  ).toBe("true");
  await act(async () => finish());
  expect(
    view.container.querySelectorAll('button[aria-busy="true"]'),
  ).toHaveLength(0);
});
it("keeps track loading and an enabled danmaku preference from highlighting unrelated controls", async () => {
  model.danmaku = {
    name: "",
    count: 0,
    skipped: 0,
    status: "",
    settings: { ...danmakuDefaults, enabled: true },
    offset: 0,
    bound: false,
  };
  let finish!: () => void;
  const dispatch = vi.fn(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  expect(
    view.container.querySelectorAll(
      '.transport-tools button[data-active="true"]',
    ),
  ).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "简体中文" }));
  expect(
    screen.getByRole("button", { name: "字幕" }).getAttribute("aria-busy"),
  ).toBe("true");
  expect(
    screen.getByRole("button", { name: "音量" }).getAttribute("aria-busy"),
  ).toBe("false");
  expect(
    screen
      .getByRole("button", { name: "更多播放操作" })
      .getAttribute("aria-busy"),
  ).toBe("false");
  expect(
    view.container.querySelectorAll('button[aria-busy="true"]'),
  ).toHaveLength(1);
  await act(async () => finish());
});
it("Mini uses independent 32px button backgrounds and fits its speed menu inside 320×180", async () => {
  model.mini = true;
  model.state.playSessionId = "one";
  model.state.speed = 1;
  const fs = await vi.importActual<{
    readFileSync(path: string, encoding: "utf8"): string;
  }>("node:fs");
  const styles = document.createElement("style");
  styles.textContent = fs.readFileSync("src/design/player.css", "utf8");
  document.head.append(styles);
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      left: 0,
      top: 0,
      right: 320,
      bottom: 180,
      width: 320,
      height: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  try {
    const dispatch = vi.fn(async () => {});
    const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
    const console = view.container.querySelector(".player-console")!;
    expect(getComputedStyle(console).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(getComputedStyle(console).padding)).toBe(0);
    expect(
      getComputedStyle(screen.getByRole("button", { name: "暂停" })).height,
    ).toBe("32px");
    fireEvent.click(screen.getByRole("button", { name: "倍速" }));
    await tick(40);
    const menu = screen.getByRole("menu", { name: "播放速度" });
    expect(
      parseFloat(menu.style.left) + parseFloat(menu.style.width),
    ).toBeLessThanOrEqual(320);
    expect(
      parseFloat(menu.style.bottom) + parseFloat(menu.style.maxHeight),
    ).toBeLessThanOrEqual(180);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "2×" }));
    await tick(200);
    expect(dispatch).toHaveBeenCalledWith({
      kind: "control",
      action: "speed",
      value: 2,
    });
  } finally {
    bounds.mockRestore();
    styles.remove();
  }
});
it.each([1, 1.25, 1.5, 2])(
  "Mini shows the actual %s rate beside an independent play button",
  (speed) => {
    model.mini = true;
    model.state.playSessionId = "one";
    model.state.speed = speed;
    const view = render(
      <PlayerChrome model={model} dispatch={vi.fn(async () => {})} />,
    );
    const rate = screen.getByRole("button", { name: "倍速" });
    expect(rate.textContent).toBe(
      `${Number.isInteger(speed) ? speed.toFixed(1) : speed}×`,
    );
    expect(
      view.container.querySelector(".player-mini-controls")?.children,
    ).toHaveLength(2);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    view.rerender(
      <PlayerChrome
        model={{ ...model, state: { ...model.state, speed: 1.5 } }}
        dispatch={vi.fn(async () => {})}
      />,
    );
    expect(rate.textContent).toBe("1.5×");
  },
);
it("Mini reveals controls on movement and hides/restores both the buttons and embedded X without changing subtitles", async () => {
  model.mini = true;
  model.canHide = true;
  model.state.playSessionId = "one";
  const dispatch = vi.fn(async () => {});
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  const root = view.container.querySelector(".player-chrome")!;
  await tick(2800 + playerMotion.chrome.out);
  expect(root.classList.contains("chrome-hidden")).toBe(true);
  expect(
    view.container.querySelector(".mini-exit")?.hasAttribute("inert"),
  ).toBe(true);
  fireEvent.pointerMove(root);
  expect(root.classList.contains("chrome-visible")).toBe(true);
  expect(screen.getByRole("button", { name: "退出小窗" })).toHaveProperty(
    "disabled",
    false,
  );
  fireEvent.pointerLeave(root);
  await tick(playerMotion.chrome.out);
  expect(root.classList.contains("chrome-hidden")).toBe(true);
  fireEvent.pointerEnter(root);
  expect(root.classList.contains("chrome-visible")).toBe(true);
  expect(model.state.tracks[0].selected).toBe(true);
  expect(dispatch).not.toHaveBeenCalled();
});
it("offers only play, speed and an embedded X in Mini, preserving subtitle tracks and deduplicating exit", async () => {
  model.mini = true;
  model.state.playSessionId = "one";
  model.danmaku = {
    settings: danmakuDefaults,
    name: "QA",
    count: 1,
    skipped: 0,
    status: "",
    offset: 0,
    bound: false,
    density: { bins: [1], duration: 100 },
  };
  let fail!: (error: Error) => void;
  const dispatch = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
  );
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  const exit = screen.getByRole("button", { name: "退出小窗" });
  expect(exit.parentElement).toBe(
    view.container.querySelector(".player-chrome"),
  );
  expect(exit.closest(".transport-tools")).toBeNull();
  expect(exit.querySelector("svg")).toBeTruthy();
  expect(exit.querySelector("span")).toBeNull();
  expect(view.container.querySelector(".player-heading")).toBeNull();
  expect(view.container.querySelector(".player-timeline")).toBeNull();
  expect(screen.queryByRole("button", { name: "字幕" })).toBeNull();
  expect(screen.getByRole("button", { name: "倍速" })).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(model.state.tracks[0]).toMatchObject({ type: "sub", selected: true });
  expect(screen.queryByRole("button", { name: "弹幕" })).toBeNull();
  expect(view.container.querySelector(".danmaku-heatmap")).toBeNull();
  fireEvent.click(exit);
  fireEvent.click(exit);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(exit).toHaveProperty("disabled", true);
  expect(screen.getByRole("status").textContent).toBe("正在处理…");
  await act(async () => fail(new Error("controlled failure")));
  expect(exit).toHaveProperty("disabled", false);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(dispatch).toHaveBeenCalledWith({
    kind: "mini",
    command: "leave",
    playSessionId: "one",
  });
});
it("Mini exit bypasses global busy and an unresolved control while sync reports failure", async () => {
  model.mini = true;
  model.state.playSessionId = "one";
  model.state.syncError = "播放进度暂时无法同步";
  const dispatch = vi.fn((action: PlayerAction) =>
    action.kind === "control" ? new Promise<void>(() => {}) : Promise.resolve(),
  );
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "暂停" }));
  view.rerender(
    <PlayerChrome model={{ ...model, busy: true }} dispatch={dispatch} />,
  );
  const exit = screen.getByRole("button", { name: "退出小窗" });
  expect(exit).toHaveProperty("disabled", false);
  fireEvent.click(exit);
  await tick(0);
  expect(dispatch).toHaveBeenCalledWith({
    kind: "mini",
    command: "leave",
    playSessionId: "one",
  });
});
it("returns from mini with Escape through its session-scoped action", async () => {
  model.mini = true;
  model.state.playSessionId = "one";
  const dispatch = vi.fn(async () => {});
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.keyDown(document, { key: "Escape" });
  await tick(0);
  expect(dispatch).toHaveBeenCalledWith({
    kind: "mini",
    command: "leave",
    playSessionId: "one",
  });
});
it.each(["minimal", "standard", "full", "custom"] as const)(
  "keeps playback, seek, return, heatmap slot and More in %s",
  async (preset) => {
    model.controlLayout = { preset, buttons: [] };
    const dispatch = vi.fn(async () => {});
    const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
    expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "退出播放" })).toBeTruthy();
    expect(view.container.querySelector(".player-timeline input")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
    await tick(40);
    expect(screen.getByRole("menuitem", { name: /控制栏布局/ })).toBeTruthy();
    if (preset === "custom") {
      fireEvent.click(screen.getByRole("menuitem", { name: /音量/ }));
      await tick(40);
      expect(screen.getByRole("slider", { name: "音量" })).toBeTruthy();
    }
  },
);
it("orders custom tools and dispatches the same speed action as the More menu", async () => {
  model.controlLayout = { preset: "custom", buttons: ["speed", "volume"] };
  const dispatch = vi.fn(async () => {});
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  const names = Array.from(
    view.container.querySelectorAll(".transport-tools button"),
  ).map((node) => node.getAttribute("aria-label"));
  expect(names).toEqual(["倍速", "音量", "更多播放操作"]);
  fireEvent.click(screen.getByRole("button", { name: "倍速" }));
  await tick(40);
  fireEvent.click(screen.getByRole("menuitemradio", { name: /1.5/ }));
  await tick(200);
  expect(dispatch).toHaveBeenCalledWith({
    kind: "control",
    action: "speed",
    value: 1.5,
  });
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
    fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "播放设置" }));
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
  await tick(200);
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    kind: "control",
    action: "pause",
    value: undefined,
  });
});
it("honors Escape and fullscreen shortcuts throughout a busy media loading gap", async () => {
  model.state = {
    ...model.state,
    active: false,
    loaded: false,
    fullscreen: true,
  };
  model.busy = true;
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "fullscreen",
    value: 0,
  });
  model = { ...model, state: { ...model.state, fullscreen: false } };
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.keyDown(document.body, { key: "f", code: "KeyF" });
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "fullscreen",
    value: 1,
  });
  expect(dispatch).toHaveBeenCalledTimes(2);
});
it("permits pause after dismissing a menu while its track request is pending", async () => {
  let finish!: () => void;
  const dispatch = vi.fn((action: PlayerAction) =>
    action.kind === "control" && action.action === "subtitle"
      ? new Promise<void>((r) => {
          finish = r;
        })
      : Promise.resolve(),
  );
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "简体中文" }));
  fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
  await tick(150);
  fireEvent.click(screen.getByRole("button", { name: "暂停" }));
  expect(
    dispatch.mock.calls.some(
      ([action]) => action.kind === "control" && action.action === "pause",
    ),
  ).toBe(true);
  await act(async () => finish());
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
it("previews and confirms secondary position independently, preserving the editor through fullscreen", async () => {
  model.state.playSessionId = "secondary-session";
  model.state.secondarySubtitlePosition = 25;
  model.state.secondarySubtitleScale = 1;
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  const scale = screen.getByRole("slider", { name: "次字幕大小" });
  expect(scale.getAttribute("min")).toBe("0.5");
  expect(scale.getAttribute("max")).toBe("2");
  fireEvent.change(scale, { target: { value: "2" } });
  fireEvent.pointerUp(scale);
  await tick(50);
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "secondarySubtitleScale",
    value: 2,
    persist: true,
    playSessionId: "secondary-session",
  });
  fireEvent.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "次字幕垂直位置" }), {
    key: "ArrowDown",
  });
  await tick(50);
  model = {
    ...model,
    state: { ...model.state, fullscreen: true, secondarySubtitlePosition: 26 },
  };
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  expect(screen.getByRole("dialog", { name: "调整次字幕位置" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "确认位置" }));
  await tick(50);
  expect(dispatch).toHaveBeenLastCalledWith({
    kind: "control",
    action: "secondarySubtitlePosition",
    value: 26,
    persist: true,
    playSessionId: "secondary-session",
  });
  expect(
    dispatch.mock.calls.every(([action]) =>
      ["secondarySubtitlePosition", "secondarySubtitleScale"].includes(
        action.action,
      ),
    ),
  ).toBe(true);
});
it("reopens with the settled position before a delayed native snapshot arrives", async () => {
  model.state.secondarySubtitlePosition = 100;
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  fireEvent.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
  fireEvent.click(screen.getByRole("button", { name: "确认位置" }));
  await tick(50);
  fireEvent.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  expect(
    screen
      .getByRole("slider", { name: "次字幕垂直位置" })
      .getAttribute("aria-valuenow"),
  ).toBe("0");
  fireEvent.keyDown(screen.getByRole("slider", { name: "次字幕垂直位置" }), {
    key: "End",
  });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  await tick(50);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      action: "secondarySubtitlePosition",
      value: 0,
      persist: false,
    }),
  );
  // Once native state catches up, subsequent external changes remain authoritative.
  model = { ...model, state: { ...model.state, secondarySubtitlePosition: 0 } };
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  model = {
    ...model,
    state: { ...model.state, secondarySubtitlePosition: 37 },
  };
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  expect(
    screen
      .getByRole("slider", { name: "次字幕垂直位置" })
      .getAttribute("aria-valuenow"),
  ).toBe("37");
});
it("drops queued secondary previews when the playback session changes", async () => {
  model.state.playSessionId = "old-session";
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const view = render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  fireEvent.click(screen.getByRole("button", { name: "字幕大小、位置与延迟" }));
  fireEvent.click(screen.getByRole("button", { name: "调整次字幕位置" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "次字幕垂直位置" }), {
    key: "End",
  });
  model = {
    ...model,
    revision: 2,
    state: { ...model.state, playSessionId: "new-session" },
  };
  view.rerender(<PlayerChrome model={model} dispatch={dispatch} />);
  await tick(100);
  expect(screen.queryByRole("dialog", { name: "调整次字幕位置" })).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
});
it("keeps the opacity slider interactive while earlier changes await the owned bridge", async () => {
  model.danmaku = {
    name: "",
    count: 0,
    skipped: 0,
    status: "",
    settings: danmakuDefaults,
    offset: 0,
    bound: false,
  };
  let finish!: () => void;
  const dispatch = vi.fn(
    (_action: PlayerAction) =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<PlayerChrome model={model} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole("button", { name: "更多播放操作" }));
  await tick(40);
  fireEvent.click(screen.getByRole("menuitem", { name: /弹幕/ }));
  await tick(40);
  const slider = screen.getByRole("slider", {
    name: "弹幕透明度",
  }) as HTMLInputElement;
  for (const opacity of [0.25, 0.5, 1, 0]) {
    fireEvent.change(slider, { target: { value: String(opacity) } });
    expect(slider.disabled).toBe(false);
  }
  expect(dispatch.mock.calls.map(([action]) => action)).toEqual(
    [0.25, 0.5, 1, 0].map((opacity) => ({
      kind: "danmaku",
      command: "settings",
      patch: { opacity },
    })),
  );
  await act(async () => finish());
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
