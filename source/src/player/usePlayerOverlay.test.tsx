// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { usePlayerOverlay } from "./usePlayerOverlay";
import { usePlayerChrome } from "./usePlayerChrome";
import type { PlayerUiModel } from "./uiModel";
import { danmakuDefaults, type DanmakuClock } from "../danmaku/types";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => {}),
  listen: vi.fn(async () => () => {}),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("transfers bounded danmaku data once per document/readiness while clock and chrome update independently", async () => {
  const handlers = new Map<string, (e: unknown) => unknown>();
  vi.mocked(listen).mockImplementation(async (name, handler) => {
    handlers.set(name, handler as never);
    return () => {};
  });
  const model = {
    state: { tracks: [] },
    error: "",
    danmaku: {
      name: "local.xml",
      count: 1,
      skipped: 0,
      status: "",
      settings: danmakuDefaults,
      offset: 0,
      bound: true,
    },
  } as unknown as PlayerUiModel;
  const document = { entries: [], skipped: 0, format: "XML" as const };
  const clock: DanmakuClock = {
    position: 1,
    sampledAt: 1,
    paused: false,
    speed: 1,
    active: true,
    loaded: true,
    buffering: false,
    session: "s",
  };
  const view = renderHook(
    ({ presentation, position }) =>
      usePlayerOverlay(true, presentation, vi.fn(), {
        document,
        clock: { ...clock, position },
      }),
    { initialProps: { presentation: model, position: 1 } },
  );
  await act(async () => {});
  await act(async () => {
    handlers.get("player-ui-ready")!({});
  });
  const data = () =>
    vi
      .mocked(emitTo)
      .mock.calls.filter(([, event]) => event === "player-danmaku-data");
  expect(data()).toHaveLength(1);
  view.rerender({ presentation: { ...model, revision: 2 }, position: 2 });
  expect(data()).toHaveLength(1);
  expect(emitTo).toHaveBeenCalledWith(
    "player-ui",
    "player-danmaku-clock",
    expect.objectContaining({ position: 2 }),
  );
  await act(async () => {
    handlers.get("player-ui-ready")!({});
  });
  expect(data()).toHaveLength(2);
});
it("registers listeners before pinging a reused UI and releases every listener even if they resolve after unmount", async () => {
  let resolve!: (fn: () => void) => void;
  const remove = vi.fn();
  vi.mocked(listen).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }) as never,
  );
  const { unmount } = renderHook(() => usePlayerOverlay(true, null, vi.fn()));
  expect(emitTo).not.toHaveBeenCalled();
  unmount();
  await act(async () => resolve(remove));
  expect(remove).toHaveBeenCalledOnce();
  expect(emitTo).not.toHaveBeenCalledWith("player-ui", "player-ui-ping", {});
});
it("forwards UI return exactly once to the current owner and acknowledges without directly stopping mpv", async () => {
  const handlers = new Map<string, (e: unknown) => unknown>();
  const remove = vi.fn();
  vi.mocked(listen).mockImplementation(async (name, handler) => {
    handlers.set(name, handler as never);
    return remove;
  });
  const first = vi.fn(),
    latest = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(
    ({ action }) => usePlayerOverlay(true, null, action),
    { initialProps: { action: first } },
  );
  await act(async () => {});
  expect(emitTo).toHaveBeenCalledWith("player-ui", "player-ui-ping", {});
  await act(async () => {
    handlers.get("player-ui-focus")!({});
  });
  expect(invoke).toHaveBeenCalledWith("player_overlay_focus");
  view.rerender({ action: latest });
  await act(async () => {
    await handlers.get("player-ui-action")!({
      payload: { id: "test", action: { kind: "return" } },
    });
  });
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
  expect(emitTo).toHaveBeenCalledWith("player-ui", "player-ui-result", {
    id: "test",
    error: "",
  });
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(5);
});
it("never acknowledges an old return request in a new UI", async () => {
  let handler!: (e: unknown) => Promise<void>;
  vi.mocked(listen).mockImplementation(async (name, fn) => {
    if (name === "player-ui-action") handler = fn as never;
    return () => {};
  });
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>((r) => (finish = r)));
  const { unmount } = renderHook(() => usePlayerOverlay(true, null, action));
  await act(async () => {});
  let request!: Promise<void>;
  await act(async () => {
    request = handler({
      payload: { id: "return", action: { kind: "return" } },
    });
  });
  unmount();
  await act(async () => {
    finish();
    await request;
  });
  expect(emitTo).not.toHaveBeenCalledWith("player-ui", "player-ui-result", {
    id: "return",
    error: "",
  });
});
it("preserves playback keys when the main native WebView still has focus and leaves editable fields alone", async () => {
  vi.mocked(listen).mockImplementation(async () => () => {});
  const view = renderHook(() => usePlayerOverlay(true, null, vi.fn()));
  await act(async () => {});
  vi.mocked(emitTo).mockClear();
  const input = document.createElement("input");
  document.body.append(input);
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", bubbles: true }),
  );
  expect(emitTo).not.toHaveBeenCalled();
  await act(async () =>
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(emitTo).toHaveBeenCalledWith("player-ui", "player-ui-key", {
    key: " ",
    code: "Space",
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  });
  view.unmount();
  vi.mocked(emitTo).mockClear();
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", bubbles: true }),
  );
  expect(emitTo).not.toHaveBeenCalled();
  input.remove();
});
it("routes native controls once to the owned window without feedback or a double H toggle", async () => {
  const handlers: {
    name: string;
    target: unknown;
    fn: (e: unknown) => unknown;
  }[] = [];
  vi.mocked(listen).mockImplementation(async (name, fn, options) => {
    const handler = { name, target: options?.target, fn: fn as never };
    handlers.push(handler);
    return () => handlers.splice(handlers.indexOf(handler), 1);
  });
  let sends = 0;
  vi.mocked(emitTo).mockImplementation(async (target, name, payload) => {
    if (name === "player-controls" && ++sends > 8) return;
    for (const h of [...handlers]) {
      if (h.name === name && (!h.target || h.target === target))
        await h.fn({ payload });
    }
  });
  const { result, unmount } = renderHook(() => {
    usePlayerOverlay(true, null, vi.fn());
    return usePlayerChrome(true, false, 1, false, "player-ui");
  });
  await act(async () => {});
  await act(async () => emitTo("main", "player-controls", "toggle"));
  expect(sends).toBe(2);
  expect(result.current.phase).toBe("fading");
  expect(
    handlers.filter((h) => h.name === "player-controls").map((h) => h.target),
  ).toEqual(["main", "player-ui"]);
  unmount();
  expect(handlers.length).toBe(0);
});
