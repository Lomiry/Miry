// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { EmbyClient } from "../api/client";
import type { PlayerSnapshot } from "../player/playback";
import type { PlayerAction, PlayerUiModel } from "../player/uiModel";
import { readSettings, saveSettings } from "../stores/settings";
import { normalizeDanmaku } from "../danmaku/types";
import PlayerPanel from "./PlayerPanel";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({ emitTo: vi.fn(), listen: vi.fn() }));
vi.mock("./VideoViewport", () => ({ default: () => null }));
vi.mock("../danmaku/DanmakuLayer", () => ({ default: () => null }));

const api = new EmbyClient({
  server: "https://host.test/emby",
  serverId: "server",
  userId: "user",
  token: "synthetic",
  name: "Test",
  deviceId: "test",
});
const item = { Id: "movie", Name: "Movie", Type: "Movie" };
const handlers = new Map<string, (event: { payload?: unknown }) => unknown>();
let snapshot: PlayerSnapshot;
let props: ComponentProps<typeof PlayerPanel>;
const sends = (event: string) =>
  vi.mocked(emitTo).mock.calls.filter(([, name]) => name === event);
const latest = () => sends("player-ui-state").at(-1)![2] as PlayerUiModel;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  handlers.clear();
  vi.stubGlobal("__TAURI_INTERNALS__", {});
  snapshot = {
    active: true,
    loaded: true,
    embedded: true,
    title: "Movie",
    position: 10,
    duration: 100,
    paused: false,
    volume: 75,
    muted: false,
    tracks: [],
    error: "",
    syncError: "",
    finished: false,
    playSessionId: "session",
  };
  props = { revision: 1, onStopped: vi.fn(), theater: true, api, item };
  vi.mocked(emitTo).mockResolvedValue();
  vi.mocked(listen).mockImplementation(async (name, handler) => {
    handlers.set(name, handler as never);
    return () => handlers.delete(name);
  });
  vi.mocked(invoke).mockImplementation(async (name) => {
    if (name === "player_status") return { ...snapshot };
    if (name === "danmaku_read")
      return {
        reference: "local-grant",
        name: "local.xml",
        offset: 0,
        text: '<i><d p="0,1,25,16777215">Test</d></i>',
      };
    if (name === "danmaku_online_status")
      return { configured: false, mock: false };
    if (name === "player_clock")
      return {
        session: "session",
        position: Date.now() / 1000,
        sampledAt: Date.now(),
        paused: snapshot.paused,
        speed: 1,
        active: true,
        loaded: true,
        buffering: false,
      };
    return null;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function mount() {
  const view = render(<PlayerPanel {...props} />);
  await act(async () => {});
  await act(async () => {
    handlers.get("player-ui-ready")!({});
  });
  expect(latest().danmaku?.count).toBe(1);
  vi.mocked(emitTo).mockClear();
  vi.mocked(invoke).mockClear();
  return view;
}

it("stops danmaku clock polling in Mini and restores the cached main document without rereading it", async () => {
  const view = await mount();
  const stored = localStorage.getItem("miry-settings");
  await act(async () =>
    handlers.get("player-mini-changed")!({
      payload: { active: true, session: "session", revision: 1 },
    }),
  );
  props = { ...props, theater: false };
  view.rerender(<PlayerPanel {...props} />);
  expect(latest().mini).toBe(true);
  expect(latest().danmaku).toBeUndefined();
  expect(sends("player-danmaku-data").at(-1)?.[2]).toBeNull();
  vi.mocked(invoke).mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(
    vi
      .mocked(invoke)
      .mock.calls.some(
        ([command]) => command === "player_clock" || command === "danmaku_read",
      ),
  ).toBe(false);
  await act(async () =>
    handlers.get("player-mini-changed")!({
      payload: { active: false, session: "session", revision: 2 },
    }),
  );
  props = { ...props, theater: true };
  view.rerender(<PlayerPanel {...props} />);
  await act(async () => handlers.get("player-ui-ready")!({}));
  expect(latest().danmaku?.count).toBe(1);
  expect(sends("player-danmaku-data").at(-1)?.[2]).toMatchObject({
    entries: expect.any(Array),
  });
  expect(
    vi
      .mocked(invoke)
      .mock.calls.some(([command]) => command === "danmaku_read"),
  ).toBe(false);
  expect(localStorage.getItem("miry-settings")).toBe(stored);
});

it("keeps 50 clock samples independent of full control state over ten seconds", async () => {
  const view = await mount();
  for (let i = 0; i < 50; i++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  const count = (name: string) =>
    vi.mocked(invoke).mock.calls.filter(([command]) => command === name).length;
  const measured = {
    clockPolls: count("player_clock"),
    statusPolls: count("player_status"),
    clockSends: sends("player-danmaku-clock").length,
    stateSends: sends("player-ui-state").length,
    documentSends: sends("player-danmaku-data").length,
  };
  console.info("controlled-overlay-updates", JSON.stringify(measured));
  expect(measured).toEqual({
    clockPolls: 50,
    statusPolls: 10,
    clockSends: 50,
    stateSends: 10,
    documentSends: 0,
  });
  view.unmount();
  vi.mocked(emitTo).mockClear();
  vi.mocked(invoke).mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(emitTo).not.toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalled();
});

it("syncs presentation changes and readiness immediately while keeping action ownership current", async () => {
  const view = await mount();
  for (const patch of [
    { previousDisabled: true, nextDisabled: true, onNext: vi.fn() },
    { sourceId: "version", introSeconds: 30, outroSeconds: 20 },
    {
      routes: [{ name: "Route", selected: true }],
      routeHint: { reason: "Test" },
    },
    {
      queuePresentation: {
        items: [item],
        index: 0,
        busy: false,
        autoNext: true,
      },
    },
  ]) {
    props = { ...props, ...patch };
    view.rerender(<PlayerPanel {...props} />);
    expect(latest()).toMatchObject({
      previousDisabled: props.previousDisabled || false,
      nextDisabled: props.nextDisabled || false,
      sourceId: props.sourceId,
      introSeconds: props.introSeconds ?? 90,
      outroSeconds: props.outroSeconds ?? 60,
      routes: props.routes || [],
      routeHint: props.routeHint,
      queue: props.queuePresentation,
    });
  }
  const onNext = vi.fn(async () => {});
  props = { ...props, onNext };
  view.rerender(<PlayerPanel {...props} />);
  await act(async () => {
    await handlers.get("player-ui-action")!({
      payload: { id: "next", action: { kind: "next" } satisfies PlayerAction },
    });
  });
  expect(onNext).toHaveBeenCalledOnce();
  snapshot = { ...snapshot, paused: true, position: 42, fullscreen: true };
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(latest().state).toMatchObject({
    paused: true,
    position: 42,
    fullscreen: true,
  });
  await act(async () => {
    saveSettings({
      ...readSettings(),
      danmaku: { ...normalizeDanmaku(readSettings().danmaku), opacity: 0.37 },
    });
  });
  expect(latest().danmaku?.settings.opacity).toBe(0.37);
  vi.mocked(emitTo).mockClear();
  await act(async () => {
    handlers.get("player-ui-ready")!({});
  });
  expect(sends("player-ui-state")).toHaveLength(1);
  expect(sends("player-danmaku-data")).toHaveLength(1);
  expect(sends("player-danmaku-clock")).toHaveLength(1);
  props = { ...props, overlayOpen: true };
  view.rerender(<PlayerPanel {...props} />);
  vi.mocked(emitTo).mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(sends("player-danmaku-clock")).toHaveLength(0);
  props = { ...props, overlayOpen: false, revision: 2 };
  view.rerender(<PlayerPanel {...props} />);
  await act(async () => {});
  expect(latest().revision).toBe(2);
  expect(latest().shortcutsBlocked).toBe(false);
});
