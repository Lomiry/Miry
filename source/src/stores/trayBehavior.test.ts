import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { syncTrayBehavior } from "./trayBehavior";
import { setLanguage, t } from "../i18n/core";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

it("serializes rapid policy changes and recovers after a rejected IPC request", async () => {
  let finish!: (value: boolean) => void;
  vi.mocked(invoke)
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }) as never,
    )
    .mockRejectedValueOnce(new Error("window unavailable"))
    .mockResolvedValueOnce(true);
  const first = syncTrayBehavior({ closeToTray: true, minimizeToTray: false });
  const second = syncTrayBehavior({ closeToTray: false, minimizeToTray: true });
  const failure = expect(second).rejects.toThrow("window unavailable");
  const third = syncTrayBehavior({ closeToTray: true, minimizeToTray: true });
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  finish(true);
  await first;
  await failure;
  expect(await third).toBe(true);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.map(([, args]) => (args as { input: unknown }).input),
  ).toEqual([
    { closeToTray: true, minimizeToTray: false },
    { closeToTray: false, minimizeToTray: true },
    { closeToTray: true, minimizeToTray: true },
  ]);
});

it("projects the single language catalog to native menus without changing window preferences", async () => {
  vi.mocked(invoke).mockClear().mockResolvedValue(true);
  setLanguage("en-US", false);
  await syncTrayBehavior({ closeToTray: true, minimizeToTray: false });
  expect(invoke).toHaveBeenLastCalledWith("set_tray_behavior", {
    input: { closeToTray: true, minimizeToTray: false },
    labels: { show: "Show Miry", hide: "Hide Miry", exit: "Exit Miry" },
  });
  setLanguage("zh-CN", false);
  await syncTrayBehavior({ closeToTray: true, minimizeToTray: false });
  expect(invoke).toHaveBeenLastCalledWith("set_tray_behavior", {
    input: { closeToTray: true, minimizeToTray: false },
    labels: {
      show: t("tray.show"),
      hide: t("tray.hide"),
      exit: t("tray.exit"),
    },
  });
});
