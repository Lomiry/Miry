import { expect, it } from "vitest";
import { RouteHealth } from "./routeHealth";
import type { PlayerSnapshot } from "./playback";
it("counts repeated native timeouts even when the same error text remains visible", () => {
  const h = new RouteHealth(),
    s = { active: false, error: "同步超时", syncTimeouts: 1 } as PlayerSnapshot;
  expect(h.update(s, 0)).toBeUndefined();
  expect(h.update(s, 1000)).toBeUndefined();
  expect(h.update({ ...s, syncTimeouts: 2 }, 10000)).toBeUndefined();
  expect(h.update({ ...s, syncTimeouts: 3 }, 20000)).toContain("多次");
});
const playing = {
  loaded: true,
  active: true,
  paused: false,
  error: "",
  syncError: "",
  buffering: true,
} as PlayerSnapshot;
it("ignores an isolated buffer and resets continuous detection on pause", () => {
  const h = new RouteHealth();
  expect(h.update(playing, 0)).toBeUndefined();
  expect(h.update({ ...playing, buffering: false }, 14000)).toBeUndefined();
  expect(h.update(playing, 16000)).toBeUndefined();
  expect(h.update(playing, 31000)).toContain("15 秒");
  expect(h.update({ ...playing, paused: true }, 32000)).toBeUndefined();
  expect(h.update(playing, 33000)).toBeUndefined();
});
it("requires known bitrate and sustained poor input with insufficient cache", () => {
  const h = new RouteHealth(),
    low = {
      ...playing,
      buffering: false,
      inputRateBps: 10000,
      bufferSeconds: 1,
    };
  expect(h.update(low, 0)).toBeUndefined();
  expect(h.update(low, 25000)).toBeUndefined();
  expect(h.update(low, 26000, 8e6)).toBeUndefined();
  expect(h.update(low, 46000, 8e6)).toContain("吞吐");
  expect(h.update({ ...low, bufferSeconds: 10 }, 47000, 8e6)).toBeUndefined();
});
it("counts separate timeout events rather than repeated snapshots and expires them", () => {
  const h = new RouteHealth(),
    error = { ...playing, active: false, error: "request timeout" };
  for (let t = 0; t < 10; t++)
    expect(h.update(error, t * 1000)).toBeUndefined();
  h.update({ ...error, error: "" }, 11000);
  h.update(error, 12000);
  h.update({ ...error, error: "" }, 13000);
  expect(h.update(error, 14000)).toContain("多次");
  expect(h.update({ ...error, error: "" }, 140000)).toBeUndefined();
});
