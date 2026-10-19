import { expect, it } from "vitest";
import { playbackResolution } from "./resolution";
it.each([
  [3840, 2160, "4K"],
  [3840, 1608, "4K"],
  [4096, 2160, "4K"],
  [1920, 1080, "1080p"],
  [1920, 800, "1080p"],
  [1280, 720, "720p"],
  [720, 576, "576p"],
  [720, 480, "480p"],
])("uses actual coded dimensions %s x %s", (w, h, label) =>
  expect(playbackResolution({ w, h })).toBe(label),
);
it("hides missing and invalid data rather than trusting a filename or source label", () => {
  for (const p of [undefined, {}, { w: 0, h: 0 }, { w: NaN, h: 1080 }])
    expect(playbackResolution(p)).toBeNull();
  expect(playbackResolution({ w: 1920, h: 1080, title: "4K REMUX" })).toBe(
    "1080p",
  );
});
