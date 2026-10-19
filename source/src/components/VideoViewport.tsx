import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
let viewportSequence = 0;
let surfaceWork = Promise.resolve();
export default function VideoViewport({
  visible,
  controls = false,
}: {
  visible: boolean;
  controls?: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const shown = useRef(visible),
    overlay = useRef(controls),
    refresh = useRef<() => void>(() => {});
  shown.current = visible;
  overlay.current = controls;
  useEffect(() => refresh.current(), [visible, controls]);
  useEffect(() => {
    if (!isTauri() || !node.current) return;
    let active = true,
      frame = 0,
      last = "",
      lastOverlay = "",
      originRevision = 0,
      work = Promise.resolve();
    const owner = `viewport-${Date.now()}-${++viewportSequence}`;
    const attached = invoke("player_overlay_attach", { owner });
    let nativeScale = window.devicePixelRatio || 1;
    let removeScale: (() => void) | undefined;
    let removeMove: (() => void) | undefined;
    let removeResize: (() => void) | undefined;
    const update = () => {
      if (!active) return;
      const bounds = node.current!.getBoundingClientRect();
      // Rust expects window logical units; CSS pixels also include WebView zoom.
      const zoom = (window.devicePixelRatio || nativeScale) / nativeScale;
      const rect = {
        x: Math.round(bounds.x * zoom),
        y: Math.round(bounds.y * zoom),
        width: Math.round(bounds.width * zoom),
        height: Math.round(bounds.height * zoom),
        visible:
          shown.current &&
          !document.hidden &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.y >= 0 &&
          bounds.bottom <= window.innerHeight + 1,
      };
      const signature = JSON.stringify(rect);
      const overlayRect = { ...rect, visible: rect.visible && overlay.current };
      const overlaySignature = JSON.stringify(overlayRect) + originRevision;
      const videoChanged = signature !== last,
        overlayChanged = overlaySignature !== lastOverlay;
      if (!videoChanged && !overlayChanged) return;
      last = signature;
      lastOverlay = overlaySignature;
      surfaceWork = work = surfaceWork
        .then(async () => {
          await attached;
          if (!active) return;
          if (videoChanged) await invoke("player_surface", { rect });
          if (active && overlayChanged)
            await invoke("player_overlay", { rect: overlayRect, owner });
        })
        .catch(() => {});
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    refresh.current = schedule;
    try {
      const appWindow = getCurrentWindow();
      void appWindow
        .onResized?.(() => {
          if (active) {
            originRevision++;
            schedule();
          }
        })
        .then((remove) => (active ? (removeResize = remove) : remove()))
        .catch(() => {});
      void appWindow
        .onMoved?.(() => {
          if (active) {
            originRevision++;
            schedule();
          }
        })
        .then((remove) => (active ? (removeMove = remove) : remove()))
        .catch(() => {});
      void appWindow
        .scaleFactor()
        .then((scale) => {
          if (active && Number.isFinite(scale) && scale > 0) {
            nativeScale = scale;
            schedule();
          }
        })
        .catch(() => {});
      void appWindow
        .onScaleChanged(({ payload }) => {
          if (
            active &&
            Number.isFinite(payload.scaleFactor) &&
            payload.scaleFactor > 0
          ) {
            nativeScale = payload.scaleFactor;
            schedule();
          }
        })
        .then((remove) => (active ? (removeScale = remove) : remove()))
        .catch(() => {});
    } catch {
      /* An unavailable window API retains the existing logical bounds. */
    }
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(node.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      removeScale?.();
      removeMove?.();
      removeResize?.();
      refresh.current = () => {};
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("visibilitychange", schedule);
      void attached
        .then(() => invoke("player_overlay_release", { owner }))
        .catch(() => {});
      surfaceWork = work
        .finally(async () => {
          const rect = { x: 0, y: 0, width: 0, height: 0, visible: false };
          await invoke("player_surface", { rect });
        })
        .catch(() => {});
    };
  }, []);
  return <div className="video-viewport" ref={node} aria-label="视频画面" />;
}
