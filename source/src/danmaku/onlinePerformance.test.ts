import { expect, it } from "vitest";
import { parseComments } from "./onlineParser";
import { DanmakuScheduler, playbackTime } from "./scheduler";
import { danmakuDefaults } from "./types";
it("bounds small/medium/large parsing and scheduler work; measures a short regression", () => {
  const results = [];
  const heap = () =>
    (
      globalThis as { process?: { memoryUsage: () => { heapUsed: number } } }
    ).process?.memoryUsage().heapUsed || 0;
  for (const count of [100, 10000, 100003]) {
    const input = {
        comments: Array.from({ length: count }, (_, i) => ({
          p: `${i / 100},1,16777215`,
          m: `sample ${i} 中文😀`,
        })),
      },
      heapBefore = heap(),
      start = performance.now(),
      document = parseComments(input),
      parseMs = performance.now() - start;
    const scheduler = new DanmakuScheduler(
        document.entries,
        danmakuDefaults,
        1280,
        720,
        () => 120,
      ),
      time = performance.now();
    let active = 0;
    for (let frame = 0; frame < 600; frame++)
      active = Math.max(active, scheduler.step(frame / 60).length);
    const schedulerMs = performance.now() - time;
    expect(active).toBeLessThanOrEqual(48);
    expect(document.entries.length).toBeLessThanOrEqual(100000);
    expect(parseMs).toBeLessThan(10000);
    expect(schedulerMs).toBeLessThan(10000);
    results.push({
      input: count,
      accepted: document.entries.length,
      skipped: document.skipped,
      parseMs,
      scheduler600FramesMs: schedulerMs,
      maxActive: active,
      heapDeltaBytes: heap() - heapBefore,
    });
  }
  console.log("DANMAKU_PERFORMANCE", JSON.stringify(results));
  const clock = {
    position: 10,
    sampledAt: 1000,
    paused: false,
    speed: 2,
    active: true,
    loaded: true,
    buffering: false,
    session: "online",
  };
  expect(playbackTime(clock, 1250)).toBe(10.5);
  expect(playbackTime({ ...clock, paused: true }, 5000)).toBe(10);
  expect(playbackTime({ ...clock, position: 2 }, 1000)).toBe(2);
});
