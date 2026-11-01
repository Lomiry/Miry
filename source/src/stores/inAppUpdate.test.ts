import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage = (_: unknown) => {};
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.mocked(invoke).mockReset();
});
const candidate = {
  version: "1.1.0",
  url: "https://github.com/Lomiry/Miry/releases/tag/v1.1.0",
  notes: "Notes",
  updateReady: true,
};
it("streams real bytes and unknown totals, rejects parallel downloads and survives remounts", async () => {
  let finish!: () => void;
  vi.mocked(invoke).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  const downloading = store.downloadUpdate();
  await store.downloadUpdate();
  const channel = (
    vi.mocked(invoke).mock.calls[0][1] as {
      onProgress: { onmessage: (p: unknown) => void };
    }
  ).onProgress;
  channel.onmessage({
    phase: "downloading",
    downloaded: 1048576,
    total: null,
    bytesPerSecond: 524288,
  });
  expect(store.updateSnapshot()).toMatchObject({
    phase: "downloading",
    total: null,
    downloaded: 1048576,
    bytesPerSecond: 524288,
  });
  store.minimizeUpdate(true);
  expect(store.updateSnapshot().minimized).toBe(true);
  channel.onmessage({
    phase: "verifying",
    downloaded: 1048576,
    total: null,
    bytesPerSecond: 0,
  });
  expect(store.updateSnapshot()).toMatchObject({
    phase: "verifying",
    downloaded: 1048576,
  });
  finish();
  await downloading;
  expect(store.updateSnapshot().phase).toBe("ready");
  channel.onmessage({ phase: "downloading", downloaded: 0 });
  expect(store.updateSnapshot().phase).toBe("ready");
  expect(invoke).toHaveBeenCalledTimes(1);
});
it.each(["下载失败，重试", "验证失败，签名无效或版本不匹配，已停止安装"])(
  "keeps %s recoverable without installation",
  async (error) => {
    vi.mocked(invoke).mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const store = await import("./inAppUpdate");
    store.offerUpdate(candidate);
    await store.downloadUpdate();
    expect(store.updateSnapshot()).toMatchObject({ phase: "error", error });
    await store.installUpdate(vi.fn(), true);
    expect(invoke).toHaveBeenCalledTimes(1);
    await store.downloadUpdate();
    expect(store.updateSnapshot().phase).toBe("ready");
  },
);
it("blocks native starts before awaiting final playback persistence and hands off only once", async () => {
  const calls: string[] = [];
  vi.mocked(invoke).mockImplementation(async (command) => {
    calls.push(command);
  });
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  await store.downloadUpdate();
  let stopped!: () => void;
  const prepare = vi.fn(
    () =>
      new Promise<void>((r) => {
        calls.push("queue.stop");
        stopped = r;
      }),
  );
  const installing = store.installUpdate(prepare, false);
  await Promise.resolve();
  await store.installUpdate(prepare, true);
  expect(calls).toEqual([
    "download_update",
    "prepare_update_install",
    "queue.stop",
  ]);
  expect(store.updateSnapshot().phase).toBe("installing");
  stopped();
  await installing;
  expect(invoke).toHaveBeenLastCalledWith("install_update", { restart: false });
  expect(prepare).toHaveBeenCalledTimes(1);
});
it("never installs after a stop failure and releases the shutdown gate", async () => {
  vi.mocked(invoke).mockResolvedValue(undefined);
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  await store.downloadUpdate();
  await store.installUpdate(async () => {
    throw Error("stop failed");
  }, true);
  expect(invoke).toHaveBeenLastCalledWith("cancel_update_install");
  expect(
    vi.mocked(invoke).mock.calls.some(([cmd]) => cmd === "install_update"),
  ).toBe(false);
  expect(store.updateSnapshot().phase).toBe("error");
});

it.each([false, undefined])(
  "blocks download and install when signing readiness is %s",
  async (updateReady) => {
    const store = await import("./inAppUpdate");
    store.offerUpdate({ ...candidate, updateReady });
    await store.downloadUpdate();
    await store.installUpdate(vi.fn(), true);
    expect(invoke).not.toHaveBeenCalled();
    expect(store.updateSnapshot().phase).toBe("error");
  },
);

it("cancels an owned download, ignores late progress/completion and permits a fresh retry", async () => {
  let finish!: () => void;
  vi.mocked(invoke).mockImplementation((command) =>
    command === "download_update"
      ? new Promise<void>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(),
  );
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  const pending = store.downloadUpdate();
  const args = vi.mocked(invoke).mock.calls[0][1] as {
    requestId: string;
    onProgress: { onmessage: (value: unknown) => void };
  };
  await store.cancelDownload();
  expect(invoke).toHaveBeenLastCalledWith("cancel_update_download", {
    requestId: args.requestId,
  });
  expect(store.updateSnapshot().phase).toBe("cancelling");
  args.onProgress.onmessage({ phase: "verifying" });
  store.offerUpdate({ ...candidate, version: "2.0.0" });
  store.clearUpdate();
  await store.downloadUpdate();
  expect(store.updateSnapshot().release?.version).toBe(candidate.version);
  expect(invoke).toHaveBeenCalledTimes(2);
  finish();
  await pending;
  expect(store.updateSnapshot().phase).toBe("cancelled");
  await store.installUpdate(vi.fn(), true);
  expect(invoke).toHaveBeenCalledTimes(2);
  vi.mocked(invoke).mockResolvedValue(undefined);
  await store.downloadUpdate();
  expect(store.updateSnapshot().phase).toBe("ready");
  const retry = vi.mocked(invoke).mock.calls[2][1] as { requestId: string };
  expect(retry.requestId).not.toBe(args.requestId);
  args.onProgress.onmessage({ phase: "downloading" });
  expect(store.updateSnapshot().phase).toBe("ready");
});

it("keeps cancellation safe when the cancellation IPC fails and the original download later rejects", async () => {
  let fail!: (reason: string) => void;
  vi.mocked(invoke).mockImplementation((command) =>
    command === "download_update"
      ? new Promise<void>((_, reject) => {
          fail = reject;
        })
      : Promise.reject("IPC failed"),
  );
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  const pending = store.downloadUpdate();
  await store.cancelDownload();
  expect(store.updateSnapshot().phase).toBe("cancelling");
  fail("download timeout");
  await pending;
  expect(store.updateSnapshot().phase).toBe("cancelled");
  await store.installUpdate(vi.fn(), true);
  expect(invoke).toHaveBeenCalledTimes(2);
});

it("never calls playback preparation when the native shutdown gate rejects", async () => {
  vi.mocked(invoke).mockResolvedValue(undefined);
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  await store.downloadUpdate();
  vi.mocked(invoke).mockRejectedValueOnce("Application is exiting");
  const prepare = vi.fn();
  await store.installUpdate(prepare, true);
  expect(prepare).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenLastCalledWith("cancel_update_install");
  expect(
    vi.mocked(invoke).mock.calls.some(([cmd]) => cmd === "install_update"),
  ).toBe(false);
});

it("retains the app after a failed final save or installer handoff and does not automatically retry", async () => {
  vi.mocked(invoke).mockResolvedValue(undefined);
  const store = await import("./inAppUpdate");
  store.offerUpdate(candidate);
  await store.downloadUpdate();
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "install_update")
      throw Error("Final save receipt timed out");
  });
  await store.installUpdate(vi.fn(), true);
  expect(store.updateSnapshot().phase).toBe("error");
  expect(invoke).toHaveBeenLastCalledWith("cancel_update_install");
  expect(
    vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "install_update"),
  ).toHaveLength(1);
});
