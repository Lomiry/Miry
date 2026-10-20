// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  act,
  fireEvent,
} from "@testing-library/react";
import PlayerOverlayWindow from "./PlayerOverlayWindow";
import { emitTo, listen } from "@tauri-apps/api/event";
vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => {}),
  listen: vi.fn(async () => () => {}),
}));
vi.mock("./PlayerChrome", () => ({
  default: ({ dispatch }: { dispatch: (a: unknown) => Promise<void> }) => (
    <div>
      <input aria-label="测试编辑框" />
      <button onClick={() => void dispatch({ kind: "return" })}>
        测试退出
      </button>
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("announces readiness after listening, forwards return only to main and accepts its acknowledgement", async () => {
  const handlers = new Map<string, (e: unknown) => void>();
  const remove = vi.fn();
  vi.mocked(listen).mockImplementation(async (name, fn) => {
    handlers.set(name, fn as never);
    return remove;
  });
  const view = render(<PlayerOverlayWindow />);
  await act(async () => {});
  expect(emitTo).toHaveBeenCalledWith("main", "player-ui-ready", {});
  act(() => handlers.get("player-ui-state")!({ payload: {} }));
  const input = screen.getByLabelText("测试编辑框");
  act(() => input.focus());
  expect(emitTo).toHaveBeenCalledWith("main", "player-ui-focus", {});
  const key = vi.fn();
  document.body.addEventListener("keydown", key);
  act(() =>
    handlers.get("player-ui-key")!({ payload: { key: " ", code: "Space" } }),
  );
  expect(key).not.toHaveBeenCalled();
  fireEvent.pointerDown(input);
  act(() =>
    handlers.get("player-ui-key")!({
      payload: { key: "Escape", code: "Escape" },
    }),
  );
  expect(key).toHaveBeenCalledOnce();
  document.body.removeEventListener("keydown", key);
  await act(async () => screen.getByRole("button").click());
  expect(emitTo).toHaveBeenCalledWith("main", "player-ui-action", {
    id: "1",
    action: { kind: "return" },
  });
  act(() =>
    handlers.get("player-ui-result")!({ payload: { id: "1", error: "" } }),
  );
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(8);
});
it("unmounts all player visuals and settles pending actions on disposal", async () => {
  const handlers = new Map<string, (e: unknown) => void>();
  vi.mocked(listen).mockImplementation(async (name, fn) => {
    handlers.set(name, fn as never);
    return () => {};
  });
  render(<PlayerOverlayWindow />);
  await act(async () => {});
  act(() => handlers.get("player-ui-state")!({ payload: {} }));
  await act(async () => screen.getByRole("button").click());
  await act(async () => handlers.get("player-ui-dispose")!({ payload: null }));
  expect(screen.queryByRole("button")).toBeNull();
  expect(document.querySelector(".player-overlay-root")).toBeNull();
  act(() =>
    handlers.get("player-ui-result")!({ payload: { id: "1", error: "" } }),
  );
  expect(screen.queryByRole("button")).toBeNull();
});
it("routes native forwarded keys to the position editor without sending focus to transport", async () => {
  const handlers = new Map<string, (e: unknown) => void>();
  vi.mocked(listen).mockImplementation(async (name, fn) => {
    handlers.set(name, fn as never);
    return () => {};
  });
  render(<PlayerOverlayWindow />);
  await act(async () => {});
  act(() => handlers.get("player-ui-state")!({ payload: {} }));
  const editor = document.createElement("div");
  editor.className = "secondary-subtitle-position";
  const handle = document.createElement("button");
  handle.setAttribute("role", "slider");
  editor.append(handle);
  document.body.append(editor);
  const key = vi.fn();
  handle.addEventListener("keydown", key);
  try {
    act(() =>
      handlers.get("player-ui-key")!({
        payload: { key: "Escape", code: "Escape" },
      }),
    );
    expect(key).toHaveBeenCalledOnce();
    act(() => handle.focus());
    act(() =>
      handlers.get("player-ui-key")!({ payload: { key: "Tab", code: "Tab" } }),
    );
    expect(key).toHaveBeenCalledTimes(2);
    const confirm = document.createElement("button");
    const click = vi.fn();
    confirm.addEventListener("click", click);
    editor.append(confirm);
    act(() => confirm.focus());
    for (const [key, code] of [
      ["Enter", "Enter"],
      [" ", "Space"],
    ])
      act(() => handlers.get("player-ui-key")!({ payload: { key, code } }));
    expect(click).toHaveBeenCalledTimes(2);
  } finally {
    editor.remove();
  }
});
