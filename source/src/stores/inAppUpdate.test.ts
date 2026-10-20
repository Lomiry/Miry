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
