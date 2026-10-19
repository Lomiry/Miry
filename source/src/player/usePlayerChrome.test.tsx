// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { usePlayerChrome } from "./usePlayerChrome";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.mocked(listen)
    .mockReset()
    .mockImplementation(async () => () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const tick = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
it("finishes fading before hiding and wakes from native video pointer activity", async () => {
  let native: (event: { payload: string }) => void = () => {};
  vi.mocked(listen).mockImplementation(async (_name, handler) => {
    native = handler as typeof native;
    return () => {};
  });
  const { result } = renderHook(() => usePlayerChrome(true, false, 1));
  await tick(2800);
  expect(result.current.phase).toBe("fading");
  await tick(280);
  expect(result.current.phase).toBe("hidden");
  act(() => native({ payload: "pointer" }));
  expect(result.current.phase).toBe("visible");
  await tick(3080);
  expect(result.current.phase).toBe("hidden");
});
it("keeps paused playback visible, ignores manual hide while paused, and leaves typing alone", async () => {
  const { result } = renderHook(() => usePlayerChrome(true, true, 1));
  await tick(5000);
  expect(result.current.phase).toBe("visible");
  fireEvent.keyDown(document.body, { key: "h" });
  await tick(180);
  expect(result.current.phase).toBe("visible");
  const input = document.createElement("input");
  document.body.append(input);
  fireEvent.keyDown(input, { key: "h" });
  expect(result.current.phase).toBe("visible");
  input.remove();
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(result.current.phase).toBe("visible");
});
it("holds settings, keyboard and pinned controls, but still hides under an idle pointer on the controls", async () => {
  const { result, rerender } = renderHook(
    ({ blocked }) => usePlayerChrome(true, blocked, 1, blocked),
    { initialProps: { blocked: true } },
  );
  act(() => result.current.hide());
  await tick(5000);
  expect(result.current.phase).toBe("visible");
  rerender({ blocked: false });
  act(() => result.current.hover(true));
  await tick(5000);
  expect(result.current.phase).toBe("hidden");
  act(() => result.current.hover(false));
  fireEvent.keyDown(document.body, { key: "Tab" });
  await tick(5000);
  expect(result.current.phase).toBe("visible");
  act(() => result.current.pointer());
  await tick(3080);
  expect(result.current.phase).toBe("hidden");
  act(() => result.current.pin(true));
  await tick(5000);
  expect(result.current.phase).toBe("visible");
  expect(localStorage.getItem("miry-controls-pinned")).toBe("true");
});
it("removes late native subscriptions after unmount", async () => {
  let resolve: (fn: () => void) => void = () => {};
  const remove = vi.fn();
  vi.mocked(listen).mockImplementation(
    () =>
      new Promise((fn) => {
        resolve = fn;
      }),
  );
  const { unmount } = renderHook(() => usePlayerChrome(true, false, 1));
  unmount();
  await act(async () => resolve(remove));
  expect(remove).toHaveBeenCalledOnce();
});
it("reverses an in-progress fade immediately and cancels its completion", async () => {
  const { result } = renderHook(() => usePlayerChrome(true, false, 1));
  await tick(2800);
  expect(result.current.phase).toBe("fading");
  await tick(120);
  act(() => result.current.pointer());
  expect(result.current.phase).toBe("visible");
  await tick(160);
  expect(result.current.phase).toBe("visible");
  await tick(2640);
  expect(result.current.phase).toBe("fading");
});
it("repeated pointer activity only renews idle time without replaying visible state", async () => {
  const phases: string[] = [];
  const { result } = renderHook(() => {
    const chrome = usePlayerChrome(true, false, 1);
    phases.push(chrome.phase);
    return chrome;
  });
  const renders = phases.length;
  for (let i = 0; i < 8; i++) {
    await tick(350);
    act(() => result.current.pointer());
  }
  expect(phases.length).toBe(renders);
  await tick(2799);
  expect(result.current.phase).toBe("visible");
  await tick(1);
  expect(result.current.phase).toBe("fading");
});
it("pause during fading restores controls and prevents idle hiding", async () => {
  const { result, rerender } = renderHook(
    ({ paused }) => usePlayerChrome(true, paused, 1),
    { initialProps: { paused: false } },
  );
  await tick(2800);
  expect(result.current.phase).toBe("fading");
  rerender({ paused: true });
  expect(result.current.phase).toBe("visible");
  await tick(5000);
  expect(result.current.phase).toBe("visible");
});
it("respects reduced motion without leaving invisible controls interactive", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const { result } = renderHook(() => usePlayerChrome(true, false, 1));
  await tick(2800);
  expect(result.current.phase).toBe("hidden");
  act(() => result.current.pointer());
  expect(result.current.phase).toBe("visible");
});
it("suspends timers and restores visible controls through normal show, but preserves hidden controls", async () => {
  let native: (event: { payload: string }) => void = () => {};
  vi.mocked(listen).mockImplementation(async (_name, handler) => {
    native = handler as typeof native;
    return () => {};
  });
  const { result } = renderHook(() => usePlayerChrome(true, false, 1));
  await tick(1);
  act(() => native({ payload: "suspend" }));
  expect(result.current.phase).toBe("hidden");
  await tick(5000);
  act(() => native({ payload: "resume" }));
  await tick(40);
  expect(result.current.phase).toBe("visible");
  expect(result.current.suspended).toBe(false);
  await tick(3080);
  expect(result.current.phase).toBe("hidden");
  act(() => native({ payload: "suspend" }));
  act(() => native({ payload: "resume" }));
  await tick(40);
  expect(result.current.phase).toBe("hidden");
});
