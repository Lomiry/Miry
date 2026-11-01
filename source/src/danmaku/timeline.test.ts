import { expect, it } from "vitest";
import { LogvarProvider } from "./logvar";
import { DanmakuScheduler, playbackTime } from "./scheduler";
import { danmakuDefaults, type DanmakuClock } from "./types";
import { mediaTimeline } from "./timeline";
const source = {
  id: "test",
  name: "Test",
  protocol: "logvar" as const,
  endpoint: "https://example.test",
  enabled: true,
  priority: 0,
};
it("maps an explicit LogVar source duration to media seconds, applies offset once, and preserves raw cached data", async () => {
  const provider = new LogvarProvider(source, async () => ({
    videoDuration: 120,
    comments: [{ p: "60,1,16777215", m: "middle" }],
  }));
  const raw = await provider.getComments("1", new AbortController().signal);
  const mapped = mediaTimeline(raw, 100);
  expect(mapped.entries[0].time).toBe(50);
  expect(raw.entries[0].time).toBe(60);
  const scheduler = new DanmakuScheduler(
    mapped.entries,
    { ...danmakuDefaults, offset: 2 },
    800,
    450,
    () => 80,
  );
  expect(scheduler.step(51.9)).toHaveLength(0);
  expect(scheduler.step(52)).toHaveLength(1);
  expect(scheduler.step(10, true)).toHaveLength(0);
  expect(scheduler.step(52, true)).toHaveLength(1);
  expect(mediaTimeline(mapped, 100).entries[0].time).toBe(50);
});
it("does not stretch a sparse comment tail, DandanPlay data, or unknown duration units", () => {
  const raw = {
    format: "Online" as const,
    entries: [
      {
        time: 10,
        text: "text",
        mode: "scroll" as const,
        color: "#fff",
        duration: 8,
      },
    ],
    skipped: 0,
  };
  expect(mediaTimeline(raw, 200)).toBe(raw);
  expect(mediaTimeline({ ...raw, videoDuration: 0 }, 200).entries[0].time).toBe(
    10,
  );
  expect(
    mediaTimeline({ ...raw, videoDuration: NaN }, 200).entries[0].time,
  ).toBe(10);
  expect(mediaTimeline({ ...raw, videoDuration: 120 }, 0).entries[0].time).toBe(
    10,
  );
});
it("advances mapped comments in media time through pause, 2x resume, seek and presentation re-entry", () => {
  const mapped = mediaTimeline(
    {
      format: "Online",
      skipped: 0,
      videoDuration: 120,
      entries: [
        {
          time: 60,
          text: "middle",
          mode: "scroll",
          color: "#fff",
          duration: 8,
        },
      ],
    },
    100,
  );
  const scheduler = new DanmakuScheduler(
    mapped.entries,
    danmakuDefaults,
    800,
    450,
    () => 80,
  );
  const clock: DanmakuClock = {
    position: 49.5,
    sampledAt: 1000,
    active: true,
    loaded: true,
    buffering: false,
    paused: false,
    speed: 2,
    session: "s:1",
  };
  expect(scheduler.step(playbackTime(clock, 1000))).toHaveLength(0);
  expect(scheduler.step(playbackTime(clock, 1250))).toHaveLength(1);
  const paused = { ...clock, position: 50, sampledAt: 1250, paused: true };
  const x = scheduler.step(playbackTime(paused, 4000))[0].x;
  expect(scheduler.step(playbackTime(paused, 8000))[0].x).toBe(x);
  expect(scheduler.step(10, true)).toHaveLength(0);
  expect(scheduler.step(50, true)).toHaveLength(1);
  const returning = new DanmakuScheduler(
    mapped.entries,
    danmakuDefaults,
    800,
    450,
    () => 80,
  );
  expect(returning.step(50, true)[0].entry.time).toBe(50);
});
