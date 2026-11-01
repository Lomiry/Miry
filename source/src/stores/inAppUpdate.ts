import { t } from "../i18n/core";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { UpdateCandidate } from "./automaticUpdates";

export type UpdatePhase =
  | "available"
  | "downloading"
  | "verifying"
  | "ready"
  | "installing"
  | "cancelling"
  | "cancelled"
  | "error";
interface Progress {
  phase: "downloading" | "verifying";
  downloaded: number;
  total: number | null;
  bytesPerSecond: number;
}
interface UpdateState {
  release?: UpdateCandidate;
  phase: UpdatePhase;
  downloaded: number;
  total: number | null;
  bytesPerSecond: number;
  minimized: boolean;
  error?: string;
}
let state: UpdateState = {
  phase: "available",
  downloaded: 0,
  total: null,
  bytesPerSecond: 0,
  minimized: false,
};
const listeners = new Set<() => void>();
const patch = (next: Partial<UpdateState>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};
export const updateSnapshot = () => state;
export const subscribeUpdate = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function offerUpdate(release: UpdateCandidate) {
  if (
    busy ||
    (state.release &&
      !["available", "error", "cancelled"].includes(state.phase))
  )
    return;
  patch({ release, phase: "available", error: undefined, minimized: false });
}
export const minimizeUpdate = (minimized: boolean) => patch({ minimized });
export const clearUpdate = () => {
  if (!busy) patch({ release: undefined });
};
let busy = false;
let downloadId: string | undefined;
export async function cancelDownload() {
  if (!downloadId || !["downloading", "verifying"].includes(state.phase))
    return;
  const id = downloadId;
  patch({ phase: "cancelling" });
  try {
    await invoke("cancel_update_download", { requestId: id });
  } catch {
    // Keep ownership until the original native request settles; never permit install.
    if (downloadId === id && state.phase === "cancelling")
      patch({ error: t("updates.cancel_failed") });
  }
}
export async function downloadUpdate() {
  if (
    busy ||
    !state.release ||
    !["available", "error", "cancelled"].includes(state.phase)
  )
    return;
  if (state.release.updateReady !== true) {
    patch({ phase: "error", error: t("updates.signing_blocked") });
    return;
  }
  busy = true;
  const id = crypto.randomUUID();
  downloadId = id;
  patch({
    phase: "downloading",
    downloaded: 0,
    total: null,
    bytesPerSecond: 0,
    error: undefined,
  });
  const progress = new Channel<Progress>();
  progress.onmessage = (value) => {
    if (downloadId === id && ["downloading", "verifying"].includes(state.phase))
      patch(value);
  };
  try {
    await invoke("download_update", {
      version: state.release.version,
      requestId: id,
      onProgress: progress,
    });
    patch({
      phase: state.phase === "cancelling" ? "cancelled" : "ready",
      bytesPerSecond: 0,
    });
  } catch (error) {
    if (state.phase === "cancelling")
      patch({ phase: "cancelled", bytesPerSecond: 0 });
    else
      patch({
        phase: "error",
        error: typeof error === "string" ? error : t("updates.download_failed"),
      });
  } finally {
    downloadId = undefined;
    busy = false;
    progress.onmessage = () => {};
  }
}
export async function installUpdate(
  prepare: () => Promise<void>,
  restart: boolean,
) {
  if (busy || state.phase !== "ready" || state.release?.updateReady !== true)
    return;
  busy = true;
  patch({ phase: "installing", error: undefined });
  try {
    await invoke("prepare_update_install");
    await prepare();
    await invoke("install_update", { restart });
  } catch {
    await invoke("cancel_update_install").catch(() => {});
    patch({ phase: "error", error: t("updates.install_failed") });
  } finally {
    busy = false;
  }
}
