import type { MediaStream, MediaSource } from "../types/emby";

export type HdrType =
  | "SDR"
  | "HDR10"
  | "HDR10+"
  | "Dolby Vision"
  | "HLG"
  | "Unknown";
export interface MediaQuality {
  hdr: HdrType;
  bitDepth: number | null;
  primaries: "BT.709" | "BT.2020" | "Unknown";
  dvProfile: number | null;
  evidence: "stream" | "emby" | "unknown";
}
export interface QualitySettings {
  hdr: "auto" | "source" | "sdr";
  hwdec: "auto" | "auto-safe" | "no";
  passthrough: "auto" | "on" | "off";
  codecs: string[];
  audioDevice: string;
  mpvConfig: boolean;
  inputConfig: boolean;
  extraArgs: string[];
  shadersEnabled: boolean;
  shaders: string[];
}
export const bitstreamCodecs = ["ac3", "eac3", "dts", "dts-hd", "truehd"];
export const qualityDefaults: QualitySettings = {
  hdr: "auto",
  hwdec: "auto-safe",
  passthrough: "auto",
  codecs: ["ac3", "eac3", "dts"],
  audioDevice: "auto",
  mpvConfig: false,
  inputConfig: false,
  extraArgs: [],
  shadersEnabled: false,
  shaders: [],
};
export function normalizeQuality(
  value: Partial<QualitySettings> | undefined,
  legacyHardware = true,
): QualitySettings {
  const raw = value || {};
  const choices = <T extends string>(
    value: unknown,
    list: T[],
    fallback: T,
  ): T => (list.includes(value as T) ? (value as T) : fallback);
  const strings = (value: unknown, limit: number) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (s): s is string => typeof s === "string" && s.length <= 1000,
            ),
          ),
        ].slice(0, limit)
      : [];
  return {
    hdr: choices(raw.hdr, ["auto", "source", "sdr"], "auto"),
    hwdec: choices(
      raw.hwdec,
      ["auto", "auto-safe", "no"],
      legacyHardware ? "auto-safe" : "no",
    ),
    passthrough: choices(raw.passthrough, ["auto", "on", "off"], "auto"),
    codecs: Array.isArray(raw.codecs)
      ? strings(raw.codecs, 5).filter((c) => bitstreamCodecs.includes(c))
      : [...qualityDefaults.codecs],
    audioDevice:
      typeof raw.audioDevice === "string" &&
      raw.audioDevice.length <= 512 &&
      !/[\r\n\0]/.test(raw.audioDevice)
        ? raw.audioDevice
        : "auto",
    mpvConfig: raw.mpvConfig === true,
    inputConfig: raw.inputConfig === true,
    extraArgs: strings(raw.extraArgs, 32),
    shadersEnabled: raw.shadersEnabled === true,
    shaders: strings(raw.shaders, 64).filter((s) =>
      /^[^/\\:]+\.glsl$/i.test(s),
    ),
  };
}

// Only tagged media information is evidence. Titles and filenames are never read.
export function identifyQuality(
  source?: MediaSource,
  params?: Record<string, unknown>,
): MediaQuality {
  const video: MediaStream | undefined = source?.MediaStreams?.find(
    (s) => s.Type === "Video",
  );
  const transfer = String(
    params?.gamma || video?.ColorTransfer || "",
  ).toLowerCase();
  const range = String(video?.ExtendedVideoType || video?.VideoRange || "")
    .toLowerCase()
    .replace(/[ _-]/g, "");
  const color = String(
    params?.primaries || video?.ColorPrimaries || "",
  ).toLowerCase();
  const subtypeProfile = /^DoviProfile([0-9])[0-9]$/i.exec(
    video?.ExtendedVideoSubType || "",
  );
  const explicitDv =
    params?.["dolby-vision-profile"] ??
    video?.DvProfile ??
    (subtypeProfile ? Number(subtypeProfile[1]) : undefined);
  const dvProfile =
    typeof explicitDv === "number" && explicitDv > 0 ? explicitDv : null;
  const isDv =
    dvProfile !== null ||
    params?.["dolby-vision"] === true ||
    range === "dolbyvision" ||
    range === "dv";
  const streamSdr =
    !!params?.gamma &&
    ["bt.1886", "bt709", "bt.709", "srgb", "gamma2.2", "gamma2.4"].includes(
      transfer,
    );
  const hdr: HdrType = isDv
    ? "Dolby Vision"
    : streamSdr
      ? "SDR"
      : range === "hdr10plus" ||
          range === "hdr10+" ||
          params?.["hdr10-plus"] === true
        ? "HDR10+"
        : transfer === "pq" || transfer === "smpte2084" || range === "hdr10"
          ? "HDR10"
          : transfer === "hlg" ||
              transfer === "arib-std-b67" ||
              range === "hlg" ||
              range === "hyperloggamma"
            ? "HLG"
            : range === "sdr" ||
                [
                  "bt.1886",
                  "bt709",
                  "bt.709",
                  "srgb",
                  "gamma2.2",
                  "gamma2.4",
                ].includes(transfer)
              ? "SDR"
              : "Unknown";
  const pixelFormat = String(
    params?.["hw-pixelformat"] || params?.pixelformat || "",
  );
  const pixelDepth = /(?:p|rgb|bgr)(10|12|14|16)(?:le|be)?$/i.exec(pixelFormat);
  const taggedDepth = pixelDepth
    ? Number(pixelDepth[1])
    : /^(?:yuvj?(?:420|422|444)p|nv12|rgb24|bgr24|rgba|bgra)$/i.test(
          pixelFormat,
        )
      ? 8
      : /^p010/i.test(pixelFormat)
        ? 10
        : null;
  const depth = params?.["component-bits"] ?? taggedDepth ?? video?.BitDepth;
  return {
    hdr,
    bitDepth:
      typeof depth === "number" && depth >= 8 && depth <= 16 ? depth : null,
    primaries: ["bt.2020", "bt2020"].includes(color)
      ? "BT.2020"
      : ["bt.709", "bt709"].includes(color)
        ? "BT.709"
        : "Unknown",
    dvProfile,
    evidence:
      params?.gamma || params?.primaries
        ? "stream"
        : video
          ? "emby"
          : "unknown",
  };
}
