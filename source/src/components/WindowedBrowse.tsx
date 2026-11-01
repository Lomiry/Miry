import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Item } from "../types/emby";

export function browseWindow(
  length: number,
  columns: number,
  row: number,
  top: number,
  height: number,
) {
  const rows = Math.ceil(length / columns);
  const first = Math.min(
    Math.max(0, Math.floor(top / row) - 3),
    Math.max(0, rows - 1),
  );
  const last = Math.min(
    rows,
    Math.max(first + 1, Math.ceil((top + height) / row) + 3),
  );
  return {
    start: first * columns,
    end: Math.min(length, last * columns),
    before: first * row,
    after: (rows - last) * row,
  };
}
// Measure the existing grid/card geometry so tokens, density and list layout stay
// authoritative. Only the visible rows and three rows of overscan are mounted.
export default function WindowedBrowse({
  items,
  root,
  layout,
  render,
}: {
  items: Item[];
  root: HTMLElement | null;
  layout: boolean;
  render: (items: Item[]) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({
    columns: 1,
    row: 360,
    top: 0,
    height: 900,
  });
  const range = browseWindow(
    items.length,
    metrics.columns,
    metrics.row,
    metrics.top,
    metrics.height,
  );
  useLayoutEffect(() => {
    const element = host.current;
    if (!element || !root) return;
    let frame = 0;
    let geometry = "";
    const measure = () => {
      const grid = element.querySelector<HTMLElement>(".grid");
      const card = grid?.firstElementChild as HTMLElement | null;
      if (!grid || !card) return;
      const style = getComputedStyle(grid);
      const columns = Math.max(
        1,
        style.gridTemplateColumns.split(" ").filter(Boolean).length,
      );
      const gap = parseFloat(style.rowGap) || 0;
      // A new visible card is not a new layout. Recalibrating its height on
      // every window change can alternate row size/start in a layout-effect loop.
      const signature = JSON.stringify([
        root.clientWidth,
        style.gridTemplateColumns,
        style.rowGap,
        style.fontSize,
        layout,
      ]);
      const row =
        (card.offsetHeight || card.getBoundingClientRect().height) + gap;
      if (!Number.isFinite(row) || row <= 0) return;
      const recalibrate = signature !== geometry;
      geometry = signature;
      const next = {
        columns,
        row,
        height: root.clientHeight,
        top: Math.max(
          0,
          root.getBoundingClientRect().top +
            root.clientTop -
            element.getBoundingClientRect().top,
        ),
      };
      setMetrics((old) => {
        const measured = recalibrate
          ? next
          : { ...next, columns: old.columns, row: old.row };
        return Object.keys(measured).some(
          (key) =>
            old[key as keyof typeof old] !==
            measured[key as keyof typeof measured],
        )
          ? measured
          : old;
      });
    };
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    measure();
    root.addEventListener("scroll", schedule, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(root);
    observer?.observe(element);
    const card = element.querySelector(".grid > *");
    if (card) observer?.observe(card);
    return () => {
      root.removeEventListener("scroll", schedule);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [root, layout]);
  return (
    <div ref={host}>
      <div aria-hidden="true" style={{ height: range.before }} />
      {render(items.slice(range.start, range.end))}
      <div aria-hidden="true" style={{ height: range.after }} />
    </div>
  );
}
