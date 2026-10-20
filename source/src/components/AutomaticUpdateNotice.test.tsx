// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
  Channel: class {
    onmessage = (_: unknown) => {};
  },
}));
const release = (version = "1.1.0", newer = true) => ({
  version,
  newer,
  notes: "改进与修复",
  url: `https://github.com/Lomiry/Miry/releases/tag/v${version}`,
});
beforeEach(() => {
  vi.resetModules();
  vi.mocked(invoke).mockReset().mockResolvedValue(release());
  vi.mocked(isTauri).mockReturnValue(true);
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const load = async () => (await import("./AutomaticUpdateNotice")).default;
const settle = () => act(async () => {});

it("checks on startup once through StrictMode and remounts, including an in-flight manual check", async () => {
  let resolve!: (value: ReturnType<typeof release>) => void;
  vi.mocked(invoke).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const Notice = await load();
  const view = render(
    <StrictMode>
      <Notice blocked={false} />
    </StrictMode>,
  );
  const { checkRelease } = await import("../release");
  const manual = checkRelease();
  view.unmount();
  render(<Notice blocked={false} />);
  await act(async () => {
    resolve(release());
    await manual;
  });
  expect(await screen.findByText("发现 Miry 新版本")).toBeTruthy();
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("改进与修复")).toBeTruthy();
});
it("checks once per launch without an interval, including failures", async () => {
  vi.mocked(invoke).mockRejectedValue("GitHub 访问受限");
  let store = await import("../stores/automaticUpdates");
  await store.automaticUpdate();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 86400000);
  await store.automaticUpdate();
  expect(invoke).toHaveBeenCalledTimes(1);
  vi.resetModules();
  store = await import("../stores/automaticUpdates");
  await store.automaticUpdate();
  expect(invoke).toHaveBeenCalledTimes(2);
});
it("does not request in browser preview", async () => {
  vi.mocked(isTauri).mockReturnValue(false);
  const Notice = await load();
  render(<Notice blocked={false} />);
  await settle();
  expect(invoke).not.toHaveBeenCalled();
});
it.each(["", "a".repeat(1000)])(
  "shows bounded notes or a fallback",
  async (notes) => {
    vi.mocked(invoke).mockResolvedValue({ ...release(), notes });
    const Notice = await load();
    render(<Notice blocked={false} />);
    await screen.findByRole("dialog");
    expect(
      screen.getByText(notes ? notes.slice(0, 600) : "新版本已发布。"),
    ).toBeTruthy();
  },
);
it("ignores a late result after unmounting", async () => {
  let resolve!: (value: ReturnType<typeof release>) => void;
  vi.mocked(invoke).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const Notice = await load();
  const view = render(<Notice blocked={false} />);
  view.unmount();
  await act(async () => resolve(release()));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it.each(["timeout", "HTTP 403", "HTTP 429", "invalid response", "network"])(
  "keeps automatic failure %s silent",
  async (error) => {
    vi.mocked(invoke).mockRejectedValue(error);
    const Notice = await load();
    render(<Notice blocked={false} />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
  },
);
it.each([
  ["1.0.7", false],
  ["1.0.4", false],
  ["2.0.0-rc.1", true],
  ["bad", true],
] as const)(
  "does not notify for version %s / newer=%s",
  async (version, newer) => {
    vi.mocked(invoke).mockResolvedValue(release(version, newer));
    const Notice = await load();
    render(<Notice blocked={false} />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  },
);
it("defers a pending notice while playing and hides an already visible notice without dismissing it", async () => {
  const Notice = await load();
  const view = render(<Notice blocked />);
  await settle();
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<Notice blocked={false} />);
  expect(await screen.findByText("发现 Miry 新版本")).toBeTruthy();
  view.rerender(<Notice blocked />);
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<Notice blocked={false} />);
  expect(screen.getByText("发现 Miry 新版本")).toBeTruthy();
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
});
it("dismisses only for this run and checks/reminds again on the next launch", async () => {
  let Notice = await load();
  let view = render(<Notice blocked={false} />);
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "暂不更新" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  view.unmount();
  view = render(<Notice blocked={false} />);
  await settle();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(localStorage.length).toBe(0);
  view.unmount();
  vi.resetModules();
  Notice = await load();
  render(<Notice blocked={false} />);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(invoke).toHaveBeenCalledTimes(2);
});
it("downloads inside the app and waits for explicit installation confirmation", async () => {
  const Notice = await load();
  render(<Notice blocked={false} />);
  await screen.findByText("发现 Miry 新版本");
  fireEvent.click(screen.getByRole("button", { name: "立即更新" }));
  await settle();
  expect(invoke).toHaveBeenLastCalledWith(
    "download_update",
    expect.objectContaining({ version: "1.1.0" }),
  );
  expect(screen.getByRole("heading", { name: "准备安装" })).toBeTruthy();
  expect(invoke).not.toHaveBeenCalledWith("open_release", expect.anything());
  expect(invoke).not.toHaveBeenCalledWith("install_update", expect.anything());
});
it("keeps manual checks available after the automatic attempt", async () => {
  const { automaticUpdate } = await import("../stores/automaticUpdates");
  await automaticUpdate();
  const { default: DesktopSettings } = await import("./DesktopSettings");
  const { defaults } = await import("../stores/settings");
  render(<DesktopSettings settings={defaults} onChange={vi.fn()} api={null} />);
  fireEvent.click(screen.getByRole("button", { name: "检查新版本" }));
  await screen.findByText("发现新版本 v1.1.0");
  expect(invoke).toHaveBeenCalledTimes(2);
});
it("bounds requests and remembers dismissal in memory if storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("unavailable");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("unavailable");
  });
  const store = await import("../stores/automaticUpdates");
  expect((await store.automaticUpdate())?.version).toBe("1.1.0");
  store.dismissUpdate("1.1.0");
  expect(await store.automaticUpdate()).toBeUndefined();
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
});
it("ignores all legacy persisted attempt, dismissal and cached candidate state", async () => {
  const legacy = JSON.stringify({
    lastAttempt: Date.now(),
    dismissedVersion: "1.1.0",
    candidate: { ...release("1.2.0"), forVersion: "1.0.7" },
  });
  localStorage.setItem("miry-release-check", legacy);
  const store = await import("../stores/automaticUpdates");
  expect((await store.automaticUpdate())?.version).toBe("1.1.0");
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
  expect(localStorage.getItem("miry-release-check")).toBe(legacy);
});
it("keeps one attempt when persistence writes fail", async () => {
  localStorage.setItem(
    "miry-release-check",
    JSON.stringify({ lastAttempt: 0 }),
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("full");
  });
  const store = await import("../stores/automaticUpdates");
  await store.automaticUpdate();
  await store.automaticUpdate();
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
});
it("retains the app and offers retry if the native updater rejects metadata", async () => {
  const Notice = await load();
  render(<Notice blocked={false} />);
  await screen.findByText("发现 Miry 新版本");
  vi.mocked(invoke).mockRejectedValueOnce("更新暂不可用：更新包缺失");
  fireEvent.click(screen.getByRole("button", { name: "立即更新" }));
  await settle();
  expect(screen.getByRole("button", { name: "重试" })).toHaveProperty(
    "disabled",
    false,
  );
  expect(screen.getByRole("alert").textContent).toContain("更新暂不可用");
});

