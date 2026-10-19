import { expect, it } from "vitest";
import { identifyQuality, normalizeQuality } from "./quality";
import type { MediaStream } from "../types/emby";
const source = (patch: Partial<MediaStream>) => ({
  Id: "s",
  Name: "Dolby.Vision.HDR10+.mkv",
  MediaStreams: [{ Type: "Video", Index: 0, ...patch }],
});
it("does not classify HDR from a filename or bit depth alone", () => {
  expect(identifyQuality(source({ BitDepth: 10 }))).toMatchObject({
    hdr: "Unknown",
    bitDepth: 10,
  });
  expect(identifyQuality()).toMatchObject({
    hdr: "Unknown",
    primaries: "Unknown",
    bitDepth: null,
  });
});
it.each([
  ["SDR", "SDR"],
  ["HDR10", "HDR10"],
  ["HDR10+", "HDR10+"],
  ["Dolby Vision", "Dolby Vision"],
])("recognizes explicit %s metadata", (VideoRange, hdr) => {
  expect(
    identifyQuality(
      source({ VideoRange, BitDepth: 10, ColorPrimaries: "bt2020" }),
    ),
  ).toMatchObject({ hdr, primaries: "BT.2020", bitDepth: 10 });
});
it("prefers tagged runtime color information and retains DV profile evidence", () => {
  expect(
    identifyQuality(source({ VideoRange: "HDR10" }), {
      gamma: "bt.1886",
      primaries: "bt.709",
      pixelformat: "yuv420p10le",
    }),
  ).toMatchObject({
    hdr: "SDR",
    bitDepth: 10,
    primaries: "BT.709",
    evidence: "stream",
  });
  expect(
    identifyQuality(source({ DvProfile: 8, ColorTransfer: "smpte2084" })),
  ).toMatchObject({ hdr: "Dolby Vision", dvProfile: 8 });
});
it("migrates disabled hwdec and bounds untrusted persisted settings", () => {
  expect(normalizeQuality(undefined, false)).toMatchObject({
    hwdec: "no",
    passthrough: "auto",
  });
  expect(
    normalizeQuality({
      codecs: ["ac3", "unknown"],
      shaders: ["../x.glsl", "a.glsl"],
      audioDevice: "bad\n",
    }),
  ).toMatchObject({
    codecs: ["ac3"],
    shaders: ["a.glsl"],
    audioDevice: "auto",
  });
});
it("uses Emby extended stream metadata without assuming numeric enum values", () => {
  expect(
    identifyQuality(
      source({
        ExtendedVideoType: "DolbyVision",
        ExtendedVideoSubType: "DoviProfile81",
      }),
    ),
  ).toMatchObject({ hdr: "Dolby Vision", dvProfile: 8 });
  expect(identifyQuality(source({ ExtendedVideoType: "Hdr10Plus" })).hdr).toBe(
    "HDR10+",
  );
  expect(
    identifyQuality(source({ ExtendedVideoType: "HyperLogGamma" })).hdr,
  ).toBe("HLG");
});
