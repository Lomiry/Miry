import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DanmakuClock } from "./types";
export function clockAnchor(
  previous: DanmakuClock | null,
  next: DanmakuClock,
): DanmakuClock {
  // Low frame rate video can repeat time-pos across several native samples.
  // Keep its anchor rather than restarting extrapolation every 200 ms.
  return previous &&
    Math.abs(previous.position - next.position) < 0.0001 &&
    previous.session === next.session &&
    previous.paused === next.paused &&
    previous.speed === next.speed &&
    previous.active === next.active &&
    previous.loaded === next.loaded &&
    previous.buffering === next.buffering
    ? { ...next, sampledAt: previous.sampledAt }
    : next;
}
export default function useDanmakuClock(enabled: boolean, revision: number) {
  const [clock, setClock] = useState<DanmakuClock | null>(null);
  useEffect(() => {
    setClock(null);
    if (!enabled || !isTauri()) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await invoke<DanmakuClock>("player_clock");
        if (active) setClock((previous) => clockAnchor(previous, next));
      } catch {
        /* A lost sample freezes extrapolation; playback error handling stays with the owner. */
      } finally {
        if (active) timer = setTimeout(poll, 200);
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, revision]);
  return clock;
}
