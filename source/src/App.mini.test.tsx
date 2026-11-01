// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import App from "./App";
import { saveAccount } from "./stores/account";
import { usePlayerOverlay } from "./player/usePlayerOverlay";
import type { PlayerSnapshot } from "./player/playback";
import type { PlayerAction, PlayerUiModel } from "./player/uiModel";
import { danmakuDefaults } from "./danmaku/types";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ setFocus: async () => {} }),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
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
vi.mock("./components/VideoViewport", () => ({
  default: ({ detached }: { detached: boolean }) => (
    <div data-testid="viewport-owner" data-detached={detached} />
  ),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

it("restores search/scroll, browses B without stopping A, returns to A and switches A→B→A with fresh serialized sessions", async () => {
  saveAccount(
    {
      server: "https://mini.test/emby",
      serverId: "qa",
      userId: "u",
      token: "fixture",
      name: "QA",
      deviceId: "d",
    },
    false,
  );
  const movies = ["A", "B"].map((Id) => ({
    Id,
    Name: `影片${Id}`,
    Type: "Movie",
    MediaSources: [{ Id: `source-${Id}` }],
  }));
  let session = 0,
    miniRevision = 0;
  let snapshot = {
    active: false,
    title: "",
    loaded: true,
    embedded: true,
    position: 12,
    duration: 600,
    tracks: [],
    paused: false,
    volume: 75,
    muted: false,
    finished: false,
    error: "",
    syncError: "",
  } as PlayerSnapshot;
  vi.mocked(fetch).mockImplementation(async (address) => {
    const url = new URL(String(address)),
      path = url.pathname;
    const result = path.endsWith("/PlaybackInfo")
      ? {
          PlaySessionId: `session-${++session}`,
          MediaSources: [
            {
              Id: `source-${path.split("/").at(-2)}`,
              SupportsDirectPlay: true,
            },
          ],
        }
      : /\/Items\/[AB]$/.test(path)
        ? movies.find((m) => path.endsWith(m.Id))
        : path.endsWith("/Latest")
          ? movies
          : /Views|Resume|NextUp|Genres/.test(path)
            ? { Items: [], TotalRecordCount: 0 }
            : { Items: movies, TotalRecordCount: 2 };
    return new Response(JSON.stringify(result));
  });
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_status") return snapshot;
    if (command === "player_start") {
      const launch = (
        args as { launch: { itemId: string; playSessionId: string } }
      ).launch;
      snapshot = {
        ...snapshot,
        active: true,
        title: `影片${launch.itemId}`,
        itemId: launch.itemId,
        playSessionId: launch.playSessionId,
        miniPresentation: snapshot.miniPresentation?.active
          ? {
              ...snapshot.miniPresentation,
              session: launch.playSessionId,
              revision: ++miniRevision,
            }
          : undefined,
      };
    }
    if (command === "player_stop") {
      snapshot = { ...snapshot, active: false, syncComplete: true };
      return snapshot;
    }
    if (command === "player_mini") {
      snapshot.miniPresentation = {
        session: snapshot.playSessionId,
        active: (args as { command: string }).command !== "leave",
        revision: ++miniRevision,
      } as NonNullable<PlayerSnapshot["miniPresentation"]>;
      return snapshot.miniPresentation;
    }
    return undefined;
  });
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("搜索媒体"), "影片{Enter}");
  await screen.findAllByRole("button", { name: /^查看详情 影片A/ });
  const main = document.querySelector("main")!;
  main.scrollTop = 412;
  await user.click(
    screen.getAllByRole("button", { name: "快速播放 影片A" })[0],
  );
  const current = () => {
    const call = vi.mocked(usePlayerOverlay).mock.lastCall!;
    return {
      model: call[1] as PlayerUiModel,
      dispatch: call[2] as (action: PlayerAction) => Promise<void>,
    };
  };
  await waitFor(() => expect(current().model?.state.active).toBe(true));
  const firstSession = snapshot.playSessionId!;
  const owner = screen.getByTestId("viewport-owner");
  const starts = () =>
    vi.mocked(invoke).mock.calls.filter(([name]) => name === "player_start");
  const stops = () =>
    vi.mocked(invoke).mock.calls.filter(([name]) => name === "player_stop")
      .length;
  const beforeMini = stops();
  const mini = async (command: "enter" | "leave") =>
    act(async () =>
      current().dispatch({
        kind: "mini",
        command,
        playSessionId: snapshot.playSessionId!,
      }),
    );
  await mini("enter");
  expect(document.querySelector(".theater-shell")).toBeNull();
  expect(screen.getByLabelText("搜索媒体")).toHaveProperty("value", "影片");
  await waitFor(() => expect(main.scrollTop).toBe(412));
  expect(screen.getByTestId("viewport-owner")).toBe(owner);
  expect(owner.getAttribute("data-detached")).toBe("true");
  expect(current().model.theater).toBe(true);
  expect(current().model.danmaku).toBeUndefined();
  await user.click(
    screen.getAllByRole("button", { name: /^查看详情 影片B/ })[0],
  );
  await screen.findByRole("heading", { name: "影片B" });
  expect(stops()).toBe(beforeMini);
  expect(starts()).toHaveLength(1);
  expect(snapshot.playSessionId).toBe(firstSession);
  main.scrollTop = 230;
  await mini("leave");
  expect(document.querySelector(".theater-shell")).toBeTruthy();
  expect(current().model.state.itemId).toBe("A");
  expect(stops()).toBe(beforeMini);
  await mini("enter");
  await screen.findByRole("heading", { name: "影片B" });
  await waitFor(() => expect(main.scrollTop).toBe(230));
  await user.click(screen.getByRole("button", { name: "播放" }));
  await waitFor(() => expect(starts()).toHaveLength(2));
  expect(snapshot.itemId).toBe("B");
  expect(snapshot.playSessionId).not.toBe(firstSession);
  await waitFor(() => expect(current().model.state.itemId).toBe("B"));
  expect(document.querySelector(".theater-shell")).toBeNull();
  expect(current().model.mini).toBe(true);
  expect(screen.queryByRole("button", { name: "返回主播放器" })).toBeNull();
  expect(document.querySelector(".has-player")).toBeNull();
  await mini("enter");
  await user.click(screen.getByRole("button", { name: "首页" }));
  await user.click(
    (await screen.findAllByRole("button", { name: "快速播放 影片A" }))[0],
  );
  await waitFor(() => expect(starts()).toHaveLength(3));
  expect(
    new Set(
      starts().map(
        ([, args]) =>
          (args as { launch: { playSessionId: string } }).launch.playSessionId,
      ),
    ).size,
  ).toBe(3);
  const commands = vi.mocked(invoke).mock.calls.map(([name]) => name);
  const indices = commands.flatMap((name, i) =>
    name === "player_start" ? [i] : [],
  );
  expect(commands.slice(indices[0] + 1, indices[1])).toContain("player_stop");
  expect(commands.slice(indices[1] + 1, indices[2])).toContain("player_stop");
});
