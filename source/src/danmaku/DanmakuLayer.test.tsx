// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DanmakuLayer from "./DanmakuLayer";
import { danmakuDefaults as DEFAULT_DANMAKU } from "./types";
import type { DanmakuClock, DanmakuDocument } from "./types";
import { setLanguage } from "../i18n/core";
import { useI18n } from "../i18n/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLanguage("zh-CN", false);
});
it("renders from the latest native anchor, freezes on pause, seeks and releases its single canvas", () => {
  let tick: FrameRequestCallback = () => {};
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    tick = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  const context = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    measureText: () => ({ width: 80 }),
    strokeText: vi.fn(),
    fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as never,
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getBoundingClientRect",
  ).mockReturnValue({ width: 800, height: 450 } as DOMRect);
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const doc: DanmakuDocument = {
    format: "XML",
    entries: [
      {
        time: 1,
        duration: 8,
        mode: "scroll",
        color: "#ffffff",
        text: "同步",
      },
    ],
    skipped: 0,
  };
  const clock: DanmakuClock = {
    position: 1,
    sampledAt: 1000,
    session: "s:1",
    paused: false,
    speed: 1,
    active: true,
    loaded: true,
    buffering: false,
  };
  const LocalizedLayer = ({
    currentClock,
    opacity = DEFAULT_DANMAKU.opacity,
  }: {
    currentClock: DanmakuClock;
    opacity?: number;
  }) => {
    useI18n();
    return (
      <DanmakuLayer
        document={doc}
        settings={{ ...DEFAULT_DANMAKU, opacity }}
        clock={currentClock}
      />
    );
  };
  const view = render(<LocalizedLayer currentClock={clock} />);
  act(() => tick(0));
  expect(view.container.querySelector("canvas")!.dataset.playbackTime).toBe(
    "1.000",
  );
  const canvas = view.container.querySelector("canvas");
  const processed = canvas!.dataset.processed;
  act(() => setLanguage("en-US"));
  act(() => tick(8));
  expect(view.container.querySelector("canvas")).toBe(canvas);
  expect(canvas!.dataset.processed).toBe(processed);
  expect(context.setTransform).toHaveBeenCalledOnce();
  expect(disconnect).not.toHaveBeenCalled();
  expect(context.fillText).toHaveBeenCalledWith(
    "同步",
    expect.any(Number),
    expect.any(Number),
  );
  act(() => setLanguage("zh-CN"));
  expect(context.setTransform).toHaveBeenCalledOnce();
  // Continue the existing pause/seek lifecycle on the same mounted layer.
  view.rerender(
    <LocalizedLayer currentClock={{ ...clock, position: 1.2, paused: true }} />,
  );
  act(() => tick(16));
  expect(view.container.querySelector("canvas")!.dataset.playbackTime).toBe(
    "1.200",
  );
  const paints = context.fillText.mock.calls.length;
  vi.spyOn(Date, "now").mockReturnValue(2000);
  act(() => tick(32));
  expect(context.fillText).toHaveBeenCalledTimes(paints);
  const transformCalls = context.setTransform.mock.calls.length;
  const frozenX = context.fillText.mock.calls.at(-1)?.[1];
  for (const opacity of [0, 0.25, 0.5, 1]) {
    view.rerender(
      <LocalizedLayer
        opacity={opacity}
        currentClock={{ ...clock, position: 1.2, paused: true }}
      />,
    );
    act(() => tick(40));
    expect((context as unknown as { globalAlpha: number }).globalAlpha).toBe(
      opacity,
    );
    expect(context.fillText.mock.calls.at(-1)?.[1]).toBe(frozenX);
    expect(context.setTransform).toHaveBeenCalledTimes(transformCalls);
    expect(disconnect).not.toHaveBeenCalled();
  }
  view.rerender(
    <LocalizedLayer
      currentClock={{ ...clock, position: 30, paused: true, session: "s:2" }}
    />,
  );
  act(() => tick(48));
  expect(view.container.querySelector("canvas")!.dataset.activeCount).toBe("0");
  expect(view.container.children).toHaveLength(1);
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalledOnce();
});
