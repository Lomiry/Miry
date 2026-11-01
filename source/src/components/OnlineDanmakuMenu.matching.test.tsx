// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import OnlineDanmakuMenu from "./OnlineDanmakuMenu";
import PlayerChrome from "./PlayerChrome";
import type { PlayerUiModel, PlayerAction } from "../player/uiModel";
import useDanmaku from "../danmaku/useDanmaku";
import { onlineProvider } from "../danmaku/dandanplay";
import { EmbyClient } from "../api/client";
import { readSettings, saveSettings } from "../stores/settings";
import { normalizeDanmaku, type DanmakuDocument } from "../danmaku/types";
import { sourceDefaults } from "../danmaku/sources";
import { DanmakuScheduler } from "../danmaku/scheduler";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
  emitTo: vi.fn(async () => {}),
}));
const api = new EmbyClient({
  server: "https://emby.example.test",
  serverId: "s",
  userId: "u",
  name: "test",
  token: "synthetic",
  deviceId: "d",
});
const item = {
  Id: "A",
  Name: "Episode 3",
  SeriesName: "Example",
  Type: "Episode",
  ParentIndexNumber: 2,
  IndexNumber: 3,
};
const weak = {
  provider: "dandanplay" as const,
  id: "1",
  animeId: "1",
  title: "Example",
  episodeTitle: "第3集",
  episode: 3,
  movie: false,
};
const document: DanmakuDocument = {
  format: "Online",
  skipped: 0,
  entries: [
    { time: 60, text: "comment", mode: "scroll", color: "#fff", duration: 8 },
  ],
};
let strong = false,
  empty = false,
  unavailable = false,
  alternate = false;
let pendingComments: Promise<unknown> | undefined;
let current: ReturnType<typeof useDanmaku>;
const comments = () =>
  pendingComments ||
  Promise.resolve({
    videoDuration: 120,
    comments: [{ p: "60,1,16777215", m: "comment" }],
  });
function App({
  media = item,
  session = "play-A",
  chrome = false,
}: {
  media?: typeof item;
  session?: string;
  chrome?: boolean;
}) {
  current = useDanmaku(api, media, true, session, 100);
  const dispatch = async (a: PlayerAction) => {
    if (a.kind === "danmaku")
      await current.action(
        a.command,
        a.patch,
        a.query,
        a.matchId,
        a.matchScope,
      );
  };
  if (chrome) {
    const model: PlayerUiModel = {
      state: {
        active: true,
        loaded: true,
        title: "Fixture",
        position: 50,
        duration: 100,
        paused: false,
        volume: 75,
        muted: false,
        tracks: [{ id: 1, type: "sub", selected: true }],
        error: "",
        syncError: "",
        finished: false,
        embedded: true,
        playSessionId: session,
      },
      revision: 1,
      theater: true,
      canHide: false,
      busy: false,
      error: "",
      diagnosticFeedback: "",
      introSeconds: 90,
      outroSeconds: 60,
      previousDisabled: true,
      nextDisabled: true,
      capabilities: {
        return: false,
        previous: false,
        next: false,
        restart: false,
        versions: false,
      },
      routes: [],
      controlLayout: { preset: "custom", buttons: ["danmaku"] },
      danmaku: current.metadata,
    };
    return <PlayerChrome model={model} dispatch={dispatch} />;
  }
  return (
    <OnlineDanmakuMenu
      value={current.metadata}
      dispatch={async (a) => {
        if (a.kind === "danmaku")
          await current.action(
            a.command,
            a.patch,
            a.query,
            a.matchId,
            a.matchScope,
          );
      }}
    />
  );
}
beforeEach(() => {
  localStorage.clear();
  strong = false;
  empty = false;
  unavailable = false;
  alternate = false;
  pendingComments = undefined;
  vi.spyOn(onlineProvider, "match").mockImplementation(async () => ({
    candidates: empty ? [] : [weak],
    ...(strong ? { selected: weak } : {}),
  }));
  vi.spyOn(onlineProvider, "search").mockImplementation(async () =>
    unavailable
      ? Promise.reject({ kind: "network" })
      : empty
        ? []
        : [{ ...weak, id: alternate ? "2" : "1" }],
  );
  vi.spyOn(onlineProvider, "getComments").mockImplementation(async () => {
    if (pendingComments) await pendingComments;
    if (unavailable) throw { kind: "network" };
    return document;
  });
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (name, args) => {
      if (name === "danmaku_online_status")
        return { configured: true, mock: true, builtIn: true };
      if (name === "danmaku_source_request") {
        if (unavailable) throw "network";
        const q = (args as { query: { kind: string } }).query;
        if (q.kind === "comments") return comments();
        return {
          success: true,
          animes: empty
            ? []
            : [
                {
                  animeId: 1,
                  animeTitle: strong ? "Example S02" : "Example",
                  type: "tvseries",
                  episodes: [
                    { episodeId: alternate ? 2 : 1, episodeTitle: "第3集" },
                  ],
                },
              ],
        };
      }
      return null;
    });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function configure(provider: string) {
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: {
        mode: provider,
        sources: [
          ...sourceDefaults.sources,
          {
            id: "custom",
            name: "LogVar",
            protocol: "logvar",
            endpoint: "https://danmaku.example.test",
            enabled: true,
            priority: 1,
          },
        ],
      },
    }),
  });
}
const confirm = () => screen.getByRole("button", { name: "确认此匹配" });
const commentCalls = () =>
  vi
    .mocked(invoke)
    .mock.calls.filter(
      ([n, a]) =>
        n === "danmaku_source_request" &&
        (a as { query: { kind: string } }).query.kind === "comments",
    ).length + vi.mocked(onlineProvider.getComments).mock.calls.length;