it.each([10485760, null])(
  "renders download progress with total %s without inventing a percentage",
  async (total) => {
    const Notice = await load();
    render(<Notice blocked={false} />);
    await screen.findByRole("dialog");
    let finish!: () => void;
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "立即更新" }));
    const channel = (
      vi.mocked(invoke).mock.calls.at(-1)![1] as {
        onProgress: { onmessage: (p: unknown) => void };
      }
    ).onProgress;
    act(() =>
      channel.onmessage({
        phase: "downloading",
        downloaded: 5242880,
        total,
        bytesPerSecond: 1048576,
      }),
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("value")).toBe(total ? "50" : null);
    expect(screen.getByRole("status").textContent).toContain(
      total ? "50%" : "大小未知",
    );
    expect(screen.getByRole("status").textContent).toContain("1.0 MB/s");
    await act(async () => {
      finish();
    });
  },
);
it("keeps installation handoff visible while stopping playback changes the blocked state", async () => {
  const Notice = await load();
  let stopped!: () => void;
  const prepare = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        stopped = resolve;
      }),
  );
  const view = render(<Notice blocked={false} onPrepareInstall={prepare} />);
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "立即更新" }));
  await screen.findByRole("button", { name: "确认安装" });
  fireEvent.click(screen.getByRole("button", { name: "确认安装" }));
  await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
  view.rerender(<Notice blocked onPrepareInstall={prepare} />);
  expect(screen.getByRole("heading", { name: "安装交接中" })).toBeTruthy();
  await act(async () => {
    stopped();
  });
  expect(invoke).toHaveBeenLastCalledWith("install_update", { restart: true });
});
