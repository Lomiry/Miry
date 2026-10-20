import { normalizeVideoFit, type VideoFit } from "../player/videoFit";
import {
  normalizeQuality,
  qualityDefaults,
  type QualitySettings,
} from "../player/quality";
import {
  defaultShortcuts,
  normalizeShortcuts,
  type Shortcuts,
} from "../player/shortcuts";
import {
  normalizeDanmaku,
  danmakuDefaults,
  type DanmakuSettings,
} from "../danmaku/types";
export interface Settings {
  videoFit: VideoFit;
  danmaku?: DanmakuSettings;
  compatibility?: "auto" | "prefer-direct" | "direct-only";
  systemMedia?: boolean;
  autoNext: boolean;
  audioLanguage: string;
  subtitleLanguage: string;
  subtitlePosition: number;
  subtitleScale: number;
  secondarySubtitlePosition: number;
  secondarySubtitleScale: number;
  volume: number;
  fullscreen: boolean;
  hardwareDecode: boolean;
  embedded: boolean;
  introSeconds: number;
  outroSeconds: number;
  quality?: QualitySettings;
  shortcuts?: Shortcuts;
}
export const defaults: Settings = {
  videoFit: "fit",
  danmaku: danmakuDefaults,
  compatibility: "prefer-direct",
  systemMedia: true,
  autoNext: true,
  audioLanguage: "auto",
  subtitleLanguage: "auto",
  subtitlePosition: 100,
  subtitleScale: 1,
  secondarySubtitlePosition: 0,
  secondarySubtitleScale: 1,
  volume: 75,
  fullscreen: false,
  hardwareDecode: true,
  embedded: true,
  introSeconds: 90,
  outroSeconds: 60,
  quality: qualityDefaults,
  shortcuts: defaultShortcuts,
};
export function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem("miry-settings") || "{}");
    if (
      raw?.danmaku &&
      typeof raw.danmaku === "object" &&
      raw.danmaku.speedSchema !== 2
    ) {
      const speed = raw.danmaku.speed;
      raw.danmaku = normalizeDanmaku({
        ...raw.danmaku,
        speed:
          typeof speed === "number" &&
          Number.isFinite(speed) &&
          speed >= 0.5 &&
          speed <= 2
            ? speed * 2
            : 1,
      });
      try {
        localStorage.setItem("miry-settings", JSON.stringify(raw));
      } catch {
        /* In-memory migration remains readable if storage is full. */
      }
    }
    if (
      raw &&
      typeof raw === "object" &&
      ("refreshRateMatch" in raw || "releaseEndpoint" in raw)
    ) {
      delete raw.refreshRateMatch;
      delete raw.releaseEndpoint;
      try {
        localStorage.setItem("miry-settings", JSON.stringify(raw));
      } catch {
        /* Keep readable preferences if storage is unavailable. */
      }
    }
    return {
      videoFit: normalizeVideoFit(raw.videoFit),
      danmaku: normalizeDanmaku(raw.danmaku),
      compatibility: ["auto", "prefer-direct", "direct-only"].includes(
        raw.compatibility,
      )
        ? raw.compatibility
        : "prefer-direct",
      systemMedia: raw.systemMedia !== false,
      quality: normalizeQuality(raw.quality, raw.hardwareDecode !== false),
      shortcuts: normalizeShortcuts(raw.shortcuts),
      autoNext:
        typeof raw.autoNext === "boolean" ? raw.autoNext : defaults.autoNext,
      audioLanguage: ["auto", "zh", "en", "ja"].includes(raw.audioLanguage)
        ? raw.audioLanguage
        : "auto",
      subtitleLanguage: ["auto", "off", "zh", "en", "ja"].includes(
        raw.subtitleLanguage,
      )
        ? raw.subtitleLanguage
        : "auto",
      subtitlePosition:
        typeof raw.subtitlePosition === "number" &&
        Number.isFinite(raw.subtitlePosition)
          ? Math.max(0, Math.min(100, Math.round(raw.subtitlePosition)))
          : defaults.subtitlePosition,
      subtitleScale:
        typeof raw.subtitleScale === "number" &&
        Number.isFinite(raw.subtitleScale)
          ? Math.max(0.6, Math.min(1.8, raw.subtitleScale))
          : defaults.subtitleScale,
      secondarySubtitlePosition:
        typeof raw.secondarySubtitlePosition === "number" &&
        Number.isFinite(raw.secondarySubtitlePosition)
          ? Math.max(
              0,
              Math.min(100, Math.round(raw.secondarySubtitlePosition)),
            )
          : defaults.secondarySubtitlePosition,
      secondarySubtitleScale:
        typeof raw.secondarySubtitleScale === "number" &&
        Number.isFinite(raw.secondarySubtitleScale)
          ? Math.max(0.5, Math.min(2, raw.secondarySubtitleScale))
          : defaults.secondarySubtitleScale,
      volume:
        typeof raw.volume === "number" && Number.isFinite(raw.volume)
          ? Math.max(0, Math.min(100, raw.volume))
          : defaults.volume,
      fullscreen: raw.fullscreen === true,
      hardwareDecode: raw.hardwareDecode !== false,
      embedded: raw.embedded !== false,
      introSeconds: Number.isFinite(raw.introSeconds)
        ? Math.max(0, Math.min(600, raw.introSeconds))
        : 90,
      outroSeconds: Number.isFinite(raw.outroSeconds)
        ? Math.max(0, Math.min(600, raw.outroSeconds))
        : 60,
    };
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(settings: Settings) {
  const stored = {
    ...settings,
    videoFit: normalizeVideoFit(settings.videoFit),
  } as unknown as Record<string, unknown>;
  delete stored.refreshRateMatch;
  delete stored.releaseEndpoint;
  localStorage.setItem("miry-settings", JSON.stringify(stored));
  window.dispatchEvent(new Event("miry-settings-changed"));
}
