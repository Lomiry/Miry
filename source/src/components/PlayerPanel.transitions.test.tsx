// @vitest-environment jsdom
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import PlayerPanel from "./PlayerPanel";
import { usePlayerOverlay } from "../player/usePlayerOverlay";
import type { PlayerAction, PlayerUiModel } from "../player/uiModel";
import type { PlayerSnapshot } from "../player/playback";
import { danmakuDefaults } from "../danmaku/types";
const native = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
  emitTo: vi.fn(),
}));
vi.mock("../player/usePlayerOverlay", () => ({
  usePlayerOverlay: vi.fn(() => true),
}));
vi.mock("../danmaku/useDanmaku", () => ({
  default: () => ({
    document: null,
    metadata: { settings: danmakuDefaults },
    action: vi.fn(),
  }),
}));
vi.mock("../danmaku/useDanmakuClock", () => ({ default: () => null }));
vi.mock("../danmaku/DanmakuLayer", () => ({ default: () => null }));
vi.mock("./VideoViewport", () => ({
  default: () => {
    useEffect(() => {
      native.mounts++;
      return () => {
        native.unmounts++;
      };
    }, []);
    return null;
  },
}));
let snapshot: PlayerSnapshot,
  miniRevision = 0;
beforeEach(() => {
  native.mounts = 0;
  native.unmounts = 0;
  miniRevision = 0;
  snapshot = {
    active: true,
    loaded: true,
    embedded: true,
    fullscreen: true,
    title: "Controlled",
    position: 30,
    duration: 90,
    playSessionId: "one",
    paused: false,
    volume: 70,
    muted: false,
    tracks: [
      { id: 1, type: "sub", selected: true },
      { id: 2, type: "sub", selected: false },
      { id: 1, type: "audio", selected: true },
      { id: 2, type: "audio", selected: false },
    ],
    error: "",
    syncError: "",
    finished: false,
  };
  vi.mocked(invoke).mockImplementation(async (name, args) =>
    name === "player_status"
      ? { ...snapshot }
      : name === "player_mini"
        ? {
            session: snapshot.playSessionId,
            active: (args as { command: string }).command !== "leave",
            revision: ++miniRevision,
          }
        : undefined,
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
const current = () => {
  const call = vi.mocked(usePlayerOverlay).mock.lastCall!;
  return {
    model: call[1] as PlayerUiModel,
    dispatch: call[2] as (a: PlayerAction) => Promise<void>,
  };
};
it("does not request fullscreen exit at EOF or detach the viewport across a media loading gap", async () => {
  const view = render(
    <PlayerPanel theater revision={1} onStopped={() => {}} />,
  );
  await waitFor(() => expect(current().model?.state.active).toBe(true));
  expect(native.mounts).toBe(1);
  snapshot = { ...snapshot, active: false, finished: true, syncComplete: true };
  view.rerender(<PlayerPanel theater revision={2} onStopped={() => {}} />);
  await waitFor(() => expect(current().model.state.finished).toBe(true));
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(
        ([n, a]) =>
          n === "player_control" &&
          (a as { action: string }).action === "fullscreen",
      ),
  ).toHaveLength(0);
  expect(native.unmounts).toBe(0);
  snapshot = {
    ...snapshot,
    active: true,
    loaded: false,
    finished: false,
    playSessionId: "two",
  };
  view.rerender(<PlayerPanel theater revision={3} onStopped={() => {}} />);
  await waitFor(() => expect(current().model.state.playSessionId).toBe("two"));
  expect(native.mounts).toBe(1);
});
it("has no Mini return strip or replacement control in the browsing window", async () => {
  const view = render(
    <PlayerPanel theater revision={1} onStopped={() => {}} />,
  );
  await waitFor(() => expect(current().model?.state.active).toBe(true));
  await act(async () =>
    current().dispatch({
      kind: "mini",
      command: "enter",
      playSessionId: "one",
    }),
  );
  view.rerender(
    <PlayerPanel dock theater={false} revision={1} onStopped={() => {}} />,
  );
  expect(screen.queryByRole("button", { name: /返回主播放器/ })).toBeNull();
  expect(view.container.querySelector(".player-chrome")).toBeNull();
});
it.each(["subtitle", "audio"])(
  "binds %s selections to the current media session without pause, seek or restart",
  async (action) => {
    render(<PlayerPanel theater revision={1} onStopped={() => {}} />);
    await waitFor(() => expect(current().model?.state.active).toBe(true));
    vi.mocked(invoke).mockClear();
    await act(async () =>
      current().dispatch({ kind: "control", action, value: 2 }),
    );
    expect(invoke).toHaveBeenCalledExactlyOnceWith("player_control", {
      action,
      value: 2,
      expectedSessionId: "one",
    });
    expect(current().model.state.position).toBe(30);
    expect(current().model.state.paused).toBe(false);
  },
);
it.each(["subtitle", "audio"])(
  "keeps the latest %s receipt and retains a concurrent pause and seek",
  async (action) => {
    render(<PlayerPanel theater revision={1} onStopped={() => {}} />);
    await waitFor(() => expect(current().model?.state.active).toBe(true));
    const finish: Array<() => void> = [];
    vi.mocked(invoke).mockImplementation(async (name, args) => {
      if (
        name === "player_control" &&
        (args as { action: string }).action === action
      )
        return new Promise<void>((resolve) => finish.push(resolve));
    });
    let older!: Promise<void>, newer!: Promise<void>;
    act(() => {
      older = current().dispatch({ kind: "control", action, value: 2 });
      newer = current().dispatch({ kind: "control", action, value: 1 });
    });
    await act(async () => {
      await current().dispatch({ kind: "control", action: "pause" });
    });
    await act(async () => {
      await current().dispatch({ kind: "control", action: "seek", value: 45 });
    });
    await act(async () => {
      finish[1]();
      await newer;
      finish[0]();
      await older;
    });
    expect(
      current().model.state.tracks.find(
        (t) => t.type === (action === "audio" ? "audio" : "sub") && t.selected,
      )?.id,
    ).toBe(1);
    expect(current().model.state.position).toBe(45);
    expect(current().model.state.paused).toBe(true);
  },
);
it("ignores an old media track receipt, and permits Mini exit while its request remains pending", async () => {
  const view = render(
    <PlayerPanel theater revision={1} onStopped={() => {}} />,
  );
  await waitFor(() => expect(current().model?.state.active).toBe(true));
  let finish!: () => void;
  const base = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((name, args) =>
    name === "player_control" &&
    (args as { action: string }).action === "subtitle"
      ? new Promise<void>((resolve) => {
          finish = resolve;
        })
      : base(name, args),
  );
  await act(async () =>
    current().dispatch({
      kind: "mini",
      command: "enter",
      playSessionId: "one",
    }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = current().dispatch({
      kind: "control",
      action: "subtitle",
      value: 2,
    });
  });
  await act(async () =>
    current().dispatch({
      kind: "mini",
      command: "leave",
      playSessionId: "one",
    }),
  );
  expect(current().model.mini).toBe(false);
  snapshot = {
    ...snapshot,
    playSessionId: "two",
    tracks: [
      { id: 1, type: "sub", selected: true },
      { id: 2, type: "sub", selected: false },
    ],
  };
  view.rerender(<PlayerPanel theater revision={2} onStopped={() => {}} />);
  await waitFor(() => expect(current().model.state.playSessionId).toBe("two"));
  await act(async () => {
    finish();
    await pending;
  });
  expect(current().model.state.tracks.find((t) => t.selected)?.id).toBe(1);
});
it("uses the actual visible subtitle click path, and retains playback after a rejected selection", async () => {
  render(<PlayerPanel theater revision={1} onStopped={() => {}} />);
  await waitFor(() => expect(current().model?.state.active).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "字幕" }));
  const base = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((name, args) =>
    name === "player_control"
      ? Promise.reject(Error("controlled track rejection"))
      : base(name, args),
  );
  fireEvent.click(screen.getByRole("menuitemradio", { name: "字幕 2" }));
  await waitFor(() =>
    expect(current().model.error).toContain("controlled track rejection"),
  );
  expect(current().model.state.active).toBe(true);
  expect(current().model.state.paused).toBe(false);
  expect(current().model.state.position).toBe(30);
  expect(screen.getByRole("menu", { name: "字幕" })).toBeTruthy();
  expect(
    current().model.state.tracks.find((t) => t.type === "sub" && t.selected)
      ?.id,
  ).toBe(1);
});
