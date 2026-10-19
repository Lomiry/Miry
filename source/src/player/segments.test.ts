import { it, expect } from "vitest";
import { activeSegment, skipSegments } from "./segments";
it("uses real Emby markers including a zero intro start before fixed seconds", () => {
  const segments = skipSegments(
    {
      Id: "m",
      Name: "m",
      Type: "Episode",
      Chapters: [
        { StartPositionTicks: 0, MarkerType: "IntroStart" },
        { StartPositionTicks: 30e7, MarkerType: "IntroEnd" },
        { StartPositionTicks: 90e7, MarkerType: "CreditsStart" },
      ],
    },
    100,
    10,
    5,
  );
  expect(segments).toEqual([
    { kind: "intro", start: 0, end: 30, source: "server" },
    { kind: "outro", start: 90, end: 100, source: "server" },
  ]);
  expect(activeSegment(segments, 30)).toBeUndefined();
  expect(activeSegment(segments, 99)?.kind).toBe("outro");
});
it("falls back to chapter names and rejects invalid server ranges", () => {
  const segments = skipSegments(
    {
      Id: "m",
      Name: "m",
      Type: "Episode",
      IntroStartPositionTicks: 40e7,
      IntroEndPositionTicks: 30e7,
      Chapters: [
        { Name: "Opening", StartPositionTicks: 10e7 },
        { Name: "Main", StartPositionTicks: 20e7 },
      ],
    },
    100,
    5,
    0,
  );
  expect(segments).toEqual([
    { kind: "intro", start: 10, end: 20, source: "chapter" },
  ]);
});
it("fixed fallback is bounded and disabled by zero; unknown duration yields nothing", () => {
  expect(skipSegments(undefined, 20, 90, 60)).toEqual([
    { kind: "intro", start: 0, end: 10, source: "fixed" },
    { kind: "outro", start: 10, end: 20, source: "fixed" },
  ]);
  expect(skipSegments(undefined, 100, 0, 0)).toEqual([]);
  expect(skipSegments(undefined, 0, 90, 60)).toEqual([]);
});
