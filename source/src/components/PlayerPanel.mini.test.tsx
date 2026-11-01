// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import PlayerPanel from "./PlayerPanel";
import { usePlayerOverlay } from "../player/usePlayerOverlay";
import useDanmaku from "../danmaku/useDanmaku";
import type { PlayerUiModel, PlayerAction } from "../player/uiModel";
import { danmakuDefaults } from "../danmaku/types";
import { readSettings } from "../stores/settings";
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
vi.mock("../danmaku/useDanmaku", () => ({ default: vi.fn() }));
vi.mock("../danmaku/useDanmakuClock", () => ({ default: () => null }));
vi.mock("./VideoViewport", () => ({ default: () => null }));
vi.mock("../danmaku/DanmakuLayer", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
it.each(["HTTP 500", "timeout"])(
  "leaves Mini independently of failed Progress (%s) and accepts the next action",
  async (syncError) => {
    vi.mocked(useDanmaku).mockReturnValue({
      document: null,
      metadata: { settings: danmakuDefaults, offset: 0 },
      action: vi.fn(),
    } as never);
    let revision = 0;
    vi.mocked(invoke).mockImplementation(async (name, args) => {
      if (name === "player_stop") return new Promise(() => {});
      if (name === "player_mini")
        return {
          session: "one",
          active: (args as { command: string }).command !== "leave",
          revision: ++revision,
        };
      return {
        active: true,
        loaded: true,
        embedded: true,
        playSessionId: "one",
        position: 10,
        duration: 100,
        tracks: [],
        syncError,
        error: "",
      };
    });
    const onMiniChange = vi.fn();
    render(
      <PlayerPanel
        theater
        revision={1}
        onStopped={() => {}}
        onMiniChange={onMiniChange}
      />,
    );
    const current = () => {
      const call = vi.mocked(usePlayerOverlay).mock.lastCall!;
      return {
        model: call[1] as PlayerUiModel,
        dispatch: call[2] as (a: PlayerAction) => Promise<void>,
      };
    };
    await waitFor(() =>
      expect(current().model?.state.syncError).toBe(syncError),
    );
    for (const command of ["enter", "leave", "enter", "leave"] as const) {
      await act(async () =>
        current().dispatch({ kind: "mini", command, playSessionId: "one" }),
      );
      expect(onMiniChange).toHaveBeenLastCalledWith(command === "enter");
      expect(current().model.state.active).toBe(true);
    }
    expect(
      vi.mocked(invoke).mock.calls.some(([name]) => name === "player_stop"),
    ).toBe(false);
  },
);
it.each([false, true])(
  "removes Mini danmaku data/clock and actions, restores cached preference %s and persists layouts",
  async (enabled) => {
    const document = { entries: [], skipped: 0, format: "XML" as const };
    const density = { bins: [1], max: 1, duration: 100 };
    const action = vi.fn(async () => {});
    const metadata = {
      settings: { ...danmakuDefaults, enabled },
      offset: 0,
      density,
      name: "local",
      count: 1,
      skipped: 0,
      status: "",
      bound: false,
    };
    vi.mocked(useDanmaku).mockReturnValue({
      document,
      metadata,
      action,
    } as never);
    let revision = 0;
    vi.mocked(invoke).mockImplementation(async (name, args) =>
      name === "player_mini"
        ? {
            session: "one",
            active: (args as { command: string }).command !== "leave",
            revision: ++revision,
          }
        : {
            active: true,
            loaded: true,
            title: "QA",
            position: 10,
            duration: 100,
            tracks: [],
            embedded: true,
            playSessionId: "one",
            error: "",
            syncError: "",
          },
    );
    render(<PlayerPanel theater revision={1} onStopped={() => {}} />);
    const current = () => {
      const call = vi.mocked(usePlayerOverlay).mock.lastCall!;
      return {
        model: call[1] as PlayerUiModel,
        dispatch: call[2] as (action: PlayerAction) => Promise<void>,
        data: call[3],
      };
    };
    await waitFor(() =>
      expect(current().model?.state.playSessionId).toBe("one"),
    );
    await act(async () =>
      current().dispatch({
        kind: "mini",
        command: "enter",
        playSessionId: "one",
      }),
    );
    expect(current().model.danmaku).toBeUndefined();
    expect(current().data).toEqual({ document: null, clock: null });
    await act(async () =>
      current().dispatch({
        kind: "danmaku",
        command: "settings",
        patch: { enabled: true },
      }),
    );
    expect(current().model.danmaku).toBeUndefined();
    expect(action).not.toHaveBeenCalled();
    expect(current().data?.document).toBeNull();
    expect(localStorage.getItem("miry-settings")).toBeNull();
    await act(async () =>
      current().dispatch({
        kind: "mini",
        command: "leave",
        playSessionId: "one",
      }),
    );
    expect(current().model.danmaku?.settings.enabled).toBe(enabled);
    expect(current().model.danmaku?.density).toBe(density);
    expect(current().data?.document).toBe(document);
    await act(async () =>
      current().dispatch({
        kind: "mini",
        command: "enter",
        playSessionId: "one",
      }),
    );
    expect(current().model.danmaku).toBeUndefined();
    await act(async () =>
      current().dispatch({
        kind: "layout",
        layout: { preset: "custom", buttons: ["speed", "volume"] },
      }),
    );
    expect(readSettings().controlLayout).toEqual({
      preset: "custom",
      buttons: ["speed", "volume"],
    });
  },
);
