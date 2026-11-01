// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePlayerCursor } from "./usePlayerCursor";
const native = vi.hoisted(() => ({
  setCursorVisible: vi.fn(async (_visible: boolean) => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => native }));
afterEach(() => {
  cleanup();
  native.setCursorVisible.mockReset().mockResolvedValue(undefined);
});
it("serializes Hide/Show and restores only its owned native window on disposal", async () => {
  let finish!: () => void;
  native.setCursorVisible.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const view = renderHook(({ hidden }) => usePlayerCursor(true, hidden), {
    initialProps: { hidden: true },
  });
  await act(async () => {});
  view.rerender({ hidden: false });
  expect(native.setCursorVisible.mock.calls.map((c) => c[0])).toEqual([false]);
  await act(async () => finish());
  expect(native.setCursorVisible.mock.calls.at(-1)).toEqual([true]);
  view.unmount();
  await act(async () => {});
  expect(native.setCursorVisible.mock.calls.at(-1)).toEqual([true]);
});
it("does not change a main or another application's cursor", async () => {
  renderHook(() => usePlayerCursor(false, true));
  await act(async () => {});
  expect(native.setCursorVisible).not.toHaveBeenCalled();
});
