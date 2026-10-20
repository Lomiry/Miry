// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import useDanmaku from "./useDanmaku";
import { EmbyClient } from "../api/client";
import { onlineProvider } from "./dandanplay";
import { association, mediaContext, mappingIdentity } from "./online";
import { danmakuIdentity } from "./useLocalDanmaku";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("./dandanplay", () => ({
  onlineProvider: {
    match: vi.fn(),
    search: vi.fn(),
    getComments: vi.fn(),
    clear: vi.fn(),
  },
}));
const item = { Id: "m1", Name: "Movie", Type: "Movie", ProductionYear: 1983 };
const match = {
  provider: "dandanplay" as const,
  id: "1",
  animeId: "1",
  title: "Movie",
  episodeTitle: "Movie",
  movie: true,
  year: 1983,
};
const document = {
  format: "Online" as const,
  entries: [
    {
      time: 0,
      text: "online",
      mode: "scroll" as const,
      color: "#ffffff",
      duration: 8,
    },
  ],
  skipped: 0,
};
const api = new EmbyClient({
  server: "http://127.0.0.1:18196",
  serverId: "server-a",
  userId: "qa",
  name: "QA",
  token: "synthetic",
  deviceId: "qa",
});
beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_online_status" ? { configured: true, mock: true } : null,
  );
  vi.mocked(onlineProvider.match)
    .mockReset()
    .mockResolvedValue({ candidates: [match], selected: match });
  vi.mocked(onlineProvider.search).mockReset().mockResolvedValue([match]);
  vi.mocked(onlineProvider.getComments).mockReset().mockResolvedValue(document);
});
afterEach(cleanup);
it("changes opacity during playback without searching, reloading comments or reinitializing mpv", async () => {
  const view = renderHook(() => useDanmaku(api, item, true, "opacity-session"));
  await waitFor(() => expect(view.result.current.document).toBe(document));
  for (const opacity of [0, 0.25, 0.5, 1, 0.37]) {
    await act(() => view.result.current.action("settings", { opacity }));
    expect(view.result.current.metadata.settings.opacity).toBe(opacity);
    expect(view.result.current.document).toBe(document);
  }
  expect(onlineProvider.match).toHaveBeenCalledTimes(1);
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
  expect(onlineProvider.search).not.toHaveBeenCalled();
  expect(vi.mocked(invoke).mock.calls.map(([name]) => name)).not.toContain(
    "player_start",
  );
});
it.each([
  [{ kind: "network" }, "无法连接"],
  [{ kind: "timeout" }, "无法连接"],
  [{ status: 401 }, "服务暂时不可用"],
  [{ status: 403 }, "服务暂时不可用"],
  [{ kind: "rate-limit", status: 200, code: 429 }, "请求受限"],
  [{ status: 500 }, "服务暂时不可用"],
  [Error("format"), "数据暂时不可用"],
  [{ kind: "cancelled" }, "已取消"],
])(
  "displays the actual failure category for %j without playback side effects",
  async (error, text) => {
    vi.mocked(onlineProvider.match).mockRejectedValue(error);
    const v = renderHook(() => useDanmaku(api, item, true));
    await waitFor(() =>
      expect(v.result.current.metadata.online?.status).toContain(text),
    );
    expect(v.result.current.metadata.online?.status).not.toContain(
      "网络错误或数据不可用",
    );
    expect(invoke).not.toHaveBeenCalledWith("player_stop", expect.anything());
  },
);
it("manual search after automatic NO_MATCH remains executable", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({ candidates: [] });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.status).toContain("未找到"),
  );
  await act(() => v.result.current.action("search", undefined, "Movie"));
  expect(v.result.current.metadata.online?.candidates[0].recommended).toBe(
    true,
  );
});
it("empty comments show NO_COMMENTS while recommendation and other candidates remain selectable", async () => {
  const matches = [
    { ...match, recommended: true },
    { ...match, id: "2", title: "Other" },
  ];
  vi.mocked(onlineProvider.match).mockResolvedValue({ candidates: matches });
  vi.mocked(onlineProvider.getComments).mockResolvedValue({
    ...document,
    entries: [],
  });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.candidates).toHaveLength(2),
  );
  await act(() => v.result.current.action("select", undefined, undefined, "1"));
  expect(v.result.current.metadata.online?.status).toBe(
    "已找到作品，但暂无可用弹幕",
  );
  expect(v.result.current.metadata.online?.candidates).toHaveLength(2);
  vi.mocked(onlineProvider.getComments).mockRejectedValueOnce({ status: 500 });
  await act(() => v.result.current.action("select", undefined, undefined, "2"));
  expect(v.result.current.metadata.online?.candidates).toHaveLength(2);
});
it("keeps the automatically selected recommendation visible after comment loading", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [{ ...match, recommended: true, reason: "标题和年份一致" }],
    selected: { ...match, recommended: true, reason: "标题和年份一致" },
  });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() => expect(v.result.current.document).toBe(document));
  expect(v.result.current.metadata.online?.candidates[0]).toMatchObject({
    recommended: true,
    reason: "标题和年份一致",
  });
});
it("shows reliable recommendation even if its comment download fails", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [{ ...match, recommended: true }],
    selected: { ...match, recommended: true },
  });
  vi.mocked(onlineProvider.getComments).mockRejectedValue({ status: 500 });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() => expect(onlineProvider.getComments).toHaveBeenCalled());
  await waitFor(() =>
    expect(v.result.current.metadata.online?.loading).toBe(false),
  );
  expect(v.result.current.metadata.online?.candidates[0].recommended).toBe(
    true,
  );
});
it("auto matches only an active established player and loads once, independent of seek/pause", async () => {
  const v = renderHook(({ active }) => useDanmaku(api, item, active), {
    initialProps: { active: false },
  });
  await waitFor(() =>
    expect(v.result.current.metadata.online?.configured).toBe(true),
  );
  expect(onlineProvider.match).not.toHaveBeenCalled();
  v.rerender({ active: true });
  await waitFor(() => expect(v.result.current.document).toBe(document));
  v.rerender({ active: true });
  expect(onlineProvider.match).toHaveBeenCalledTimes(1);
  expect(onlineProvider.getComments).toHaveBeenCalledTimes(1);
});
it("disabled/unconfigured online service produces zero provider requests", async () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ danmaku: { onlineEnabled: false } }),
  );
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.configured).toBe(true),
  );
  expect(onlineProvider.match).not.toHaveBeenCalled();
  v.unmount();
  localStorage.clear();
  vi.mocked(invoke).mockResolvedValue({ configured: false, mock: false });
  const n = renderHook(() => useDanmaku(api, item, true));
  await act(async () => {});
  expect(n.result.current.document).toBeNull();
  expect(onlineProvider.match).not.toHaveBeenCalled();
});
it("unconfigured Provider preserves local XML and explicit configuration restores online search", async () => {
  let configured = false;
  vi.mocked(invoke).mockImplementation(async (name) => {
    if (name === "danmaku_read")
      return {
        name: "local.xml",
        reference: "grant",
        text: '<i><d p="0,1,25,16777215">local</d></i>',
        offset: 0,
      };
    if (name === "danmaku_online_configure") configured = true;
    return { configured, mock: configured, builtIn: false };
  });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() => expect(v.result.current.document?.format).toBe("XML"));
  expect(v.result.current.metadata.online?.configured).toBe(false);
  expect(v.result.current.metadata.online?.status).toContain(
    "视频播放和本地弹幕可继续使用",
  );
  expect(onlineProvider.match).not.toHaveBeenCalled();
  await act(() => v.result.current.action("configure"));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.configured).toBe(true),
  );
  expect(v.result.current.document?.format).toBe("XML");
  await act(() => v.result.current.action("search", undefined, "Movie"));
  expect(onlineProvider.search).toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalledWith("player_stop", expect.anything());
  expect(localStorage.getItem("miry-settings") || "").not.toContain(
    "appSecret",
  );
});
it("local XML binding wins, then explicit manual online choice preserves binding", async () => {
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_read"
      ? {
          name: "local.xml",
          reference: "grant",
          text: '<i><d p="0,1,25,16777215">local</d></i>',
          offset: 2,
        }
      : name === "danmaku_online_status"
        ? { configured: true, mock: true }
        : null,
  );
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() => expect(v.result.current.document?.format).toBe("XML"));
  expect(onlineProvider.match).not.toHaveBeenCalled();
  await act(() => v.result.current.action("search", undefined, "Movie 1983"));
  await act(() => v.result.current.action("select", undefined, undefined, "1"));
  expect(v.result.current.document).toBe(document);
  expect(v.result.current.metadata.bound).toBe(true);
});
it("manual association survives endpoint switch and remains per item/user/server; offset never mutates comments", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({ candidates: [match] });
  const v = renderHook(
    ({ client, current }) => useDanmaku(client, current, true),
    { initialProps: { client: api, current: item } },
  );
  await waitFor(() =>
    expect(v.result.current.metadata.online?.candidates).toHaveLength(1),
  );
  await act(() => v.result.current.action("select", undefined, undefined, "1"));
  await act(() => v.result.current.action("settings", { offset: 3 }));
  const key = mappingIdentity(danmakuIdentity(api, item).scope, item);
  expect(association(key, mediaContext(item))).toMatchObject({
    match: { id: "1" },
    offset: 3,
  });
  expect(document.entries[0].time).toBe(0);
  v.rerender({
    client: new EmbyClient({
      ...api.account,
      server: "http://127.0.0.1:18197",
    }),
    current: item,
  });
  expect(v.result.current.document).toBe(document);
  expect(
    association(
      mappingIdentity(danmakuIdentity(api, item).scope, { ...item, Id: "m2" }),
      mediaContext(item),
    ),
  ).toBeUndefined();
  expect(
    association(key, mediaContext({ ...item, ProductionYear: 2001 })),
  ).toBeUndefined();
  v.unmount();
  const automaticCalls = vi.mocked(onlineProvider.match).mock.calls.length;
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [{ ...match, id: "2" }],
    selected: { ...match, id: "2" },
  });
  const saved = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() => expect(saved.result.current.document).toBe(document));
  expect(onlineProvider.match).toHaveBeenCalledTimes(automaticCalls);
  expect(saved.result.current.metadata.online?.match?.id).toBe("1");
  expect(saved.result.current.metadata.offset).toBe(3);
});
it("ranks manual searches without loading a recommendation and cancels late searches", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({ candidates: [] });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.loading).toBe(false),
  );
  await waitFor(() =>
    expect(v.result.current.metadata.online?.configured).toBe(true),
  );
  await act(() => v.result.current.action("search", undefined, " "));
  expect(onlineProvider.search).not.toHaveBeenCalled();
  let resolve!: (matches: (typeof match)[]) => void;
  vi.mocked(onlineProvider.search).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = v.result.current.action("search", undefined, "old");
  });
  const oldSignal = vi.mocked(onlineProvider.search).mock.calls[0][1];
  await act(() => v.result.current.action("search", undefined, "Movie 1983"));
  expect(oldSignal.aborted).toBe(true);
  expect(v.result.current.metadata.online?.candidates[0]).toMatchObject({
    id: "1",
    recommended: true,
    reason: "标题和年份一致",
  });
  expect(onlineProvider.getComments).not.toHaveBeenCalled();
  await act(async () => {
    resolve([{ ...match, id: "stale" }]);
    await pending;
  });
  expect(v.result.current.metadata.online?.candidates[0].id).toBe("1");
});
it("next item/back/unmount aborts pending comments and discards stale data", async () => {
  let resolve!: (d: typeof document) => void;
  vi.mocked(onlineProvider.getComments).mockImplementationOnce(
    () => new Promise((r) => (resolve = r)),
  );
  const v = renderHook(
    ({ current, active }) => useDanmaku(api, current, active),
    { initialProps: { current: item, active: true } },
  );
  await waitFor(() =>
    expect(onlineProvider.getComments).toHaveBeenCalledTimes(1),
  );
  const signal = vi.mocked(onlineProvider.getComments).mock.calls[0][1];
  v.rerender({ current: { ...item, Id: "m2" }, active: true });
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolve({
      ...document,
      entries: [{ ...document.entries[0], text: "stale" }],
    }),
  );
  await waitFor(() => expect(v.result.current.document).toBe(document));
  v.rerender({ current: { ...item, Id: "m2" }, active: false });
  expect(v.result.current.document).toBeNull();
  v.unmount();
});
it("network errors do not invoke any playback control and saved 404 can be rematched", async () => {
  vi.mocked(onlineProvider.getComments).mockRejectedValue({ status: 404 });
  const v = renderHook(() => useDanmaku(api, item, true));
  await waitFor(() =>
    expect(v.result.current.metadata.online?.status).toContain("已失效"),
  );
  expect(invoke).not.toHaveBeenCalledWith("player_stop", expect.anything());
  expect(v.result.current.document).toBeNull();
});
