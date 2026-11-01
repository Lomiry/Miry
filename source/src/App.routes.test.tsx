import { pickSelect } from "./testSelect"; // @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import App from "./App";
import { saveAccount } from "./stores/account";
import { readAccount } from "./stores/account";
import { connectionId } from "./stores/connections";
import { saveRoute } from "./stores/routes";
import { recordHistory, readHistory } from "./stores/history";
import type { PlayerSnapshot } from "./player/playback";
import { EmbyClient } from "./api/client";
import {
  normalizeMetrics,
  saveRouteTest,
  setRouteMode,
  readRouteQuality,
} from "./player/smartRoutes";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
const nativeEvents = vi.hoisted(
  () => new Map<string, (event: { payload: string }) => void>(),
);
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (name: string, handler: (event: { payload: string }) => void) => {
      nativeEvents.set(name, handler);
      return () => nativeEvents.delete(name);
    },
  ),
}));
const account = {
  server: "https://a.test/emby",
  serverId: "server-a",
  userId: "u",
  token: "secret",
  name: "A",
  deviceId: "d",
};
const movie = {
  Id: "m",
  Name: "线路测试影片",
  Type: "Movie",
  MediaSources: [
    { Id: "s1", Name: "原版" },
    { Id: "s2", Name: "备用版" },
  ],
};
let snapshot: PlayerSnapshot;

it("acknowledges only persisted final samples and preserves the final position across remount", async () => {
  saveAccount(account, false);
  const view = render(<App />);
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
    );
  await waitFor(() => expect(snapshot.active).toBe(true));
  const final = {
    ...snapshot,
    itemId: movie.Id,
    active: false,
    position: 123,
    syncComplete: true,
    persistenceId: "close-1",
  };
  const send = (payload: typeof final) =>
    act(() =>
      nativeEvents.get("player-final-snapshot")!({ payload: payload as never }),
    );
  send(final);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_final_saved", {
      persistenceId: "close-1",
      persisted: true,
    }),
  );
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    1230000000,
  );
  const savedAt = readHistory(account)[0].at;
  send(final);
  expect(readHistory(account)[0].at).toBe(savedAt);
  send({
    ...final,
    playSessionId: "old-session",
    position: 1,
    persistenceId: "stale",
  });
  expect(invoke).toHaveBeenCalledWith("player_final_saved", {
    persistenceId: "stale",
    persisted: false,
  });
  view.unmount();
  render(<App />);
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    1230000000,
  );
});

