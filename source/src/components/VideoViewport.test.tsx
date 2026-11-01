// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import VideoViewport from "./VideoViewport";
import { StrictMode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    scaleFactor: async () => 1,
    onScaleChanged: async () => () => {},
  })),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => 1),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("detaches only the main DOM anchor in Mini and retains native ownership until real unmount", async () => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    bottom: 360,
  } as DOMRect);
  vi.mocked(invoke).mockImplementation(async () => 1);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  const view = render(<VideoViewport visible controls />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: expect.objectContaining({ width: 640, visible: true }),
    }),
  );
  vi.mocked(invoke).mockClear();
  view.rerender(<VideoViewport visible controls detached />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: expect.objectContaining({ width: 0, visible: false }),
    }),
  );
  expect(view.container.querySelector(".video-viewport")).toBeNull();
  expect(
    vi
      .mocked(invoke)
      .mock.calls.some(
        ([name]) =>
          name === "player_overlay_release" || name === "player_overlay_attach",
      ),
  ).toBe(false);
  view.rerender(<VideoViewport visible controls />);
  expect(view.container.querySelector(".video-viewport")).toBeTruthy();
  expect(
    vi
      .mocked(invoke)
      .mock.calls.some(([name]) => name === "player_overlay_release"),
  ).toBe(false);
  view.unmount();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      "player_overlay_release",
      expect.anything(),
    ),
  );
});
it("keeps pending surface work ordered across StrictMode and a new session", async () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    bottom: 360,
  } as DOMRect);
  const listeners = new Set<symbol>();
  const subscribe = async () => {
    const token = Symbol();
    listeners.add(token);
    await Promise.resolve();
    return () => {
      listeners.delete(token);
    };
  };
  vi.mocked(getCurrentWindow).mockReturnValue({
    scaleFactor: async () => 1,
    onMoved: subscribe,
    onResized: subscribe,
    onScaleChanged: subscribe,
  } as unknown as ReturnType<typeof getCurrentWindow>);
  let owner = "",
    finish!: () => void,
    held = false;
  const accepted: string[] = [],
    surfaces: boolean[] = [];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    const value = args as { owner: string; rect: { visible: boolean } };
    if (command === "player_overlay_attach") owner = value.owner;
    if (command === "player_overlay_release" && owner === value.owner)
      owner = "";
    if (command === "player_surface") {
      if (value.rect.visible && !held) {
        held = true;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      }
      surfaces.push(value.rect.visible);
    }
    if (
      command === "player_overlay" &&
      value.owner === owner &&
      value.rect.visible
    )
      accepted.push(owner);
    return 1;
  });
  const view = render(
    <StrictMode>
      <VideoViewport key="a" visible controls />
    </StrictMode>,
  );
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  const old = owner;
  view.rerender(
    <StrictMode>
      <VideoViewport key="b" visible controls />
    </StrictMode>,
  );
  await waitFor(() => expect(owner).not.toBe(old));
  const current = owner;
  await act(async () => finish());
  await waitFor(() => expect(accepted).toEqual([current]));
  expect(owner).toBe(current);
  expect(surfaces.at(-1)).toBe(true);
  expect(listeners.size).toBe(3);
  view.rerender(
    <StrictMode>
      <VideoViewport key="b" visible controls />
    </StrictMode>,
  );
  await act(async () => {});
  expect(owner).toBe(current);
  expect(accepted).toEqual([current]);
  view.unmount();
  await waitFor(() => expect(listeners.size).toBe(0));
  await waitFor(() => expect(surfaces.at(-1)).toBe(false));
  expect(owner).toBe("");
  vi.mocked(invoke).mockImplementation(async () => 1);
});
it("releases the owned overlay immediately while a stale surface operation is pending", async () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    bottom: 400,
  } as DOMRect);
  let finish!: () => void;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (
      command === "player_surface" &&
      (args as { rect: { visible: boolean } }).rect.visible
    )
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    return 1;
  });
  const view = render(<VideoViewport visible controls />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  const attach = vi
    .mocked(invoke)
    .mock.calls.find(([command]) => command === "player_overlay_attach")!;
  view.unmount();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay_release", attach[1]),
  );
  finish();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: { x: 0, y: 0, width: 0, height: 0, visible: false },
    }),
  );
  expect(invoke).not.toHaveBeenCalledWith(
    "player_overlay",
    expect.objectContaining({
      rect: expect.objectContaining({ visible: true }),
    }),
  );
  vi.mocked(invoke).mockImplementation(async () => 1);
});
it.each([1, 1.5])(
  "converts zoomed CSS pixels to window logical units without double scaling system DPI %s",
  async (nativeScale) => {
    vi.stubGlobal("devicePixelRatio", 1.5);
    vi.mocked(getCurrentWindow).mockReturnValue({
      scaleFactor: async () => nativeScale,
      onScaleChanged: async () => () => {},
    } as unknown as ReturnType<typeof getCurrentWindow>);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 20,
      y: 64,
      width: 640,
      height: 360,
      bottom: 424,
    } as DOMRect);
    render(<VideoViewport visible />);
    const ratio = 1.5 / nativeScale;
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("player_surface", {
        rect: {
          x: Math.round(20 * ratio),
          y: Math.round(64 * ratio),
          width: Math.round(640 * ratio),
          height: Math.round(360 * ratio),
          visible: true,
        },
      }),
    );
  },
);
it("keeps the video visible when fullscreen moves its top edge to zero", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1000,
    height: 600,
    bottom: 600,
  } as DOMRect);
  render(<VideoViewport visible />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: { x: 0, y: 0, width: 1000, height: 600, visible: true },
    }),
  );
});
it("places video in the measured region and hides it for modal overlays", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 20,
    y: 64,
    width: 640,
    height: 360,
    bottom: 424,
  } as DOMRect);
  const view = render(<VideoViewport visible />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: { x: 20, y: 64, width: 640, height: 360, visible: true },
    }),
  );
  view.rerender(<VideoViewport visible={false} />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_surface", {
      rect: { x: 20, y: 64, width: 640, height: 360, visible: false },
    }),
  );
});
it("repositions the UI on window movement without resizing the native video", async () => {
  let moved!: () => void;
  const remove = vi.fn();
  vi.mocked(getCurrentWindow).mockReturnValue({
    scaleFactor: async () => 1,
    onMoved: async (fn: () => void) => {
      moved = fn;
      return remove;
    },
    onScaleChanged: async () => () => {},
  } as never);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 40,
    width: 1000,
    height: 500,
    bottom: 540,
  } as DOMRect);
  const view = render(<VideoViewport visible controls />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay", {
      owner: expect.any(String),
      rect: { x: 0, y: 40, width: 1000, height: 500, visible: true },
    }),
  );
  vi.mocked(invoke).mockClear();
  moved();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay", expect.anything()),
  );
  expect(invoke).not.toHaveBeenCalledWith("player_surface", expect.anything());
  view.unmount();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay_release", {
      owner: expect.any(String),
    }),
  );
  expect(remove).toHaveBeenCalledOnce();
});
it("hides the controls overlay without changing the video rect when an external modal takes over", async () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 40,
    width: 1000,
    height: 500,
    bottom: 540,
  } as DOMRect);
  const view = render(<VideoViewport visible controls />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      "player_overlay",
      expect.objectContaining({
        rect: expect.objectContaining({ visible: true }),
      }),
    ),
  );
  vi.mocked(invoke).mockClear();
  view.rerender(<VideoViewport visible controls={false} />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay", {
      owner: expect.any(String),
      rect: { x: 0, y: 40, width: 1000, height: 500, visible: false },
    }),
  );
  expect(invoke).not.toHaveBeenCalledWith("player_surface", expect.anything());
});

it("reprojects unchanged bounds after tray restore and releases late subscriptions on unmount", async () => {
  let restore!: () => void;
  let resolveListen!: (remove: () => void) => void;
  const remove = vi.fn();
  vi.mocked(listen).mockImplementationOnce((_name, callback) => {
    restore = callback as () => void;
    return new Promise((resolve) => {
      resolveListen = resolve;
    });
  });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout.bind(window));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 40,
    width: 1000,
    height: 500,
    bottom: 540,
  } as DOMRect);
  const view = render(<VideoViewport visible controls />);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_overlay", expect.anything()),
  );
  const owner = vi
    .mocked(invoke)
    .mock.calls.find(([c]) => c === "player_overlay_attach")![1];
  vi.mocked(invoke).mockClear();
  restore();
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      "player_overlay",
      expect.objectContaining(owner!),
    ),
  );
  expect(invoke).not.toHaveBeenCalledWith(
    "player_overlay_attach",
    expect.anything(),
  );
  view.unmount();
  resolveListen(remove);
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  vi.mocked(invoke).mockClear();
  restore();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(invoke).not.toHaveBeenCalledWith("player_overlay", expect.anything());
});
