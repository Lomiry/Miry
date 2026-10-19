import { expect, it } from "vitest";
import { clockAnchor } from "./useDanmakuClock";
import type { DanmakuClock } from "./types";
const previous: DanmakuClock = {
  position: 5,
  sampledAt: 1000,
  session: "s:1",
  paused: false,
  speed: 1,
  active: true,
  loaded: true,
  buffering: false,
};
it("preserves the real time-pos anchor across repeated low-frame-rate samples", () => {
  expect(
    clockAnchor(previous, { ...previous, sampledAt: 1200 }).sampledAt,
  ).toBe(1000);
  expect(
    clockAnchor(previous, { ...previous, sampledAt: 1500, position: 6 })
      .sampledAt,
  ).toBe(1500);
});
it.each([
  { paused: true },
  { speed: 2 },
  { buffering: true },
  { session: "s:2" },
  { active: false },
])(
  "rebases on pause, speed, buffering, seek and media changes: %s",
  (patch) => {
    expect(
      clockAnchor(previous, { ...previous, ...patch, sampledAt: 1200 })
        .sampledAt,
    ).toBe(1200);
  },
);