it("returns a failed final-save receipt on quota failure and permits a later successful sample", async () => {
  saveAccount(account, false);
  render(<App />);
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
    );
  await waitFor(() => expect(snapshot.active).toBe(true));
  const final = {
    ...snapshot,
    itemId: movie.Id,
    active: false,
    position: 234,
    syncComplete: true,
    persistenceId: "quota",
  };
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });
  const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
  act(() =>
    nativeEvents.get("player-final-snapshot")!({ payload: final as never }),
  );
  expect(invoke).toHaveBeenCalledWith("player_final_saved", {
    persistenceId: "quota",
    persisted: false,
  });
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).not.toBe(
    2340000000,
  );
  write.mockRestore();
  act(() =>
    nativeEvents.get("player-final-snapshot")!({
      payload: { ...final, persistenceId: "retry" } as never,
    }),
  );
  expect(invoke).toHaveBeenCalledWith("player_final_saved", {
    persistenceId: "retry",
    persisted: true,
  });
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    2340000000,
  );
  diagnostic.mockRestore();
});
beforeEach(() => {
  vi.clearAllMocks();
  nativeEvents.clear();
  localStorage.clear();
  sessionStorage.clear();
  snapshot = {
    active: false,
    title: "",
    position: 0,
    duration: 600,
    loaded: true,
    paused: false,
    volume: 75,
    muted: false,
    tracks: [],
    finished: false,
    error: "",
    syncError: "",
  };
  vi.mocked(invoke).mockImplementation(async (command, args: unknown) => {
    if (command === "player_status") return snapshot as never;
    if (command === "player_start") {
      const { launch } = args as {
        launch: { playSessionId: string; startSeconds: number };
      };
      snapshot = {
        ...snapshot,
        active: true,
        title: movie.Name,
        itemId: movie.Id,
        playSessionId: launch.playSessionId,
        position: launch.startSeconds,
      };
    }
    if (command === "player_stop") snapshot = { ...snapshot, active: false };
    return undefined as never;
  });
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    const url = new URL(String(address)),
      path = url.pathname;
    let result: unknown;
    if (path.endsWith("/Users/u")) result = { Id: "u" };
    else if (path.endsWith("/System/Info/Public"))
      result = { Id: "server-a", ServerName: "A", Version: "4.9" };
    else if (path.endsWith("/PlaybackInfo")) {
      const body = JSON.parse(String(options?.body));
      result = {
        PlaySessionId: url.hostname + "-" + (body.MediaSourceId || "s1"),
        MediaSources: movie.MediaSources.map((s) => ({
          ...s,
          SupportsDirectPlay: true,
        })),
      };
    } else if (path.endsWith("/Items/m")) result = movie;
    else if (path.endsWith("/Latest")) result = [movie];
    else if (/Views|Resume|NextUp|Genres/.test(path))
      result = { Items: [], TotalRecordCount: 0 };
    else result = { Items: [movie], TotalRecordCount: 1 };
    return new Response(JSON.stringify(result));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("falls back on an idle connection failure only in auto mode", async () => {
  saveAccount(account, false);
  saveRoute(account, {
    name: "Backup",
    url: "https://fallback.test/emby",
    serverId: account.serverId,
    userId: account.userId,
    priority: 1,
  });
  setRouteMode(account, "auto");
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    if (String(address).startsWith(account.server))
      throw Error("connection refused");
    return original(address, options);
  });
  render(<App />);
  await waitFor(() =>
    expect(readAccount()?.server).toBe("https://fallback.test/emby"),
  );
  expect(readAccount()?.homeServer).toBe(account.server);
  expect(readAccount()?.token).toBe(account.token);
  expect(invoke).not.toHaveBeenCalledWith("player_start", expect.anything());
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).endsWith("/System/Info/Public"),
      ),
  ).toHaveLength(1);
});
it("leaves a failed manual connection locked instead of silently using a backup", async () => {
  saveAccount(account, false);
  saveRoute(account, {
    name: "Backup",
    url: "https://fallback.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  });
  vi.mocked(fetch).mockRejectedValue(Error("connection refused"));
  render(<App />);
  await screen.findByRole("alert");
  expect(readAccount()?.server).toBe(account.server);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every(([url]) => String(url).startsWith(account.server)),
  ).toBe(true);
});
it("updates a display remark without rebuilding metadata connections", async () => {
  saveAccount(account, false);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "快速播放 线路测试影片" });
  await user.click(screen.getByRole("button", { name: "编辑服务器与线路" }));
  const before = vi.mocked(fetch).mock.calls.length;
  await user.click(
    screen.getByText("服务器名称与图标", { selector: "summary" }),
  );
  await user.type(screen.getByLabelText("服务器备注"), "Library note");
  await user.click(screen.getByRole("button", { name: "保存修改" }));
  expect(readAccount()?.remark).toBe("Library note");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(before);
});
it("opens route management from the sidebar and reopens without duplicate state", async () => {
  saveAccount(account, false);
  saveRoute(account, {
    name: "备用线路",
    url: "https://b.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  });
  const user = userEvent.setup();
  render(<App />);
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.click(await screen.findByRole("button", { name: "设置" }));
    expect(screen.queryByRole("tab", { name: "网络 / 线路" })).toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "编辑服务器与线路" }));
    const dialog = await screen.findByRole("dialog", { name: "服务器与线路" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getAllByText(account.server).length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getAllByRole("article")).toHaveLength(2);
    expect(
      within(dialog).getByText("默认线路 · 当前").closest("article"),
    ).toHaveProperty("ariaCurrent", "true");
    expect(
      within(dialog).getByText("连接诊断", { selector: "summary" }),
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
});
it("owns system media events once and sends explicit play/pause rather than toggling", async () => {
  saveAccount(account, false);
  render(<App />);
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
    );
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("system_media_update", {
      info: expect.objectContaining({ active: true }),
    }),
  );
  vi.mocked(invoke).mockClear();
  nativeEvents.get("system-media-action")!({ payload: "pause" });
  nativeEvents.get("system-media-action")!({ payload: "play" });
  await waitFor(() => {
    const controls = vi
      .mocked(invoke)
      .mock.calls.filter(([c]) => c === "player_control");
    expect(controls).toEqual([
      ["player_control", { action: "setPaused", value: 1 }],
      ["player_control", { action: "setPaused", value: 0 }],
    ]);
  });
});
it("continues local interruption with the selected version and tracks independently of server history", async () => {
  saveAccount(account, false);
  const original = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) =>
    command === "recovery_read"
      ? ({
          serverId: account.serverId,
          itemId: "m",
          sourceId: "s2",
          title: movie.Name,
          position: 320,
          audioIndex: 2,
          subtitleIndex: -1,
          version: "0.13.3",
          timestamp: Date.now(),
        } as never)
      : original(command, args),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "从中断位置继续" }),
  );
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_start", {
      launch: expect.objectContaining({
        startSeconds: 320,
        sourceId: "s2",
        audioIndex: 2,
        subtitleIndex: -1,
      }),
    }),
  );
  expect(
    screen.queryByRole("heading", { name: "上次播放意外中断" }),
  ).toBeNull();
});
it("ignores interruption without changing server history or starting playback", async () => {
  saveAccount(account, false);
  const original = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) =>
    command === "recovery_read"
      ? ({
          serverId: account.serverId,
          itemId: "m",
          sourceId: "s1",
          title: movie.Name,
          position: 320,
          version: "0.13.3",
          timestamp: Date.now(),
        } as never)
      : original(command, args),
  );
  render(<App />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "忽略中断记录" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "上次播放意外中断" }),
    ).toBeNull(),
  );
  expect(invoke).toHaveBeenCalledWith("recovery_clear");
  expect(invoke).not.toHaveBeenCalledWith("player_start", expect.anything());
});
it("adopts a recommended route only when idle and does not cancel itself when stop becomes busy", async () => {
  saveAccount(account, false);
  const backup = {
    name: "推荐",
    url: "https://backup.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  };
  saveRoute(account, backup);
  saveRouteTest(
    account,
    backup,
    normalizeMetrics({
      identityValid: true,
      apiTtfbMs: 20,
      failureRate: 0,
      samples: 3,
    }),
  );
  setRouteMode(account, "auto");
  render(<App />);
  await waitFor(() => expect(readAccount()?.server).toBe(backup.url));
  expect(invoke).not.toHaveBeenCalledWith("player_start", expect.anything());
});
it.each(["verification", "native", "stop"] as const)(
  "preserves a newer manual pin across the automatic %s await",
  async (window) => {
    saveAccount(account, false);
    const backup = {
      name: "Backup",
      url: "https://freeze-backup.test/emby",
      serverId: account.serverId,
      userId: account.userId,
    };
    saveRoute(account, backup);
    saveRouteTest(
      account,
      backup,
      normalizeMetrics({
        identityValid: true,
        apiTtfbMs: 20,
        failureRate: 0,
        samples: 3,
      }),
    );
    setRouteMode(account, "auto");
    let verified = false,
      blocked = false,
      release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (address, options) => {
      const result = await originalFetch(address, options);
      if (String(address) === backup.url + "/Users/u") {
        if (window === "verification") {
          blocked = true;
          await gate;
        }
        verified = true;
      }
      return result;
    });
    const originalInvoke = vi.mocked(invoke).getMockImplementation()!;
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (
        verified &&
        !blocked &&
        ((window === "native" && command === "player_status") ||
          (window === "stop" && command === "player_stop"))
      ) {
        blocked = true;
        await gate;
      }
      return originalInvoke(command, args);
    });
    render(<App />);
    await waitFor(() => expect(blocked).toBe(true));
    act(() => setRouteMode(account, "manual", account.server));
    await act(async () => release());
    expect(readAccount()?.server).toBe(account.server);
    expect(readRouteQuality(account)).toMatchObject({
      mode: "manual",
      pinned: account.server,
    });
  },
);
it("requires fresh verification after manual/auto intent changes during a pending switch", async () => {
  saveAccount(account, false);
  const backup = {
    name: "Backup",
    url: "https://intent.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  };
  saveRoute(account, backup);
  saveRouteTest(
    account,
    backup,
    normalizeMetrics({
      identityValid: true,
      apiTtfbMs: 20,
      failureRate: 0,
      samples: 3,
    }),
  );
  setRouteMode(account, "auto");
  let verified = false,
    blocked = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    const response = await originalFetch(address, options);
    if (String(address) === backup.url + "/Users/u") verified = true;
    return response;
  });
  const originalInvoke = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (verified && !blocked && command === "player_status") {
      blocked = true;
      await gate;
    }
    return originalInvoke(command, args);
  });
  render(<App />);
  await waitFor(() => expect(blocked).toBe(true));
  act(() => {
    setRouteMode(account, "manual", account.server);
    setRouteMode(account, "auto");
  });
  await act(async () => release());
  await waitFor(() => expect(readAccount()?.server).toBe(backup.url));
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).endsWith("/System/Info/Public"),
      ),
  ).toHaveLength(2);
});
it("discards an old automatic switch after unmount and another account is saved", async () => {
  saveAccount(account, false);
  const backup = {
    name: "Backup",
    url: "https://unmount.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  };
  saveRoute(account, backup);
  saveRouteTest(
    account,
    backup,
    normalizeMetrics({
      identityValid: true,
      apiTtfbMs: 20,
      failureRate: 0,
      samples: 3,
    }),
  );
  setRouteMode(account, "auto");
  let verified = false,
    blocked = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    const result = await originalFetch(address, options);
    if (String(address) === backup.url + "/Users/u") verified = true;
    return result;
  });
  const originalInvoke = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (verified && !blocked && command === "player_status") {
      blocked = true;
      await gate;
    }
    return originalInvoke(command, args);
  });
  const view = render(<App />);
  await waitFor(() => expect(blocked).toBe(true));
  view.unmount();
  const other = {
    ...account,
    server: "https://other.test/emby",
    serverId: "other",
    userId: "u2",
  };
  saveAccount(other, false);
  await act(async () => release());
  expect(readAccount()).toMatchObject(other);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "player_stop"),
  ).toHaveLength(0);
});
it("keeps the selected server when an old fallback identity request finishes late", async () => {
  const owner = { ...account, userId: "owner-late" };
  const other = {
    ...account,
    server: "https://other.test/emby",
    serverId: "other",
    userId: "u2",
  };
  saveAccount(other, false);
  saveAccount(owner, false);
  const backup = {
    name: "Backup",
    url: "https://pending-owner.test/emby",
    serverId: account.serverId,
    userId: owner.userId,
  };
  saveRoute(owner, backup);
  setRouteMode(owner, "auto");
  let blocked = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    if (String(address).startsWith(account.server))
      throw Error("synthetic connection refused");
    if (String(address) === backup.url + "/Users/owner-late") {
      blocked = true;
      await gate;
      return new Response(JSON.stringify({ Id: owner.userId }));
    }
    return originalFetch(address, options);
  });
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(blocked).toBe(true));
  await pickSelect(user, screen.getByLabelText("当前服务器"), {
    name: "other.test",
  });
  await waitFor(() => expect(readAccount()?.server).toBe(other.server));
  await act(async () => release());
  expect(readAccount()).toMatchObject(other);
});
it("serializes a manual choice of B after cancelling an automatic choice of A", async () => {
  saveAccount(account, false);
  const auto = {
    name: "Automatic A",
    url: "https://auto-a.test/emby",
    serverId: account.serverId,
    userId: account.userId,
  };
  const manual = {
    ...auto,
    name: "Manual B",
    url: "https://manual-b.test/emby",
  };
  saveRoute(account, auto);
  saveRoute(account, manual);
  saveRouteTest(
    account,
    auto,
    normalizeMetrics({
      identityValid: true,
      apiTtfbMs: 20,
      failureRate: 0,
      samples: 3,
    }),
  );
  setRouteMode(account, "auto");
  let verified = false,
    blocked = false,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (address, options) => {
    const response = await originalFetch(address, options);
    if (String(address) === auto.url + "/Users/u") verified = true;
    return response;
  });
  const originalInvoke = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (verified && !blocked && command === "player_status") {
      blocked = true;
      await gate;
    }
    return originalInvoke(command, args);
  });
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(blocked).toBe(true));
  await user.click(screen.getByRole("button", { name: "编辑服务器与线路" }));
  await user.click(
    within(screen.getByText("Manual B").closest("article")!).getByRole(
      "button",
      { name: "使用" },
    ),
  );
  expect(readRouteQuality(account)).toMatchObject({
    mode: "manual",
    pinned: manual.url,
  });
  await act(async () => release());
  await waitFor(() => expect(readAccount()?.server).toBe(manual.url));
  expect(readRouteQuality(account)).toMatchObject({
    mode: "manual",
    pinned: manual.url,
  });
});
it("keeps a favorite change when returning to a cached browsing page", async () => {
  saveAccount(account, false);
  const update = vi
    .spyOn(EmbyClient.prototype, "setFavorite")
    .mockResolvedValue({ IsFavorite: true });
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: /^查看详情 线路测试影片/ }),
  );
  await user.click(
    within(document.querySelector(".media-detail")!).getByRole("button", {
      name: "收藏",
    }),
  );
  await screen.findByRole("button", { name: "取消收藏" });
  await user.click(screen.getByRole("button", { name: "返回上一页" }));
  expect(
    (
      await screen.findByRole("button", { name: `取消收藏 ${movie.Name}` })
    ).getAttribute("aria-pressed"),
  ).toBe("true");
  update.mockRestore();
});
it("returns to the originating detail only after stop, preserves progress and removes the mini player", async () => {
  saveAccount(account, false);
  const user = userEvent.setup();
  render(<App />);
  const navigation = await screen.findByRole("navigation", {
    name: "主要导航",
  });
  expect(
    within(navigation).queryByRole("button", { name: "播放页面" }),
  ).toBeNull();
  await user.click(
    await screen.findByRole("button", { name: /^查看详情 线路测试影片/ }),
  );
  await user.click(await screen.findByRole("button", { name: "播放" }));
  await screen.findByLabelText("播放器控制");
  expect(
    within(navigation).queryByRole("button", { name: "播放页面" }),
  ).toBeNull();
  expect(invoke).toHaveBeenCalledWith("player_start", {
    launch: expect.objectContaining({ volume: 100 }),
  });
  snapshot = { ...snapshot, position: 1072, duration: 1800 };
  let finish!: () => void;
  const original = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_stop") {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      snapshot = { ...snapshot, active: false, syncComplete: true };
      return snapshot as never;
    }
    return original(command, args);
  });
  document.querySelector("main")!.scrollTop = 310;
  await user.click(
    within(screen.getByLabelText("播放器控制")).getByRole("button", {
      name: "退出播放",
    }),
  );
  expect(document.querySelector(".theater-shell")).toBeTruthy();
  finish();
  await waitFor(() =>
    expect(document.querySelector(".theater-shell")).toBeNull(),
  );
  expect(screen.queryByLabelText("播放器控制")).toBeNull();
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    10720000000,
  );
  expect(await screen.findByRole("heading", { name: movie.Name })).toBeTruthy();
  vi.mocked(invoke).mockImplementation(original);
  await user.click(screen.getByRole("button", { name: /继续播放/ }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_start", {
      launch: expect.objectContaining({ startSeconds: 1072 }),
    }),
  );
});
it("does not expose server B until server A has stopped and its final position is saved", async () => {
  const second = {
    ...account,
    server: "https://second.test/emby",
    serverId: "server-b",
    name: "B",
  };
  saveAccount(second, false);
  saveAccount(account, false);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
  );
  snapshot = { ...snapshot, position: 120 };
  const oldFinal = {
    ...snapshot,
    itemId: movie.Id,
    active: false,
    syncComplete: true,
    persistenceId: "old-server",
  };
  const original = vi.mocked(invoke).getMockImplementation()!;
  let finish!: () => void;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_stop") {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      snapshot = { ...snapshot, active: false, syncComplete: true };
      return snapshot as never;
    }
    return original(command, args);
  });
  await pickSelect(user, screen.getByLabelText("当前服务器"), "0");
  expect(readAccount()?.server).toBe(account.server);
  finish();
  await waitFor(() => expect(readAccount()?.server).toBe(second.server));
  expect(snapshot.active).toBe(false);
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    1200000000,
  );
  vi.mocked(invoke).mockImplementation(original);
  await user.click(
    await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
  );
  await waitFor(() => expect(snapshot.playSessionId).toBe("second.test-s1"));
  const newHistory = JSON.stringify(readHistory(second));
  act(() =>
    nativeEvents.get("player-final-snapshot")!({ payload: oldFinal as never }),
  );
  expect(invoke).toHaveBeenCalledWith("player_final_saved", {
    persistenceId: "old-server",
    persisted: false,
  });
  expect(JSON.stringify(readHistory(second))).toBe(newHistory);
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    1200000000,
  );
});
it("waits for the final sample before logout removes the account", async () => {
  saveAccount(account, false);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
  );
  snapshot = { ...snapshot, position: 240 };
  const original = vi.mocked(invoke).getMockImplementation()!;
  let finish!: () => void;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_stop") {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      snapshot = { ...snapshot, active: false, syncComplete: true };
      return snapshot as never;
    }
    return original(command, args);
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitem", { name: "退出登录" }));
  expect(readAccount()?.server).toBe(account.server);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) => String(url).endsWith("/Sessions/Logout")),
  ).toBe(false);
  finish();
  await screen.findByRole("heading", { name: "连接你的媒体库" });
  expect(readAccount()).toBeNull();
  expect(snapshot.active).toBe(false);
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    2400000000,
  );
  expect(screen.queryByLabelText("播放器控制")).toBeNull();
});
it("reclaims playback and saves progress before an expired login is removed", async () => {
  saveAccount(account, false);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
  );
  snapshot = { ...snapshot, position: 300 };
  const original = vi.mocked(invoke).getMockImplementation()!;
  let finish!: () => void;
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "player_stop") {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      snapshot = {
        ...snapshot,
        active: false,
        syncComplete: true,
        syncError: "HTTP 401",
      };
      return snapshot as never;
    }
    return original(command, args);
  });
  vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
  await user.click(screen.getByRole("button", { name: "刷新" }));
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(readAccount()?.server).toBe(account.server);
  finish();
  await screen.findByRole("heading", { name: "连接你的媒体库" });
  expect(readAccount()).toBeNull();
  expect(snapshot.active).toBe(false);
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    3000000000,
  );
  expect(screen.queryByLabelText("播放器控制")).toBeNull();
});
it("resumes a history entry at its local position when fresh server metadata has no progress", async () => {
  saveAccount(account, false);
  recordHistory(account, movie, 60);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "快速播放 线路测试影片" });
  await user.click(screen.getByRole("button", { name: "观看记录" }));
  const play = await screen.findByRole("button", {
    name: "快速播放 线路测试影片",
  });
  expect(play.textContent).toContain("继续播放 · 01:00");
  await user.click(play);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_start", {
      launch: expect.objectContaining({ itemId: "m", startSeconds: 60 }),
    }),
  );
});
it("switches routes only after stop and resumes the current version at the captured position", async () => {
  saveAccount(account, false);
  saveRoute(account, {
    name: "备用线路",
    url: "https://b.test/emby",
    serverId: "server-a",
    userId: account.userId,
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "快速播放 线路测试影片" }),
  );
  await user.click(await screen.findByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: "播放版本" }));
  await user.click(screen.getByRole("menuitemradio", { name: "备用版" }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_start", {
      launch: expect.objectContaining({ sourceId: "s2" }),
    }),
  );
  vi.mocked(invoke).mockClear();
  snapshot = { ...snapshot, position: 120 };
  await user.click(screen.getByRole("button", { name: "更多播放操作" }));
  await user.click(screen.getByRole("menuitem", { name: /线路/ }));
  await user.click(screen.getByRole("menuitemradio", { name: "备用线路" }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("player_start", {
      launch: expect.objectContaining({
        server: "https://b.test/emby",
        startSeconds: 120,
        sourceId: "s2",
      }),
    }),
  );
  const commands = vi.mocked(invoke).mock.calls.map((call) => call[0]);
  const starts = commands.flatMap((c, i) => (c === "player_start" ? [i] : []));
  expect(commands.slice(0, starts[0])).toContain("player_stop");
  expect(connectionId(readAccount()!)).toBe(connectionId(account));
  expect(readAccount()?.server).toBe("https://b.test/emby");
});
