import type { Item } from "../types/emby";
export interface SkipSegment {
  kind: "intro" | "outro";
  start: number;
  end: number;
  source: "server" | "chapter" | "fixed";
}
export function skipSegments(
  item: Item | undefined,
  duration: number,
  introSeconds: number,
  outroSeconds: number,
): SkipSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const chapters = (item?.Chapters || [])
    .filter(
      (c) => Number.isFinite(c.StartPositionTicks) && c.StartPositionTicks >= 0,
    )
    .sort((a, b) => a.StartPositionTicks - b.StartPositionTicks);
  const marker = (name: string) =>
    chapters.find((c) => c.MarkerType === name)?.StartPositionTicks;
  const pair = (
    kind: "intro" | "outro",
    start: number | undefined,
    end: number | undefined,
    source: SkipSegment["source"],
  ): SkipSegment | undefined =>
    start !== undefined &&
    end !== undefined &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start &&
    end <= duration
      ? { kind, start, end, source }
      : undefined;
  const introStart = item?.IntroStartPositionTicks ?? marker("IntroStart"),
    introEnd = item?.IntroEndPositionTicks ?? marker("IntroEnd");
  const outroStart = item?.CreditsPositionTicks ?? marker("CreditsStart");
  const introChapter = chapters.findIndex((c) =>
    /^(intro|opening|片头|op)(?:\b|\s|$)/i.test(c.Name || ""),
  );
  const outroChapter = chapters.find((c) =>
    /^(outro|credits|ending|片尾|ed)(?:\b|\s|$)/i.test(c.Name || ""),
  );
  const intro =
    pair(
      "intro",
      introStart === undefined ? undefined : introStart / 1e7,
      introEnd === undefined ? undefined : introEnd / 1e7,
      "server",
    ) ||
    (introChapter >= 0
      ? pair(
          "intro",
          chapters[introChapter].StartPositionTicks / 1e7,
          chapters[introChapter + 1]?.StartPositionTicks / 1e7,
          "chapter",
        )
      : undefined) ||
    pair(
      "intro",
      0,
      Math.min(duration / 2, Math.max(0, introSeconds)),
      "fixed",
    );
  const outro =
    pair(
      "outro",
      outroStart === undefined ? undefined : outroStart / 1e7,
      duration,
      "server",
    ) ||
    pair(
      "outro",
      outroChapter?.StartPositionTicks === undefined
        ? undefined
        : outroChapter.StartPositionTicks / 1e7,
      duration,
      "chapter",
    ) ||
    pair(
      "outro",
      Math.max(duration / 2, duration - Math.max(0, outroSeconds)),
      duration,
      "fixed",
    );
  return [intro, outro].filter((s): s is SkipSegment => !!s);
}
export function activeSegment(segments: SkipSegment[], position: number) {
  return segments.find((s) => position >= s.start && position < s.end);
}
