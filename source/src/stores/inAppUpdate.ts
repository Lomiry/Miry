import { Channel, invoke } from "@tauri-apps/api/core";
import type { UpdateCandidate } from "./automaticUpdates";

export type UpdatePhase =
  | "available"
  | "downloading"
  | "verifying"
  | "ready"
  | "installing"
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
  if (state.release && state.phase !== "available" && state.phase !== "error")
    return;
  patch({ release, phase: "available", error: undefined, minimized: false });
}
export const minimizeUpdate = (minimized: boolean) => patch({ minimized });
export const clearUpdate = () => patch({ release: undefined });
let busy = false;
export async function downloadUpdate() {
  if (busy || !state.release) return;
  busy = true;
  patch({
    phase: "downloading",
    downloaded: 0,
    total: null,
    bytesPerSecond: 0,
    error: undefined,
  });
  const progress = new Channel<Progress>();
  progress.onmessage = (value) => {
    if (busy && state.phase !== "installing") patch(value);
  };
  try {
    await invoke("download_update", {
      version: state.release.version,
      onProgress: progress,
    });
    patch({ phase: "ready", bytesPerSecond: 0 });
  } catch (error) {
    patch({
      phase: "error",
      error: typeof error === "string" ? error : "下载失败，重试",
    });
  } finally {
    busy = false;
    progress.onmessage = () => {};
  }
}
export async function installUpdate(
  prepare: () => Promise<void>,
  restart: boolean,
) {
  if (busy || state.phase !== "ready") return;
  busy = true;
  patch({ phase: "installing", error: undefined });
  try {
    await invoke("prepare_update_install");
    await prepare();
    await invoke("install_update", { restart });
  } catch {
    await invoke("cancel_update_install").catch(() => {});
    patch({ phase: "error", error: "安装准备或交接失败，请重新下载后重试。" });
  } finally {
    busy = false;
  }
}
