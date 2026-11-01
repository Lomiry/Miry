import type { DanmakuDocument } from "./types";
import { limits } from "./parser";
export function sourceVideoDuration(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= limits.time
    ? value
    : undefined;
}
export function mediaTimeline(
  document: DanmakuDocument,
  duration: number,
): DanmakuDocument {
  const source = sourceVideoDuration(document.videoDuration);
  const target = sourceVideoDuration(duration);
  if (!source || !target || source === target) return document;
  // Only explicit video lengths establish this scale. Never infer a duration
  // from the last comment, convert an ambiguous unit, or scale the user offset.
  const ratio = target / source;
  return {
    ...document,
    videoDuration: target,
    entries: document.entries.map((entry) => ({
      ...entry,
      time: entry.time * ratio,
    })),
  };
}
