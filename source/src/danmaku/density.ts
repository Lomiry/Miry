import type { DanmakuDocument } from "./types";
export interface DanmakuDensity {
  duration: number;
  bins: number[];
}
export function density(
  document: DanmakuDocument | null,
  duration: number,
  offset = 0,
  count = 120,
): DanmakuDensity | undefined {
  if (
    !document?.entries.length ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(offset)
  )
    return;
  const bins = Array.from(
    { length: Math.max(1, Math.min(240, Math.floor(count) || 120)) },
    () => 0,
  );
  for (const entry of document.entries) {
    const time = entry.time + offset;
    if (Number.isFinite(time) && time >= 0 && time <= duration)
      bins[
        Math.min(bins.length - 1, Math.floor((time / duration) * bins.length))
      ]++;
  }
  const peak = Math.max(...bins);
  if (!peak) return;
  return { duration, bins: bins.map((n) => n / peak) };
}
