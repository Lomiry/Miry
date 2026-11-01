// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { readAccount, saveAccount } from "./stores/account";
import { readConnections } from "./stores/connections";
import { readHistory, recordHistory } from "./stores/history";
import { PlaybackQueue } from "./player/queue";
import { pickSelect } from "./testSelect";
import userEvent from "@testing-library/user-event";
import App from "./App";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => ({ active: false, title: "" })),
}));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(async () => new Response("unauthorized", { status: 401 })),
}));
beforeEach(() => {
  vi.mocked(invoke).mockReset().mockResolvedValue({ active: false, title: "" });
  vi.mocked(fetch)
    .mockReset()
    .mockImplementation(
      async () => new Response("unauthorized", { status: 401 }),
    );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

it("stops native playback when the server revokes the account", async () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ autoCheckUpdates: false, volume: 42 }),
  );
  sessionStorage.setItem(
    "miry-account",
    JSON.stringify({
      server: "https://host.test/emby",
      userId: "user",
      token: "secret",
      name: "Test",
      deviceId: "device",
    }),
  );
  render(<App />);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("check_release"));
  expect(
    await screen.findByRole("heading", { name: "连接你的媒体库" }),
  ).toBeTruthy();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("player_stop"));
  expect(sessionStorage.getItem("miry-account")).toBeNull();
});

const first = {
  server: "https://a.test/emby",
  serverId: "a",
  userId: "u",
  token: "test-a",
  name: "A",
  deviceId: "d",
};
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it.each([
  { ...first, userId: "b", token: "test-b", name: "B" },
  {
    ...first,
    server: "https://b.test/emby",
    serverId: "b",
    token: "test-b",
    name: "B",
  },
  { ...first, token: "new-login" },
  { ...first },
])(
  "preserves a replacement login after an old 401 stop completes: $server / $userId / $name",
  async (second) => {
    const stop = deferred();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "player_stop") {
        await stop.promise;
        return { active: false, title: "" };
      }
      return { active: false, title: "" };
    });
    saveAccount(first, false);
    const old = render(<App />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("player_stop"));
    old.unmount();
    saveAccount(second, false);
    const item = { Id: "b-item", Name: "Replacement media", Type: "Movie" };
    recordHistory(second, item, 45);
    vi.mocked(fetch).mockImplementation(
      async (address) =>
        new Response(
          JSON.stringify(
            String(address).endsWith("/Views")
              ? { Items: [], TotalRecordCount: 0 }
              : { Items: [item], TotalRecordCount: 1 },
          ),
        ),
    );
    render(<App />);
    await screen.findByRole("button", { name: "快速播放 Replacement media" });
    const retained = JSON.stringify(readHistory(second));
    await act(async () => {
      stop.resolve();
      await stop.promise;
    });
    expect(readAccount()).toMatchObject(second);
    expect(
      readConnections().some(
        (c) =>
          c.account.token === second.token &&
          c.account.server === second.server &&
          c.account.userId === second.userId,
      ),
    ).toBe(true);
    expect(JSON.stringify(readHistory(second))).toBe(retained);
    expect(
      screen.queryByRole("heading", { name: "连接你的媒体库" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "快速播放 Replacement media" }),
    ).toBeTruthy();
  },
);

it("does not submit a stale stop failure after unmount during shutdown", async () => {
  const stop = deferred();
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "player_stop") await stop.promise;
    return { active: false, title: "" };
  });
  saveAccount(first, false);
  const view = render(<App />);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("player_stop"));
  view.unmount();
  await act(async () => {
    stop.reject(new Error("controlled stop failure"));
    await stop.promise.catch(() => {});
  });
  expect(readAccount()).toMatchObject(first);
});

it("rechecks ownership after a server switch in the mounted app", async () => {
  const stop = deferred();
  const stopping = vi
    .spyOn(PlaybackQueue.prototype, "stop")
    .mockImplementationOnce(() => stop.promise)
    .mockResolvedValue();
  const second = {
    ...first,
    server: "https://b.test/emby",
    serverId: "b",
    name: "B",
    token: "test-b",
  };
  saveAccount(second, false);
  saveAccount(first, false);
  vi.mocked(fetch).mockImplementation(async (address) => {
    if (String(address).includes("a.test"))
      return new Response("unauthorized", { status: 401 });
    return new Response(
      JSON.stringify({
        Items: [{ Id: "b-item", Name: "B media", Type: "Movie" }],
        TotalRecordCount: 1,
      }),
    );
  });
  render(<App />);
  await waitFor(() => expect(stopping).toHaveBeenCalledTimes(1));
  await pickSelect(userEvent.setup(), screen.getByLabelText("当前服务器"), "0");
  await screen.findByRole("button", { name: "快速播放 B media" });
  expect(readAccount()).toMatchObject(second);
  await act(async () => {
    stop.resolve();
    await stop.promise;
  });
  expect(readAccount()).toMatchObject(second);
  expect(screen.getByRole("button", { name: "快速播放 B media" })).toBeTruthy();
  expect(
    readConnections().find((c) => c.account.server === second.server)?.account,
  ).toMatchObject(second);
});

it("coalesces concurrent current-account 401 responses into one invalidation", async () => {
  const stop = deferred();
  const stopping = vi
    .spyOn(PlaybackQueue.prototype, "stop")
    .mockImplementation(() => stop.promise);
  saveAccount(first, false);
  let rejectedRequests = 0;
  vi.mocked(fetch).mockImplementation(async (address) => {
    if (String(address).endsWith("/Views"))
      return new Response(JSON.stringify({ Items: [] }));
    rejectedRequests++;
    return new Response("unauthorized", { status: 401 });
  });
  render(<App />);
  await waitFor(() => expect(rejectedRequests).toBeGreaterThanOrEqual(3));
  await waitFor(() => expect(stopping).toHaveBeenCalledTimes(1));
  await act(async () => {
    stop.resolve();
    await stop.promise;
  });
  await screen.findByRole("heading", { name: "连接你的媒体库" });
  expect(readAccount()).toBeNull();
  expect(readConnections()).toEqual([]);
  expect(stopping).toHaveBeenCalledTimes(1);
});
