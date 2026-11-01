import type { MediaSource } from "../types/emby";

export type SourcePreference = "resolution" | "bitrate";
export interface PlaybackSelection {
  sourceId: string;
  audioIndex?: number;
  subtitleIndex?: number;
}
const positive = (value?: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

// Stable ties retain server order; incomplete metadata never prevents play.
export function rankSources(
  sources: MediaSource[],
  preference: SourcePreference = "resolution",
): MediaSource[] {
  const scores = (source: MediaSource) => {
    const video = source.MediaStreams?.find((s) => s.Type === "Video");
    const resolution = positive(video?.Height);
    const bitrate = positive(source.Bitrate);
    return preference === "bitrate"
      ? [bitrate, resolution, positive(video?.Width)]
      : [resolution, positive(video?.Width), bitrate];
  };
  return sources
    .map((source, index) => ({ source, index, score: scores(source) }))
    .sort(
      (a, b) =>
        b.score[0] - a.score[0] ||
        b.score[1] - a.score[1] ||
        b.score[2] - a.score[2] ||
        a.index - b.index,
    )
    .map(({ source }) => source);
}
