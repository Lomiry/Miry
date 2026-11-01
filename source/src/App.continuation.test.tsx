// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { usePlayerOverlay } from "./player/usePlayerOverlay";
import App from "./App";
import { saveAccount } from "./stores/account";
import { saveSettings, readSettings } from "./stores/settings";
import { danmakuDefaults } from "./danmaku/types";
import type { PlayerSnapshot } from "./player/playback";
import type { PlayerAction, PlayerUiModel } from "./player/uiModel";
const events = vi.hoisted(
  () => new Map<string, Set<(event: { payload: unknown }) => void>>(),
);
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ setFocus: async () => {} }),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (name: string, handler: (event: { payload: unknown }) => void) => {
      const group = events.get(name) || new Set();
      group.add(handler);
      events.set(name, group);
      return () => group.delete(handler);
    },
  ),
  emitTo: vi.fn(),
}));
vi.mock("./player/usePlayerOverlay", () => ({
  usePlayerOverlay: vi.fn(() => true),
}));
vi.mock("./danmaku/useDanmaku", () => ({
  default: () => ({
    document: null,
    metadata: { settings: danmakuDefaults },
    action: vi.fn(),
  }),
}));
vi.mock("./danmaku/useDanmakuClock", () => ({ default: () => null }));
vi.mock("./components/VideoViewport", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  events.clear();
  vi.clearAllMocks();
});
it.each([
  { automatic: true, initial: true, user: undefined, fail: false },
  { automatic: false, initial: true, user: false, fail: false },
  { automatic: false, initial: false, user: true, fail: false },
  { automatic: true, initial: true, user: undefined, fail: true },
])(
  "preserves window authority across a controlled next-episode load: %j",
  async (scenario) => {
    saveAccount(
      {
        server: "https://continuation.example.test",
        serverId: "s",
        userId: "u",
        token: "synthetic",
        name: "fixture",
        deviceId: "d",
      },
      false,
    );
    saveSettings({
      ...readSettings(),
      fullscreen: scenario.initial,
      autoNext: true,
    });
    const episodes = ["A", "B"].map((Id, i) => ({
      Id,
      Name: `Controlled ${Id}`,
      Type: "Episode",
      SeriesId: "series",
      ParentIndexNumber: 1,
      IndexNumber: i + 1,
      MediaSources: [{ Id: `source-${Id}` }],
    }));
    let release!: () => void,
      mode = scenario.initial;
    let snapshot = {
      active: false,
      title: "",
      loaded: true,
      embedded: true,
      fullscreen: mode,
      position: 12,
      duration: 60,
      tracks: [],
      paused: false,
      volume: 33,
      muted: true,
      speed: 1.5,
      finished: false,
      error: "",
      syncError: "",
    } as PlayerSnapshot;
    const info = (id: string) =>
      new Response(
        JSON.stringify({
          PlaySessionId: `session-${id}`,
          MediaSources: [{ Id: `source-${id}`, SupportsDirectPlay: true }],
        }),
      );
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input)),
        path = url.pathname;
      if (path.endsWith("/B/PlaybackInfo"))
        return new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              scenario.fail ? new Response("{}", { status: 500 }) : info("B"),
            );
        });
      if (path.endsWith("/PlaybackInfo")) return info("A");
      const item = episodes.find((item) => path.endsWith(`/Items/${item.Id}`));
      return new Response(
        JSON.stringify(
          item || { Items: episodes, TotalRecordCount: episodes.length },
        ),
      );
    });
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "player_status") return { ...snapshot, fullscreen: mode };
      if (command === "player_stop") {
        if (
          !(args as { preservePresentation?: boolean } | undefined)
            ?.preservePresentation
        )
          mode = false;
        snapshot = {
          ...snapshot,
          active: false,
          syncComplete: true,
          fullscreen: mode,
        };
        return snapshot;
      }
      if (command === "player_start") {
        const launch = (
          args as {
            launch: {
              preservePresentation: boolean;
              fullscreen: boolean;
              itemId: string;
              playSessionId: string;
            };
          }
        ).launch;
        if (!launch.preservePresentation) mode = launch.fullscreen;
        snapshot = {
          ...snapshot,
          active: true,
          finished: false,
          title: `Controlled ${launch.itemId}`,
          itemId: launch.itemId,
          playSessionId: launch.playSessionId,
          fullscreen: mode,
        };
      }
      if (
        command === "player_control" &&
        (args as { action: string }).action === "fullscreen"
      ) {
        mode = (args as { value: number }).value === 1;
        snapshot = { ...snapshot, fullscreen: mode };
        events
          .get("player-fullscreen")
          ?.forEach((handler) => handler({ payload: mode }));
      }
    });
    const current = () => {
      const call = vi.mocked(usePlayerOverlay).mock.lastCall!;
      return {
        model: call[1] as PlayerUiModel,
        dispatch: call[2] as (a: PlayerAction) => Promise<void>,
      };
    };
    const starts = () =>
      vi.mocked(invoke).mock.calls.filter(([name]) => name === "player_start");
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "快速播放 Controlled A" }),
    );
    await waitFor(() => expect(current().model?.state.active).toBe(true));
    await waitFor(() => expect(current().model.queue?.items.length).toBe(2));
    let pending: Promise<void> | undefined;
    if (scenario.automatic) {
      snapshot = {
        ...snapshot,
        active: false,
        finished: true,
        syncComplete: true,
      };
      act(() =>
        events
          .get("player-final-snapshot")
          ?.forEach((handler) => handler({ payload: snapshot })),
      );
    } else
      act(() => {
        pending = current().dispatch({ kind: "next" });
      });
    await waitFor(() => expect(release).toBeTypeOf("function"));
    expect(mode).toBe(scenario.initial);
    if (scenario.user !== undefined)
      await act(async () =>
        current().dispatch({
          kind: "control",
          action: "fullscreen",
          value: scenario.user ? 1 : 0,
        }),
      );
    await act(async () => {
      release();
      if (pending) await pending;
    });
    if (scenario.fail) {
      await waitFor(() => expect(current().model.queue?.error).toBeTruthy());
      expect(starts()).toHaveLength(1);
    } else {
      await waitFor(() => expect(starts()).toHaveLength(2));
      expect((starts()[1][1] as { launch: unknown }).launch).toMatchObject({
        preservePresentation: true,
        speed: 1.5,
        volume: 33,
        muted: true,
      });
    }
    expect(mode).toBe(scenario.user ?? scenario.initial);
  },
);
