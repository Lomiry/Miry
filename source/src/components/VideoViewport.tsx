import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useCallback, useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
let viewportSequence = 0;
let surfaceWork = Promise.resolve();
export default function VideoViewport({
  visible,
  controls = false,
  detached = false,
}: {
  visible: boolean;
  controls?: boolean;
  detached?: boolean;
}) {
  useI18n();

  const node = useRef<HTMLDivElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const shown = useRef(visible),
    transferred = useRef(detached),
    overlay = useRef(controls),
    refresh = useRef<() => void>(() => {});
  shown.current = visible;
  transferred.current = detached;
  overlay.current = controls;
  const setNode = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    node.current = element;
    if (element) {
      observer.current?.observe(element);
      refresh.current();
    }
  }, []);
  useEffect(() => refresh.current(), [visible, controls, detached]);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true,
      frame = 0,
      last = "",
      lastOverlay = "",
      originRevision = 0;
    const owner = `viewport-${Date.now()}-${++viewportSequence}`;
    const attached = invoke("player_overlay_attach", { owner });
    let nativeScale = window.devicePixelRatio || 1;
    let removeScale: (() => void) | undefined;
    let removeMove: (() => void) | undefined;
    let removeResize: (() => void) | undefined;
    let removeTray: (() => void) | undefined;
    const update = () => {
      if (!active) return;
      if (!node.current && !transferred.current) return;
      // Mini owns the native geometry. Keep this owner mounted without a main
      // window video element; release only when the playback session ends.
      const bounds = node.current?.getBoundingClientRect();
      // Rust expects window logical units; CSS pixels also include WebView zoom.
      const zoom = (window.devicePixelRatio || nativeScale) / nativeScale;
      const rect = {
        x: Math.round((bounds?.x || 0) * zoom),
        y: Math.round((bounds?.y || 0) * zoom),
        width: Math.round((bounds?.width || 0) * zoom),
        height: Math.round((bounds?.height || 0) * zoom),
        visible:
          !!bounds &&
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
      surfaceWork = surfaceWork
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
      void listen(
        "tray-restored",
        () => {
          if (!active) return;
          // Hidden WebViews may not emit visibilitychange/resize. Force a fresh
          // projection with the existing owner even when the CSS bounds match.
          last = "";
          lastOverlay = "";
          schedule();
        },
        { target: "main" },
      )
        .then((remove) => (active ? (removeTray = remove) : remove()))
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
    observer.current =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    if (node.current) observer.current?.observe(node.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.current?.disconnect();
      observer.current = null;
      removeScale?.();
      removeMove?.();
      removeResize?.();
      removeTray?.();
      refresh.current = () => {};
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("visibilitychange", schedule);
      void attached
        .then(() => invoke("player_overlay_release", { owner }))
        .catch(() => {});
      // Even a mount cleaned up before its first frame must retain work queued
      // by previous owners; their delayed hides must precede the next show.
      surfaceWork = surfaceWork
        .finally(async () => {
          const rect = { x: 0, y: 0, width: 0, height: 0, visible: false };
          await invoke("player_surface", { rect });
        })
        .catch(() => {});
    };
  }, []);
  return detached ? null : (
    <div
      className="video-viewport"
      ref={setNode}
      aria-label={t("library.video_surface")}
    />
  );
}
