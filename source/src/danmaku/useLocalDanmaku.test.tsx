// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { EmbyClient } from "../api/client";
import useLocalDanmaku, { danmakuIdentity } from "./useLocalDanmaku";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => null),
}));
const api = new EmbyClient({
  name: "QA",
  server: "http://localhost:18196",
  serverId: "server-a",
  userId: "user",
  token: "synthetic",
  deviceId: "qa",
});
const item = { Id: "e1", Name: "Same", Type: "Episode" };
const file = {
  reference: "local-grant",
  name: "local.xml",
  text: '<i><d p="0,1,25,16777215">测试</d></i>',
  offset: 1.5,
};
beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(null);
});
afterEach(cleanup);
it("identifies server and episode independently and stays stable across a route switch", () => {
  const other = new EmbyClient({
    ...api.account,
    server: "http://localhost:18197",
  });
  expect(danmakuIdentity(api, item)).toEqual(danmakuIdentity(other, item));
  expect(danmakuIdentity(api, item)).not.toEqual(
    danmakuIdentity(api, { ...item, Id: "e2" }),
  );
  expect(danmakuIdentity(api, item)).not.toEqual(
    danmakuIdentity(
      new EmbyClient({ ...api.account, serverId: "server-b" }),
      item,
    ),
  );
});
it("loads saved binding and restores file offset, then unbinds without stopping playback", async () => {
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_read" ? file : null,
  );
  const view = renderHook(() => useLocalDanmaku(api, item));
  await waitFor(() =>
    expect(view.result.current.document?.entries).toHaveLength(1),
  );
  expect(view.result.current.metadata.offset).toBe(1.5);
  await act(() => view.result.current.action("unbind"));
  expect(view.result.current.document).toBeNull();
  expect(invoke).not.toHaveBeenCalledWith("player_stop", expect.anything());
});
it("shows a missing file warning and still allows clearing its binding", async () => {
  vi.mocked(invoke).mockImplementation(async (name) => {
    if (name === "danmaku_read")
      throw Error("弹幕文件不可用，请重新选择或解除绑定。");
    return null;
  });
  const view = renderHook(() => useLocalDanmaku(api, item));
  await waitFor(() =>
    expect(view.result.current.metadata.status).toContain("不可用"),
  );
  expect(view.result.current.metadata.bound).toBe(true);
  await act(() => view.result.current.action("unbind"));
  expect(view.result.current.metadata.bound).toBe(false);
});
it("binds only a successfully parsed native grant; invalid replacement keeps existing data", async () => {
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_read"
      ? file
      : name === "danmaku_pick"
        ? { ...file, text: "broken" }
        : null,
  );
  const view = renderHook(() => useLocalDanmaku(api, item));
  await waitFor(() => expect(view.result.current.document).not.toBeNull());
  await act(() => view.result.current.action("choose"));
  expect(view.result.current.document?.entries).toHaveLength(1);
  expect(
    vi.mocked(invoke).mock.calls.some(([name]) => name === "danmaku_bind"),
  ).toBe(false);
});
it("discards a delayed file pick after media changes", async () => {
  let finish!: (v: unknown) => void;
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_pick" ? new Promise((r) => (finish = r)) : null,
  );
  const view = renderHook(({ current }) => useLocalDanmaku(api, current), {
    initialProps: { current: item },
  });
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.action("choose");
  });
  view.rerender({ current: { ...item, Id: "e2" } });
  await act(async () => {
    finish(file);
    await pending;
  });
  expect(view.result.current.document).toBeNull();
  expect(
    vi.mocked(invoke).mock.calls.some(([name]) => name === "danmaku_bind"),
  ).toBe(false);
});
it("persists a tenth-second file offset and independent global filters", async () => {
  vi.mocked(invoke).mockImplementation(async (name) =>
    name === "danmaku_read" ? file : null,
  );
  const view = renderHook(() => useLocalDanmaku(api, item));
  await waitFor(() => expect(view.result.current.document).not.toBeNull());
  await act(() =>
    view.result.current.action("settings", { offset: -0.3, blockTop: true }),
  );
  expect(invoke).toHaveBeenCalledWith("danmaku_binding", {
    ...danmakuIdentity(api, item),
    offset: -0.3,
  });
  expect(view.result.current.metadata.settings.blockTop).toBe(true);
  await act(() => view.result.current.action("toggle"));
  expect(view.result.current.metadata.settings.enabled).toBe(false);
});
