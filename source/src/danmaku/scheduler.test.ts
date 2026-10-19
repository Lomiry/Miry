import { expect, it } from "vitest";
import { DanmakuScheduler, lowerBound, playbackTime } from "./scheduler";
import { danmakuDefaults, type DanmakuClock, type DanmakuEntry } from "./types";
const entry = (
  time: number,
  text = "same",
  mode: DanmakuEntry["mode"] = "scroll",
): DanmakuEntry => ({ time, text, mode, color: "#ffffff", duration: 8 });
const clock: DanmakuClock = {
  position: 10,
  sampledAt: 1000,
  paused: false,
  speed: 1,
  active: true,
  loaded: true,
  buffering: false,
  session: "s",
};
it.each([0.5, 0.75, 1, 1.5, 2])(
  "preserves old physical velocity/lifetime at migrated speed %s",
  (oldSpeed) => {
    const engine = new DanmakuScheduler(
      [entry(0)],
      { ...danmakuDefaults, speed: oldSpeed * 2 },
      800,
      400,
      () => 100,
    );
    const active = engine.step(2)[0],
      oldDuration = 8 / oldSpeed;
    expect(active.end - active.start).toBe(oldDuration);
    expect(active.velocity).toBe(900 / oldDuration);
    expect(active.x).toBe(800 - 2 * (900 / oldDuration));
  },
);
it("new default 1 travels for 16 seconds and survives seeking into its extended lifetime", () => {
  const engine = new DanmakuScheduler(
    [entry(0)],
    danmakuDefaults,
    800,
    400,
    () => 100,
  );
  expect(engine.step(0)[0].velocity).toBe(56.25);
  expect(engine.step(15, true)[0].end).toBe(16);
  expect(engine.step(16)).toEqual([]);
});
it("uses native anchors, pauses/cache freezes and clamps a lost clock sample", () => {
  expect(playbackTime(clock, 1500)).toBe(10.5);
  expect(playbackTime({ ...clock, speed: 2 }, 1500)).toBe(11);
  expect(playbackTime({ ...clock, paused: true }, 1500)).toBe(10);
  expect(playbackTime({ ...clock, buffering: true }, 1500)).toBe(10);
  expect(playbackTime(clock, 10000)).toBe(11);
  expect(playbackTime({ ...clock, speed: 2 }, 10000)).toBe(11);
  expect(playbackTime({ ...clock, speed: 3 }, 10000)).toBe(11);
});
it("pauses positions, resumes from media time and scales with playback speed", () => {
  const engine = new DanmakuScheduler(
    [entry(0)],
    danmakuDefaults,
    800,
    400,
    () => 100,
  );
  const x = engine.step(1)[0].x;
  expect(engine.step(1)[0].x).toBe(x);
  expect(engine.step(2)[0].x).toBeLessThan(x);
});
it("reconstructs forward/backward seeks and explicit small seeks", () => {
  const engine = new DanmakuScheduler(
    [entry(0), entry(50, "later")],
    danmakuDefaults,
    800,
    400,
    () => 100,
  );
  expect(engine.step(1)[0].entry.time).toBe(0);
  expect(engine.step(51)[0].entry.time).toBe(50);
  expect(engine.step(1)[0].entry.time).toBe(0);
  expect(engine.step(1.2, true)).toHaveLength(1);
});
it("positive offset delays and negative offset advances without changing media time", () => {
  const make = (offset: number) =>
    new DanmakuScheduler(
      [entry(5)],
      { ...danmakuDefaults, offset },
      800,
      400,
      () => 100,
    );
  expect(make(2).step(6)).toHaveLength(0);
  expect(make(2).step(7)).toHaveLength(1);
  expect(make(-2).step(3)).toHaveLength(1);
});
it("prevents simultaneous fixed modes and rolling collisions in one lane", () => {
  const engine = new DanmakuScheduler(
    [
      entry(0, "first"),
      entry(0.1, "second"),
      entry(0.2, "top", "top"),
      entry(0.3, "bottom", "bottom"),
    ],
    danmakuDefaults,
    800,
    55,
    () => 100,
  );
  expect(engine.step(0.4)).toHaveLength(1);
  expect(engine.dropped).toBe(3);
});
it("rejects a longer, faster scroll that would catch its predecessor", () => {
  const engine = new DanmakuScheduler(
    [entry(0, "short"), entry(1, "long")],
    danmakuDefaults,
    800,
    55,
    (s) => (s === "short" ? 50 : 1000),
  );
  expect(engine.step(1.1)).toHaveLength(1);
});
it("enforces density and safe area while leaving subtitles below the default area", () => {
  const entries = Array.from({ length: 100 }, (_, i) => entry(0, String(i)));
  const engine = new DanmakuScheduler(
    entries,
    { ...danmakuDefaults, density: 24 },
    800,
    1080,
    () => 100,
  );
  expect(engine.step(1).length).toBeLessThanOrEqual(24);
  expect(
    engine.active.every((e) => e.y + danmakuDefaults.fontSize < 1080 * 0.75),
  ).toBe(true);
});
it("binary seeks within 100000 records and processes at most 500 due records per frame", () => {
  const entries = Array.from({ length: 100000 }, (_, i) =>
    entry(i / 10, String(i)),
  );
  expect(lowerBound(entries, 9000)).toBe(90000);
  const engine = new DanmakuScheduler(
    entries,
    danmakuDefaults,
    800,
    400,
    () => 100,
  );
  engine.step(9000);
  // New default extends the maximum lifetime from 12 to 24 seconds:
  // at ten entries/second a seek should scan only this local window.
  expect(engine.processed).toBeLessThan(250);
  const flood = new DanmakuScheduler(
    entries.map((e) => ({ ...e, time: 0 })),
    danmakuDefaults,
    800,
    400,
    () => 100,
  );
  flood.step(0);
  expect(flood.processed).toBe(500);
  expect(flood.index).toBe(100000);
});