describe.each(["custom", "dandanplay"])(
  "%s real menu → hook → provider click path",
  (provider) => {
    beforeEach(() => configure(provider));
    it("opens the actual main-player danmaku panel and completes the visible confirmation path", async () => {
      render(<App chrome />);
      await waitFor(() =>
        expect(current.metadata.online?.candidates).toHaveLength(1),
      );
      fireEvent.click(screen.getByRole("button", { name: "弹幕" }));
      await waitFor(() =>
        expect(screen.getByRole("dialog", { name: "弹幕" })).toBeTruthy(),
      );
      fireEvent.click(confirm());
      await waitFor(() => expect(screen.getByText("已确认匹配")).toBeTruthy());
      expect(commentCalls()).toBe(1);
      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(
            ([name]) => name === "player_control" || name === "player_play",
          ),
      ).toBe(false);
    });
    it("separates an automatic loaded match from candidates needing confirmation", async () => {
      strong = true;
      render(<App />);
      await waitFor(() =>
        expect(screen.getByText("自动匹配已加载")).toBeTruthy(),
      );
      expect(current.metadata.online?.pending).toBe(false);
      expect(current.metadata.online?.confirmed).toBe(false);
      expect(screen.queryByRole("button", { name: "确认此匹配" })).toBeNull();
    });
    it("requires visible explicit confirmation, deduplicates requests, maps the timeline and restores the saved association", async () => {
      const view = render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      expect(current.metadata.online?.match).toBeUndefined();
      expect(commentCalls()).toBe(0);
      let resolve!: (v: unknown) => void;
      pendingComments = new Promise((r) => {
        resolve = r;
      });
      fireEvent.click(confirm());
      fireEvent.click(confirm());
      await waitFor(() => expect(commentCalls()).toBe(1));
      expect(confirm()).toHaveProperty("disabled", true);
      await act(async () =>
        resolve({
          videoDuration: 120,
          comments: [{ p: "60,1,16777215", m: "comment" }],
        }),
      );
      await waitFor(() => expect(screen.getByText("已确认匹配")).toBeTruthy());
      expect(screen.queryByRole("button", { name: "确认此匹配" })).toBeNull();
      const time = provider === "custom" ? 50 : 60;
      expect(current.document?.entries[0].time).toBe(time);
      const scheduler = new DanmakuScheduler(
        current.document!.entries,
        current.metadata.settings,
        800,
        450,
        () => 80,
      );
      expect(scheduler.step(time, true)).toHaveLength(1);
      expect(
        vi.mocked(invoke).mock.calls.some(([n]) => n.startsWith("player_")),
      ).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: /重新加载/ }));
      await waitFor(() => expect(commentCalls()).toBe(2));
      await waitFor(() => expect(current.metadata.online?.loading).toBe(false));
      expect(current.metadata.online?.confirmed).toBe(true);
      view.unmount();
      render(<App session="restart" />);
      await waitFor(() =>
        expect(current.metadata.online?.confirmed).toBe(true),
      );
      expect(current.metadata.online?.match?.id).toBe(
        provider === "custom" ? "custom:1" : "1",
      );
    });
    it("cancels without loading, re-searches with edited keywords and confirms another candidate", async () => {
      render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: "取消" }));
      expect(commentCalls()).toBe(0);
      expect(screen.queryByRole("button", { name: "确认此匹配" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "选择其他匹配" }));
      const input = screen.getByLabelText("在线弹幕搜索");
      fireEvent.change(input, { target: { value: "Example corrected" } });
      alternate = true;
      fireEvent.submit(input.closest("form")!);
      await waitFor(() =>
        expect(current.metadata.online?.candidates[0].id).toBe(
          provider === "custom" ? "custom:2" : "2",
        ),
      );
      fireEvent.click(confirm());
      await waitFor(() =>
        expect(current.metadata.online?.confirmed).toBe(true),
      );
      expect(current.metadata.online?.match?.id).toBe(
        provider === "custom" ? "custom:2" : "2",
      );
    });
    it("retains candidates and a retryable status on failed confirmation without claiming success", async () => {
      render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      unavailable = true;
      fireEvent.click(confirm());
      await waitFor(() => expect(confirm()).toHaveProperty("disabled", false));
      expect(current.metadata.online?.match).toBeUndefined();
      expect(screen.queryByText("已确认匹配")).toBeNull();
      expect(current.metadata.online?.candidates).toHaveLength(1);
      unavailable = false;
      fireEvent.click(confirm());
      await waitFor(() => expect(screen.getByText("已确认匹配")).toBeTruthy());
    });
    it("keeps the confirmed document when another candidate fails to load", async () => {
      render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      fireEvent.click(confirm());
      await waitFor(() => expect(screen.getByText("已确认匹配")).toBeTruthy());
      const old = current.document;
      alternate = true;
      fireEvent.click(screen.getByRole("button", { name: "选择其他匹配" }));
      fireEvent.change(screen.getByLabelText("在线弹幕搜索"), {
        target: { value: "Example new version" },
      });
      fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
      await waitFor(() =>
        expect(current.metadata.online?.candidates[0].id.endsWith("2")).toBe(
          true,
        ),
      );
      unavailable = true;
      fireEvent.click(confirm());
      await waitFor(() => expect(confirm()).toHaveProperty("disabled", false));
      expect(current.metadata.online?.match?.id).toBe(
        provider === "custom" ? "custom:1" : "1",
      );
      expect(current.document).toBe(old);
      expect(current.metadata.online?.pending).toBe(true);
    });
    it("ignores an old search response after switching to another media session", async () => {
      const view = render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      let resolve!: (v: unknown) => void;
      const response = new Promise((r) => {
        resolve = r;
      });
      let intercepted = false;
      if (provider === "dandanplay")
        vi.mocked(onlineProvider.search).mockImplementationOnce(() => {
          intercepted = true;
          return response as Promise<(typeof weak)[]>;
        });
      else {
        const previous = vi.mocked(invoke).getMockImplementation()!;
        vi.mocked(invoke).mockImplementation((name, args) => {
          if (
            !intercepted &&
            name === "danmaku_source_request" &&
            (args as { query: { kind: string } }).query.kind === "search"
          ) {
            intercepted = true;
            return response;
          }
          return previous(name, args);
        });
      }
      fireEvent.click(screen.getByRole("button", { name: "选择其他匹配" }));
      fireEvent.change(screen.getByLabelText("在线弹幕搜索"), {
        target: { value: "Example fresh search" },
      });
      fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
      await waitFor(() => expect(intercepted).toBe(true));
      view.rerender(<App media={{ ...item, Id: "B" }} session="play-B" />);
      await waitFor(() => expect(current.metadata.online?.loading).toBe(false));
      await act(async () =>
        resolve(
          provider === "dandanplay"
            ? [{ ...weak, id: "9" }]
            : {
                success: true,
                animes: [
                  {
                    animeId: 9,
                    animeTitle: "Old",
                    type: "tvseries",
                    episodes: [{ episodeId: 9, episodeTitle: "第3集" }],
                  },
                ],
              },
        ),
      );
      expect(current.metadata.online?.candidates[0].id).toBe(
        provider === "custom" ? "custom:1" : "1",
      );
      expect(current.metadata.online?.match).toBeUndefined();
    });
    it("rejects an old scope and ignores late A results when B has the same provider ID", async () => {
      const view = render(<App />);
      await waitFor(() => expect(confirm()).toBeTruthy());
      const scope = current.metadata.online!.sessionKey;
      let resolve!: (v: unknown) => void;
      pendingComments = new Promise((r) => {
        resolve = r;
      });
      fireEvent.click(confirm());
      await waitFor(() => expect(commentCalls()).toBe(1));
      view.rerender(<App media={{ ...item, Id: "B" }} session="play-B" />);
      await waitFor(() => expect(confirm()).toHaveProperty("disabled", false));
      await act(async () =>
        resolve({
          videoDuration: 120,
          comments: [{ p: "60,1,16777215", m: "old" }],
        }),
      );
      expect(current.metadata.online?.match).toBeUndefined();
      await expect(
        current.action(
          "select",
          undefined,
          undefined,
          provider === "custom" ? "custom:1" : "1",
          scope,
        ),
      ).rejects.toThrow("候选已过期");
      expect(current.document).toBeNull();
    });
    it("shows no confirmation for an empty result and displays a search error without inventing candidates", async () => {
      empty = true;
      render(<App />);
      await waitFor(() => expect(current.metadata.online?.loading).toBe(false));
      await waitFor(() =>
        expect(current.metadata.online?.status).toContain("未找到匹配"),
      );
      expect(screen.queryByRole("button", { name: "确认此匹配" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "选择其他匹配" }));
      unavailable = true;
      fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
      await waitFor(() =>
        expect(current.metadata.online?.status).not.toContain("搜索中"),
      );
      expect(current.metadata.online?.match).toBeUndefined();
    });
  },
);
it("retains the earlier LogVar candidate after automatic fallback and lets the user explicitly switch to it", async () => {
  configure("auto");
  const settings = readSettings();
  saveSettings({
    ...settings,
    danmaku: normalizeDanmaku({
      ...settings.danmaku,
      sources: {
        mode: "auto",
        sources: settings.danmaku!.sources!.sources.map((s) => ({
          ...s,
          priority: s.id === "custom" ? 0 : 1,
        })),
      },
    }),
  });
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [weak],
    selected: weak,
  });
  render(<App />);
  await waitFor(() => expect(screen.getByText("自动匹配已加载")).toBeTruthy());
  expect(screen.getByText("来源尝试记录（非当前匹配状态）")).toBeTruthy();
  expect(
    current.metadata.online?.candidates.some((m) => m.id === "custom:1"),
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "确认此匹配" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Example.*LogVar/ }));
  fireEvent.click(confirm());
  await waitFor(() =>
    expect(current.metadata.online?.match?.id).toBe("custom:1"),
  );
  expect(screen.getByText("已确认匹配")).toBeTruthy();
  expect(current.document?.entries[0].time).toBe(50);
});
