// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import useDanmaku from "./useDanmaku";
import { onlineProvider } from "./dandanplay";
import { sourceDefaults } from "./sources";
import { readSettings, saveSettings } from "../stores/settings";
import { normalizeDanmaku } from "./types";
import { EmbyClient } from "../api/client";
import {
  saveAssociation,
  mappingIdentity,
  mediaContext,
  type DanmakuMatch,
} from "./online";
import { danmakuIdentity } from "./useLocalDanmaku";
import { normalizeSources } from "./sources";
import { t } from "../i18n/core";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
const api = new EmbyClient({
  server: "http://127.0.0.1:18196",
  serverId: "server",
  userId: "qa",
  name: "QA",
  token: "synthetic",
  deviceId: "qa",
});
const item = {
  Id: "episode",
  Name: "Episode 3",
  Type: "Episode",
  SeriesName: "Example",
  ParentIndexNumber: 2,
  IndexNumber: 3,
};
const candidate = {
  provider: "dandanplay" as const,
  id: "1",
  animeId: "1",
  title: "Example S02",
  episodeTitle: "第3集",
  movie: false,
  season: 2,
  episode: 3,
};
const config = {
  mode: "auto",
  sources: [
    ...sourceDefaults.sources,
    {
      id: "custom",
      name: "Custom",
      protocol: "logvar" as const,
      endpoint: "https://danmaku.example.com",
      enabled: true,
      priority: 1,
    },
  ],
};
const envelope = {
  success: true,
  animes: [
    {
      animeId: 1,
      animeTitle: "Example S02",
      type: "tvseries",
      episodes: [{ episodeId: 1, episodeTitle: "第3集" }],
    },
  ],
};
const comments = {
  comments: [
    { p: "2,1,16777215", m: "custom" },
    { p: "8,1,16777215", m: "repeat" },
    { p: "8,1,16777215", m: "repeat" },
  ],
};
beforeEach(() => {
  localStorage.clear();
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({ sources: config }),
  });
  vi.spyOn(onlineProvider, "match").mockRejectedValue({ kind: "timeout" });
  vi.spyOn(onlineProvider, "getComments").mockResolvedValue({
    format: "Online",
    skipped: 0,
    entries: [
      { time: 0, text: "old", mode: "scroll", color: "#ffffff", duration: 8 },
    ],
  });
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (name, args) => {
      if (name === "danmaku_online_status")
        return { configured: true, mock: true };
      if (name === "danmaku_source_request")
        return (args as { query: { kind: string } }).query.kind === "search"
          ? envelope
          : comments;
      return null;
    });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function saveMatch(match: DanmakuMatch = candidate, offset = 7) {
  const sourceKey = JSON.stringify(
    normalizeSources(readSettings().danmaku?.sources),
  );
  saveAssociation(
    mappingIdentity(danmakuIdentity(api, item).scope, item, sourceKey),
    mediaContext(item),
    match,
    offset,
  );
}
function requests() {
  return vi
    .mocked(invoke)
    .mock.calls.filter(([name]) => name === "danmaku_source_request")
    .map(
      ([, args]) =>
        args as { sourceId: string; query: { kind: string; id?: string } },
    );
}
it("aligns explicit LogVar video duration with current mpv duration without refetching or scaling the user offset", async () => {
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (
      name === "danmaku_source_request" &&
      (args as { query: { kind: string } }).query.kind === "comments"
    )
      return {
        videoDuration: 120,
        comments: [{ p: "60,1,16777215", m: "middle" }],
      };
    return previous(name, args);
  });
  const view = renderHook(
    ({ duration }) => useDanmaku(api, item, true, "duration-mapping", duration),
    {
      initialProps: { duration: 100 },
    },
  );
  await waitFor(() =>
    expect(view.result.current.document?.entries[0].time).toBe(50),
  );
  expect(view.result.current.metadata.density?.duration).toBe(100);
  const count = requests().length;
  view.rerender({ duration: 110 });
  expect(view.result.current.document?.entries[0].time).toBe(55);
  view.rerender({ duration: 100 });
  expect(view.result.current.document?.entries[0].time).toBe(50);
  expect(requests()).toHaveLength(count);
});
it("an approved LAN source keeps priority, skips disabled entries and falls back to DandanPlay", async () => {
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: {
        mode: "auto",
        sources: [
          { ...sourceDefaults.sources[0], priority: 9 },
          {
            ...config.sources[1],
            endpoint: "http://192.168.50.1:9321",
            allowLanHttp: true,
            priority: 1,
          },
          {
            ...config.sources[1],
            id: "disabled",
            endpoint: "http://10.0.0.2:9321",
            allowLanHttp: true,
            enabled: false,
            priority: 0,
          },
        ],
      },
    }),
  });
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [candidate],
    selected: candidate,
  });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (name === "danmaku_source_request") throw "network";
    return previous(name, args);
  });
  const view = renderHook(() =>
    useDanmaku(api, item, true, "lan-fallback", 20),
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("DandanPlay"),
  );
  expect(requests().map((q) => q.sourceId)).toEqual(["custom"]);
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_request",
    expect.objectContaining({ allowLanHttp: true }),
  );
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(view.result.current.metadata.online?.failures).toEqual([
    { source: "Custom", kind: "NETWORK_ERROR" },
  ]);
});
it("loads fallback once, reports the source and memoizes heatmap without new network requests", async () => {
  const view = renderHook(
    ({ duration }) => useDanmaku(api, item, true, "session", duration),
    { initialProps: { duration: 20 } },
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
  );
  expect(view.result.current.document?.entries).toHaveLength(3);
  expect(view.result.current.metadata.online?.failures).toEqual([
    { source: "DandanPlay", kind: "NETWORK_ERROR" },
  ]);
  expect(view.result.current.metadata.density?.duration).toBe(20);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([n]) => n === "danmaku_source_request"),
  ).toHaveLength(2);
  const heatmap = view.result.current.metadata.density;
  view.rerender({ duration: 20 });
  expect(view.result.current.metadata.density).toBe(heatmap);
  view.rerender({ duration: 40 });
  expect(view.result.current.metadata.density?.duration).toBe(40);
  await act(() => view.result.current.action("settings", { offset: 3 }));
  expect(view.result.current.metadata.density).not.toBe(heatmap);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([n]) => n === "danmaku_source_request"),
  ).toHaveLength(2);
  expect(readSettings().danmaku?.deduplicate).toBe(false);
});
it("switches modes immediately and rejects the old source's delayed result", async () => {
  let resolve!: (value: {
    candidates: (typeof candidate)[];
    selected: typeof candidate;
  }) => void;
  vi.mocked(onlineProvider.match).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = renderHook(() => useDanmaku(api, item, true, "session", 20));
  await waitFor(() => expect(onlineProvider.match).toHaveBeenCalled());
  await act(() =>
    view.result.current.action("source-mode", undefined, "custom"),
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
  );
  await act(async () =>
    resolve({ candidates: [candidate], selected: candidate }),
  );
  expect(view.result.current.document?.entries[0].text).toBe("custom");
  expect(onlineProvider.getComments).not.toHaveBeenCalled();
});
it("clears heatmap on media changes, stop, unknown duration and live channels", async () => {
  const view = renderHook(
    ({ media, active, duration }) =>
      useDanmaku(api, media, active, "session", duration),
    { initialProps: { media: item, active: true, duration: 20 } },
  );
  await waitFor(() => expect(view.result.current.document).not.toBeNull());
  view.rerender({ media: { ...item, Id: "next" }, active: true, duration: 20 });
  expect(view.result.current.metadata.density).toBeUndefined();
  await waitFor(() => expect(view.result.current.document).not.toBeNull());
  view.rerender({ media: item, active: true, duration: 0 });
  expect(view.result.current.metadata.density).toBeUndefined();
  view.rerender({
    media: { ...item, Type: "TvChannel" },
    active: true,
    duration: 20,
  });
  expect(view.result.current.metadata.density).toBeUndefined();
  view.rerender({ media: item, active: false, duration: 20 });
  expect(view.result.current.metadata.density).toBeUndefined();
});
it("source disablement cancels a pending custom request and does not accept its late response", async () => {
  await act(() =>
    saveSettings({
      ...readSettings(),
      danmaku: normalizeDanmaku({ sources: { ...config, mode: "custom" } }),
    }),
  );
  let resolve!: (v: unknown) => void;
  vi.mocked(invoke).mockImplementation(async (name) => {
    if (name === "danmaku_online_status")
      return { configured: false, mock: false };
    if (name === "danmaku_source_request")
      return new Promise((r) => {
        resolve = r;
      });
    return null;
  });
  const view = renderHook(() => useDanmaku(api, item, true, "session", 20));
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  await act(() =>
    view.result.current.action("settings", {
      sources: {
        ...config,
        mode: "custom",
        sources: config.sources.map((s) => ({ ...s, enabled: false })),
      },
    }),
  );
  await act(async () => resolve(envelope));
  expect(view.result.current.document).toBeNull();
  expect(view.result.current.metadata.online?.configured).toBe(false);
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_cancel",
    expect.anything(),
  );
});
it("restores a saved match with empty comments by falling back once without repeating its match or comments request", async () => {
  saveMatch();
  vi.mocked(onlineProvider.getComments).mockResolvedValue({
    format: "Online",
    skipped: 0,
    entries: [],
  });
  const view = renderHook(() => useDanmaku(api, item, true, "saved-empty", 20));
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
  );
  expect(view.result.current.document?.entries[0].text).toBe("custom");
  expect(view.result.current.metadata.offset).toBe(0);
  expect(view.result.current.metadata.online?.failures).toEqual([
    { source: "DandanPlay", kind: "NO_COMMENTS" },
  ]);
  expect(onlineProvider.match).not.toHaveBeenCalled();
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(requests().map((r) => [r.sourceId, r.query.kind, r.query.id])).toEqual(
    [
      ["custom", "search", undefined],
      ["custom", "comments", "1"],
    ],
  );
});
it("advances after a saved match timeout without searching or retrying the same source episode", async () => {
  saveMatch();
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [candidate],
    selected: candidate,
  });
  vi.mocked(onlineProvider.getComments).mockRejectedValue({ kind: "timeout" });
  const view = renderHook(() =>
    useDanmaku(api, item, true, "saved-timeout", 20),
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
  );
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(onlineProvider.match).not.toHaveBeenCalled();
  expect(requests()).toHaveLength(2);
});
it("ends with a no-comments result after every source is empty, without retrying or remaining busy", async () => {
  saveMatch();
  vi.mocked(onlineProvider.getComments).mockResolvedValue({
    format: "Online",
    skipped: 0,
    entries: [],
  });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) =>
    name === "danmaku_source_request" &&
    (args as { query: { kind: string } }).query.kind === "comments"
      ? { comments: [] }
      : previous(name, args),
  );
  const view = renderHook(() => useDanmaku(api, item, true, "all-empty", 20));
  await waitFor(() =>
    expect(view.result.current.metadata.online?.status).toBe(
      t("danmaku.title_found_but_no_danmaku_is_available"),
    ),
  );
  expect(view.result.current.metadata.online?.loading).toBe(false);
  expect(view.result.current.document).toBeNull();
  expect(
    view.result.current.metadata.online?.failures?.map((f) => f.kind),
  ).toEqual(["NO_COMMENTS", "NO_COMMENTS"]);
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(onlineProvider.match).not.toHaveBeenCalled();
  expect(requests().map((r) => r.query.kind)).toEqual(["search", "comments"]);
});
it.each(["dandanplay", "custom"])(
  "keeps an empty saved match in explicit %s mode without switching sources",
  async (mode) => {
    saveSettings({
      ...readSettings(),
      danmaku: normalizeDanmaku({ sources: { ...config, mode } }),
    });
    saveMatch(
      mode === "custom"
        ? { ...candidate, provider: "logvar", id: "custom:73" }
        : candidate,
    );
    vi.mocked(onlineProvider.getComments).mockResolvedValue({
      format: "Online",
      skipped: 0,
      entries: [],
    });
    const previous = vi.mocked(invoke).getMockImplementation()!;
    vi.mocked(invoke).mockImplementation(async (name, args) =>
      name === "danmaku_source_request"
        ? { comments: [] }
        : previous(name, args),
    );
    const view = renderHook(() =>
      useDanmaku(api, item, true, "single-empty", 20),
    );
    await waitFor(() =>
      expect(view.result.current.metadata.online?.sourceName).toBe(
        mode === "custom" ? "Custom" : "DandanPlay",
      ),
    );
    expect(view.result.current.document?.entries).toEqual([]);
    expect(view.result.current.metadata.online?.loading).toBe(false);
    expect(view.result.current.metadata.offset).toBe(7);
    expect(onlineProvider.match).not.toHaveBeenCalled();
    expect(onlineProvider.getComments).toHaveBeenCalledTimes(
      mode === "custom" ? 0 : 1,
    );
    expect(
      requests().map((r) => [r.sourceId, r.query.kind, r.query.id]),
    ).toEqual(mode === "custom" ? [["custom", "comments", "73"]] : []);
  },
);
it("finishes all-source failures with classified errors and no playback side effects", async () => {
  saveMatch();
  vi.mocked(onlineProvider.getComments).mockRejectedValue({ kind: "timeout" });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (
      name === "danmaku_source_request" &&
      (args as { query: { kind: string } }).query.kind === "comments"
    )
      throw "timeout";
    return previous(name, args);
  });
  const view = renderHook(() => useDanmaku(api, item, true, "all-failed", 20));
  await waitFor(() =>
    expect(view.result.current.metadata.online?.failures).toHaveLength(2),
  );
  expect(view.result.current.metadata.online?.loading).toBe(false);
  expect(view.result.current.document).toBeNull();
  expect(
    view.result.current.metadata.online?.failures?.map((f) => f.kind),
  ).toEqual(["NETWORK_ERROR", "NETWORK_ERROR"]);
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(onlineProvider.match).not.toHaveBeenCalled();
  expect(requests()).toHaveLength(2);
  expect(
    vi.mocked(invoke).mock.calls.some(([name]) => name.startsWith("player_")),
  ).toBe(false);
});
it("reuses each source's own ID and successful match after a saved custom source times out", async () => {
  saveMatch({ ...candidate, provider: "logvar", id: "custom:73" });
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [candidate],
    selected: candidate,
  });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (name === "danmaku_source_request") throw "timeout";
    return previous(name, args);
  });
  const view = renderHook(() =>
    useDanmaku(api, item, true, "protocol-isolation", 20),
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("DandanPlay"),
  );
  expect(onlineProvider.match).toHaveBeenCalledTimes(1);
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(vi.mocked(onlineProvider.getComments).mock.calls[0][0]).toBe("1");
  expect(requests().map((r) => [r.sourceId, r.query.kind, r.query.id])).toEqual(
    [["custom", "comments", "73"]],
  );
  expect(view.result.current.metadata.offset).toBe(0);
});
it("skips disabled sources and visits remaining sources in priority order after an empty restore", async () => {
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: {
        mode: "auto",
        sources: [
          { ...sourceDefaults.sources[0], enabled: false },
          { ...config.sources[1], priority: 5 },
          {
            ...config.sources[1],
            id: "disabled",
            name: "Disabled",
            enabled: false,
            priority: 0,
          },
          { ...config.sources[1], id: "fast", name: "Fast", priority: 1 },
        ],
      },
    }),
  });
  saveMatch({ ...candidate, provider: "logvar", id: "custom:73" });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) =>
    name === "danmaku_source_request" &&
    (args as { sourceId: string }).sourceId === "custom"
      ? { comments: [] }
      : previous(name, args),
  );
  const view = renderHook(() => useDanmaku(api, item, true, "priority", 20));
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Fast"),
  );
  expect(requests().map((r) => [r.sourceId, r.query.kind, r.query.id])).toEqual(
    [
      ["custom", "comments", "73"],
      ["fast", "search", undefined],
      ["fast", "comments", "1"],
    ],
  );
  expect(onlineProvider.match).not.toHaveBeenCalled();
  expect(onlineProvider.getComments).not.toHaveBeenCalled();
});
it("does not repeat a completed LogVar search when its comments time out", async () => {
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: {
        mode: "auto",
        sources: [
          { ...sourceDefaults.sources[0], enabled: false },
          config.sources[1],
          { ...config.sources[1], id: "second", name: "Second", priority: 2 },
        ],
      },
    }),
  });
  const previous = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    const r = args as { sourceId: string; query: { kind: string } };
    if (
      name === "danmaku_source_request" &&
      r.sourceId === "custom" &&
      r.query.kind === "comments"
    )
      throw "timeout";
    return previous(name, args);
  });
  const view = renderHook(() =>
    useDanmaku(api, item, true, "matched-timeout", 20),
  );
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Second"),
  );
  expect(requests().map((r) => [r.sourceId, r.query.kind])).toEqual([
    ["custom", "search"],
    ["custom", "comments"],
    ["second", "search"],
    ["second", "comments"],
  ]);
});
it.each(["switch", "stop"])(
  "rejects late restored comments after media %s",
  async (change) => {
    saveMatch();
    let resolve!: (
      v: Awaited<ReturnType<typeof onlineProvider.getComments>>,
    ) => void;
    vi.mocked(onlineProvider.getComments).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const view = renderHook(
      ({ media, active }) => useDanmaku(api, media, active, "isolation", 20),
      { initialProps: { media: item, active: true } },
    );
    await waitFor(() =>
      expect(onlineProvider.getComments).toHaveBeenCalledTimes(1),
    );
    view.rerender({
      media: { ...item, Id: "next" },
      active: change === "switch",
    });
    if (change === "switch")
      await waitFor(() =>
        expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
      );
    await act(async () =>
      resolve({
        format: "Online",
        skipped: 0,
        entries: [
          {
            time: 0,
            text: "stale",
            mode: "scroll",
            color: "#ffffff",
            duration: 8,
          },
        ],
      }),
    );
    expect(view.result.current.document?.entries[0].text).toBe(
      change === "switch" ? "custom" : undefined,
    );
    expect(requests()).toHaveLength(change === "switch" ? 2 : 0);
  },
);
it("allows an explicit reload to replace an unfinished reload without accepting its late response", async () => {
  saveMatch({ ...candidate, provider: "logvar", id: "custom:1" });
  const view = renderHook(() => useDanmaku(api, item, true, "reload", 20));
  await waitFor(() =>
    expect(view.result.current.metadata.online?.sourceName).toBe("Custom"),
  );
  let resolve!: (v: unknown) => void;
  const previous = vi.mocked(invoke).getMockImplementation()!;
  let commentRequests = 0;
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (name === "danmaku_source_request") {
      commentRequests++;
      if (commentRequests === 1)
        return new Promise((r) => {
          resolve = r;
        });
      return { comments: [{ p: "1,1,16777215", m: "refreshed" }] };
    }
    return previous(name, args);
  });
  let first!: Promise<void>;
  act(() => {
    first = view.result.current.action("reload");
  });
  await waitFor(() => expect(commentRequests).toBe(1));
  await act(() => view.result.current.action("reload"));
  expect(view.result.current.document?.entries[0].text).toBe("refreshed");
  await act(async () => {
    resolve({ comments: [{ p: "1,1,16777215", m: "stale" }] });
    await first;
  });
  expect(view.result.current.document?.entries[0].text).toBe("refreshed");
  expect(requests().map((r) => [r.sourceId, r.query.kind, r.query.id])).toEqual(
    Array.from({ length: 3 }, () => ["custom", "comments", "1"]),
  );
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_cancel",
    expect.anything(),
  );
  expect(onlineProvider.match).not.toHaveBeenCalled();
});
