// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SecondarySubtitlePosition, {
  subtitlePositionAt,
} from "./SecondarySubtitlePosition";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
it.each([
  [0, 20, 400, 0],
  [220, 20, 400, 50],
  [620, 20, 400, 100],
  [155, 20, 270, 50],
  [1440, 0, 1440, 100],
  [20, 0, 0, 0],
])(
  "maps pointer %s relative to top %s / height %s to %s percent",
  (y, top, height, expected) => {
    expect(subtitlePositionAt(y, top, height)).toBe(expected);
  },
);
it("previews continuously while dragging, clamps outside the viewport and commits only on confirmation", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 40,
    height: 400,
  } as DOMRect);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  const send = vi.fn().mockResolvedValue(undefined),
    close = vi.fn();
  render(<SecondarySubtitlePosition value={20} send={send} onClose={close} />);
  const handle = screen.getByRole("slider");
  fireEvent.pointerDown(handle, { button: 0, clientY: 120 });
  fireEvent.pointerMove(handle, { clientY: 240 });
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
  await tick();
  expect(send).toHaveBeenLastCalledWith(50, false);
  fireEvent.pointerMove(handle, { clientY: 900 });
  fireEvent.pointerUp(handle, { clientY: 900 });
  await tick();
  expect(send).toHaveBeenLastCalledWith(100, false);
  fireEvent.click(screen.getByText("确认位置"));
  await act(async () => {});
  expect(send).toHaveBeenLastCalledWith(100, true);
  expect(close).toHaveBeenCalledOnce();
});
it.each(["取消", "Escape"])(
  "restores the captured original after reset using %s",
  async (action) => {
    const send = vi.fn().mockResolvedValue(undefined),
      close = vi.fn();
    const view = render(
      <SecondarySubtitlePosition value={37} send={send} onClose={close} />,
    );
    fireEvent.click(screen.getByText("恢复默认"));
    await tick();
    expect(send).toHaveBeenLastCalledWith(0, false);
    // Native snapshots may now contain the preview, but cancellation keeps the original.
    view.rerender(
      <SecondarySubtitlePosition value={0} send={send} onClose={close} />,
    );
    if (action === "Escape")
      fireEvent.keyDown(screen.getByRole("slider"), { key: "Escape" });
    else fireEvent.click(screen.getByText(action));
    await act(async () => {});
    expect(send).toHaveBeenLastCalledWith(37, false);
    expect(send.mock.calls.every(([, persist]) => persist === false)).toBe(
      true,
    );
    expect(close).toHaveBeenCalledOnce();
  },
);
it("waits for an in-flight preview before cancelling and discards queued previews", async () => {
  let resolve!: () => void;
  const send = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(undefined);
  render(
    <SecondarySubtitlePosition value={25} send={send} onClose={vi.fn()} />,
  );
  fireEvent.keyDown(screen.getByRole("slider"), { key: "End" });
  await tick();
  fireEvent.keyDown(screen.getByRole("slider"), { key: "Home" });
  fireEvent.click(screen.getByText("取消"));
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(send.mock.calls).toEqual([
    [100, false],
    [25, false],
  ]);
});
it("retains the editor on failure, supports retry and cancels queued work on unmount", async () => {
  const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue(undefined),
    close = vi.fn();
  const view = render(
    <SecondarySubtitlePosition value={25} send={send} onClose={close} />,
  );
  fireEvent.click(screen.getByText("确认位置"));
  await act(async () => {});
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowDown" });
  await tick();
  expect(send).toHaveBeenLastCalledWith(26, false);
  fireEvent.keyDown(screen.getByRole("slider"), { key: "Home" });
  view.unmount();
  await tick();
  expect(send).toHaveBeenCalledTimes(2);
});
