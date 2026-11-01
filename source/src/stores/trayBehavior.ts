import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "./settings";
import { t } from "../i18n/core";

let pending: Promise<unknown> = Promise.resolve();

// Native window callbacks read one atomic pair of preferences. Preserve order
// when a user changes both controls while an earlier IPC call is still pending.
export function syncTrayBehavior(
  settings: Pick<Settings, "closeToTray" | "minimizeToTray">,
) {
  const input = {
    closeToTray: settings.closeToTray === true,
    minimizeToTray: settings.minimizeToTray === true,
  };
  const labels = {
    show: t("tray.show"),
    hide: t("tray.hide"),
    exit: t("tray.exit"),
  };
  const result = pending
    .catch(() => {})
    .then(() => invoke<boolean>("set_tray_behavior", { input, labels }));
  pending = result;
  return result;
}
