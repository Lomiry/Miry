// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WindowFrame from "./WindowFrame";
const mocks = vi.hoisted(() => ({
  native: true,
  max: false,
  full: false,
  resize: undefined as undefined | (() => void),
  remove: vi.fn(),
  minimize: vi.fn(),
  toggle: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => mocks.native }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: async () => mocks.max,
    isFullscreen: async () => mocks.full,
    onResized: async (cb: () => void) => {
      mocks.resize = cb;
      return mocks.remove;
    },
    onFocusChanged: async () => mocks.remove,
    minimize: mocks.minimize,
    toggleMaximize: mocks.toggle,
    close: mocks.close,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.native = true;
  mocks.max = false;
  mocks.full = false;
  mocks.toggle.mockImplementation(async () => {
    mocks.max = !mocks.max;
  });
  mocks.close.mockResolvedValue(undefined);
});
afterEach(cleanup);
it("prevents browser menus and image dragging while preserving input editing menus", () => {
  render(
    <WindowFrame>
      <img src="https://private.test/image?api_key=secret" alt="封面" />
      <input aria-label="用户名" />
    </WindowFrame>,
  );
  const image = screen.getByRole("img");
  expect(fireEvent.contextMenu(image)).toBe(false);
  expect(fireEvent.dragStart(image)).toBe(false);
  expect(fireEvent.contextMenu(screen.getByLabelText("用户名"))).toBe(true);
});
it("uses normal browser content without native controls", () => {
  mocks.native = false;
  render(
    <WindowFrame>
      <p>媒体库</p>
    </WindowFrame>,
  );
  expect(screen.getByText("媒体库")).toBeTruthy();
  expect(screen.queryByRole("toolbar")).toBeNull();
});
it("minimizes, maximizes, restores and requests a normal native close", async () => {
  const user = userEvent.setup();
  render(
    <WindowFrame>
      <p>媒体库</p>
    </WindowFrame>,
  );
  await user.click(screen.getByRole("button", { name: "最小化窗口" }));
  expect(mocks.minimize).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "最大化窗口" }));
  await screen.findByRole("button", { name: "还原窗口" });
  await user.click(screen.getByRole("button", { name: "还原窗口" }));
  await screen.findByRole("button", { name: "最大化窗口" });
  await user.click(screen.getByRole("button", { name: "关闭窗口" }));
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("tracks native fullscreen and releases window listeners", async () => {
  const { unmount } = render(
    <WindowFrame>
      <p>媒体库</p>
    </WindowFrame>,
  );
  await waitFor(() => expect(mocks.resize).toBeTypeOf("function"));
  mocks.full = true;
  await act(async () => mocks.resize?.());
  await waitFor(() =>
    expect(
      screen.getByText("媒体库").closest(".desktop-frame")?.className,
    ).toContain("native-fullscreen"),
  );
  mocks.full = false;
  await act(async () => mocks.resize?.());
  await waitFor(() =>
    expect(
      screen.getByText("媒体库").closest(".desktop-frame")?.className,
    ).not.toContain("native-fullscreen"),
  );
  unmount();
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});
it("shows a recoverable error when the native control fails", async () => {
  mocks.close.mockRejectedValueOnce(new Error("native closed"));
  const user = userEvent.setup();
  render(
    <WindowFrame>
      <p>媒体库</p>
    </WindowFrame>,
  );
  await user.click(screen.getByRole("button", { name: "关闭窗口" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "窗口操作未完成，请重试。",
  );
  expect(screen.getByRole("button", { name: "关闭窗口" })).toHaveProperty(
    "disabled",
    false,
  );
});
