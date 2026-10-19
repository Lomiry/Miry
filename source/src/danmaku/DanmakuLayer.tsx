import { useEffect, useMemo, useRef } from "react";
import { DanmakuScheduler, playbackTime } from "./scheduler";
import { filterDanmaku } from "./parser";
import type { DanmakuClock, DanmakuDocument, DanmakuSettings } from "./types";
export default function DanmakuLayer({
  document: doc,
  settings: incoming,
  clock,
}: {
  document: DanmakuDocument | null;
  settings: DanmakuSettings;
  clock: DanmakuClock | null;
}) {
  const signature = JSON.stringify(incoming);
  const settings = useMemo(
    () => JSON.parse(signature) as DanmakuSettings,
    [signature],
  );
  const canvas = useRef<HTMLCanvasElement>(null),
    anchor = useRef(clock),
    engine = useRef<DanmakuScheduler | null>(null),
    frame = useRef(0),
    session = useRef(""),
    lastStats = useRef(0);
  anchor.current = clock;
  useEffect(() => {
    const node = canvas.current;
    if (!node || !doc || !settings.enabled) return;
    const context = node.getContext("2d");
    if (!context) return;
    let width = 0,
      height = 0,
      lastTime = NaN,
      lastPaused: boolean | undefined;
    const entries = filterDanmaku(doc.entries, settings);
    const resize = () => {
      const rect = node.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.max(1, Math.round(width * ratio));
      node.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = `600 ${settings.fontSize}px "Microsoft YaHei UI","Segoe UI",sans-serif`;
      engine.current = new DanmakuScheduler(
        entries,
        settings,
        width,
        height,
        (text) => context.measureText(text).width,
      );
      lastTime = NaN;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    let active = true;
    const draw = () => {
      const current = anchor.current;
      if (!active) return;
      if (current && engine.current && width && height) {
        const time = playbackTime(current);
        const changed = current.session !== session.current;
        const pausedChanged = current.paused !== lastPaused;
        lastPaused = current.paused;
        session.current = current.session;
        if (time !== lastTime || changed || pausedChanged || !current.active) {
          context.clearRect(0, 0, width, height);
          const rows =
            current.active && current.loaded
              ? engine.current.step(time, changed)
              : [];
          context.globalAlpha = settings.opacity;
          context.lineWidth = 2.5;
          context.strokeStyle = "#000";
          context.textBaseline = "top";
          for (const row of rows) {
            context.fillStyle = row.entry.color;
            context.strokeText(row.entry.text, row.x, row.y);
            context.fillText(row.entry.text, row.x, row.y);
          }
          lastTime = time;
          if (
            current.paused ||
            changed ||
            Date.now() - lastStats.current > 250
          ) {
            node.dataset.activeCount = String(rows.length);
            node.dataset.playbackTime = time.toFixed(3);
            node.dataset.processed = String(engine.current.processed);
            node.dataset.dropped = String(engine.current.dropped);
            lastStats.current = Date.now();
          }
        }
      }
      frame.current = requestAnimationFrame(draw);
    };
    frame.current = requestAnimationFrame(draw);
    return () => {
      active = false;
      cancelAnimationFrame(frame.current);
      observer.disconnect();
      context.clearRect(0, 0, width, height);
      engine.current = null;
    };
  }, [doc, settings]);
  return doc && settings.enabled ? (
    <canvas ref={canvas} className="danmaku-layer" aria-hidden="true" />
  ) : null;
}
