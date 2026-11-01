import { expect, it } from "vitest";
import { density } from "./density";
import type { DanmakuDocument } from "./types";
const doc = (times: number[]): DanmakuDocument => ({
  format: "Online",
  skipped: 0,
  entries: times.map((time) => ({
    time,
    text: "x",
    mode: "scroll",
    color: "#ffffff",
    duration: 8,
  })),
});
it("buckets timestamps including the duration boundary and ignores invalid timestamps", () => {
  expect(density(doc([0, 1, 4, 4, 10, -1, 11, NaN]), 10, 0, 5)).toEqual({
    duration: 10,
    bins: [1, 0, 1, 0, 0.5],
  });
});
it.each([0, -1, NaN, Infinity])(
  "omits live or unknown duration %s",
  (duration) => expect(density(doc([1]), duration)).toBeUndefined(),
);
it("clears empty documents, media switches and offsets beyond duration", () => {
  expect(density(null, 20)).toBeUndefined();
  expect(density(doc([]), 20)).toBeUndefined();
  expect(density(doc([1]), 20, 30)).toBeUndefined();
  expect(density(doc([1]), 20, 5, 4)?.bins).toEqual([0, 1, 0, 0]);
  expect(density(doc([1]), 4, 0, 4)?.bins).toEqual([0, 1, 0, 0]);
});
it("bounds the presentation size", () =>
  expect(density(doc([1]), 100, 0, 100000)?.bins).toHaveLength(240));
