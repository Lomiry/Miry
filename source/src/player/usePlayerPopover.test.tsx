// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePlayerPopover } from "./usePlayerPopover";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    setTimeout(() => fn(0), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const tick = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
it("outside dismissal preserves the newly clicked search focus after the close animation", async () => {
  const button = document.createElement("button"),
    input = document.createElement("input");
  document.body.append(button, input);
  const { result } = renderHook(usePlayerPopover);
  act(() => result.current.open("danmaku", button));
  await tick(32);
  act(() => result.current.close(false));
  input.focus();
  expect(document.activeElement).toBe(input);
  await tick(120);
  expect(document.activeElement).toBe(input);
  expect(result.current.menu).toBeNull();
  button.remove();
  input.remove();
});
it("keeps the closing panel mounted until its 120ms fade ends and restores its anchor", async () => {
  const button = document.createElement("button");
  document.body.append(button);
  const focus = vi.spyOn(button, "focus");
  const { result } = renderHook(usePlayerPopover);
  act(() => result.current.open("subtitle", button));
  expect(result.current.phase).toBe("opening");
  await tick(32);
  expect(result.current.phase).toBe("open");
  act(() => result.current.close());
  expect(result.current.menu).toBe("subtitle");
  await tick(119);
  expect(result.current.menu).toBe("subtitle");
  await tick(1);
  expect(result.current.menu).toBeNull();
  expect(focus).toHaveBeenCalledOnce();
  button.remove();
});
it("reverses a closing panel immediately without the stale close timer removing it", async () => {
  const { result } = renderHook(usePlayerPopover);
  act(() => result.current.open("audio"));
  await tick(32);
  act(() => result.current.close());
  await tick(60);
  act(() => result.current.open("audio"));
  expect(result.current.phase).toBe("open");
  await tick(180);
  expect(result.current.menu).toBe("audio");
});
it("animates nested menus and cancels obsolete animation frames when changing quickly", async () => {
  const { result } = renderHook(usePlayerPopover);
  act(() => result.current.open("more"));
  await tick(32);
  act(() => result.current.open("speed"));
  expect(result.current.phase).toBe("opening");
  act(() => result.current.open("routes"));
  await tick(32);
  expect(result.current.menu).toBe("routes");
  expect(result.current.phase).toBe("open");
});
it("does not let an interrupted opening frame overwrite the closing phase", async () => {
  const { result } = renderHook(usePlayerPopover);
  act(() => result.current.open("subtitle"));
  await tick(10);
  act(() => result.current.close());
  await tick(35);
  expect(result.current.phase).toBe("closing");
  await tick(85);
  expect(result.current.menu).toBeNull();
});
it("respects reduced motion and cancels its pending work on unmount", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const { result, unmount } = renderHook(usePlayerPopover);
  act(() => result.current.open("more"));
  act(() => result.current.close());
  await tick(0);
  expect(result.current.menu).toBeNull();
  act(() => result.current.open("audio"));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
