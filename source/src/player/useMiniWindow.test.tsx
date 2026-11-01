// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMiniWindow, type MiniPresentation } from "./useMiniWindow";
import { readSettings, saveSettings } from "../stores/settings";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
let handler: (event: { payload: MiniPresentation }) => void;
let revision = 0;
const remove = vi.fn();
beforeEach(() => {
  revision = 0;
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(invoke).mockImplementation(async (_name, args) => ({
    session: (args as { playSessionId: string }).playSessionId,
    active: (args as { command: string }).command !== "leave",
    revision: ++revision,
  }));
  vi.mocked(listen).mockImplementation(async (_name, callback) => {
    handler = callback as typeof handler;
    return remove;
  });
});
afterEach(cleanup);
it("projects a new media session into the same active Mini without an intermediate inactive render", async () => {
  const phases: boolean[] = [];
  const view = renderHook(
    ({ session, native }) => {
      const mini = useMiniWindow(session, native);
      phases.push(mini.active);
      return mini;
    },
    {
      initialProps: {
        session: "one",
        native: { session: "one", active: true, revision: 1 },
      },
    },
  );
  phases.length = 0;
  view.rerender({
    session: "two",
    native: { session: "two", active: true, revision: 2 },
  });
  expect(phases.every(Boolean)).toBe(true);
  expect(view.result.current.active).toBe(true);
  act(() =>
    handler({ payload: { session: "one", active: false, revision: 1 } }),
  );
  expect(view.result.current.active).toBe(true);
});
it("ignores delayed transitions and acknowledgements from a prior mini window in the same session", async () => {
  const view = renderHook(() => useMiniWindow("one"));
  await act(async () => view.result.current.action("enter", "one"));
  act(() =>
    handler({ payload: { session: "one", active: false, revision: 2 } }),
  );
  act(() =>
    handler({ payload: { session: "one", active: true, revision: 3 } }),
  );
  expect(view.result.current.active).toBe(true);
  act(() =>
    handler({ payload: { session: "one", active: false, revision: 2 } }),
  );
  expect(view.result.current.active).toBe(true);
  vi.mocked(invoke).mockResolvedValueOnce({
    session: "one",
    active: true,
    revision: 1,
  });
  await act(async () => view.result.current.action("enter", "one"));
  expect(view.result.current.active).toBe(true);
});
it.each([false, true])(
  "does not change saved danmaku preference %s on entry/leave/reentry",
  async (enabled) => {
    const settings = readSettings();
    settings.danmaku!.enabled = enabled;
    saveSettings(settings);
    const stored = localStorage.getItem("miry-settings");
    const view = renderHook(() => useMiniWindow("one"));
    await act(async () => view.result.current.action("enter", "one"));
    expect(view.result.current.active).toBe(true);
    expect(view.result.current).not.toHaveProperty("setEnabled");
    await act(async () => view.result.current.action("leave", "one"));
    expect(view.result.current.active).toBe(false);
    expect(readSettings().danmaku!.enabled).toBe(enabled);
    await act(async () => view.result.current.action("enter", "one"));
    expect(view.result.current.active).toBe(true);
    expect(localStorage.getItem("miry-settings")).toBe(stored);
    expect(
      vi.mocked(invoke).mock.calls.every(([name]) => name === "player_mini"),
    ).toBe(true);
  },
);
it("ignores old session results and late native events and cleans up its listener", async () => {
  let resolve!: (value: MiniPresentation) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = renderHook(({ session }) => useMiniWindow(session), {
    initialProps: { session: "one" },
  });
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.action("enter", "one");
  });
  view.rerender({ session: "two" });
  await act(async () => {
    resolve({ session: "one", active: true, revision: 1 });
    await pending;
  });
  act(() =>
    handler({ payload: { session: "one", active: true, revision: 1 } }),
  );
  expect(view.result.current.active).toBe(false);
  await act(async () => view.result.current.action("enter", "two"));
  act(() =>
    handler({ payload: { session: "one", active: false, revision: 2 } }),
  );
  expect(view.result.current.active).toBe(true);
  view.unmount();
  expect(remove).toHaveBeenCalledOnce();
});
it("does not enter on native failure or submit an action for a previous session", async () => {
  const view = renderHook(() => useMiniWindow("two"));
  await view.result.current.action("enter", "one");
  expect(invoke).not.toHaveBeenCalled();
  vi.mocked(invoke).mockRejectedValueOnce(new Error("native failure"));
  await act(async () => {
    await expect(view.result.current.action("enter", "two")).rejects.toThrow();
  });
  expect(view.result.current.active).toBe(false);
});
