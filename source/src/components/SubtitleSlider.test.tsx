// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SubtitleSlider from "./SubtitleSlider";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("previews during drag at a bounded rate and persists only the final value", async () => {
  vi.useFakeTimers();
  const send = vi.fn().mockResolvedValue(undefined);
  render(
    <SubtitleSlider
      label="位置"
      value={100}
      min={0}
      max={100}
      disabled={false}
      send={send}
    />,
  );
  const slider = screen.getByRole("slider");
  for (let i = 0; i < 30; i++) {
    fireEvent.change(slider, { target: { value: String(i) } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
  }
  expect(send.mock.calls.length).toBeLessThanOrEqual(6);
  expect(send.mock.calls.length).toBeGreaterThan(1);
  expect(send.mock.calls.every((c) => c[1] === false)).toBe(true);
  fireEvent.pointerUp(slider);
  await act(async () => {});
  expect(send).toHaveBeenLastCalledWith(29, true);
  expect(send.mock.calls.filter((c) => c[1])).toHaveLength(1);
});
it("coalesces pending requests and cancels queued work on unmount", async () => {
  vi.useFakeTimers();
  let done!: () => void;
  const send = vi.fn(() => new Promise<void>((r) => (done = r)));
  const { unmount } = render(
    <SubtitleSlider
      label="位置"
      value={100}
      min={0}
      max={100}
      disabled={false}
      send={send}
    />,
  );
  fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "40" } });
  fireEvent.pointerUp(screen.getByRole("slider"));
  expect(send).toHaveBeenCalledOnce();
  unmount();
  await act(async () => done());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(send).toHaveBeenCalledOnce();
});
