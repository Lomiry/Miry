import { normalizeSources } from "./sources";
export type DanmakuMode = "scroll" | "top" | "bottom";
export interface DanmakuEntry {
  time: number;
  text: string;
  mode: DanmakuMode;
  color: string;
  duration: number;
}
export interface DanmakuDocument {
  /** Explicit source video length in seconds; absent for uncalibrated providers/local files. */
  videoDuration?: number;
  entries: DanmakuEntry[];
  skipped: number;
  format: "XML" | "ASS" | "Online";
}
export interface DanmakuSettings {
  enabled: boolean;
  onlineEnabled?: boolean;
  autoMatch?: boolean;
  fontSize: number;
  opacity: number;
  speed: number;
  speedSchema?: 2;
  area: number;
  density: number;
  offset: number;
  deduplicate: boolean;
  blockColor: boolean;
  blockTop: boolean;
  blockBottom: boolean;
  blockLong: boolean;
  sources?: import("./sources").SourceSettings;
}
export const danmakuDefaults: DanmakuSettings = {
  enabled: true,
  onlineEnabled: true,
  autoMatch: true,
  fontSize: 28,
  opacity: 0.85,
  speed: 1,
  speedSchema: 2,
  area: 1,
  density: 48,
  offset: 0,
  deduplicate: false,
  blockColor: false,
  blockTop: false,
  blockBottom: false,
  blockLong: false,
};
const finite = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;
export function normalizeDanmaku(
  value: Partial<DanmakuSettings> | undefined,
): DanmakuSettings {
  const v = value || {},
    d = danmakuDefaults;
  return {
    enabled: v.enabled !== false,
    onlineEnabled: v.onlineEnabled !== false,
    autoMatch: v.autoMatch !== false,
    fontSize: finite(v.fontSize, 16, 60, d.fontSize),
    opacity: finite(v.opacity, 0, 1, d.opacity),
    speed:
      typeof v.speed === "number" &&
      Number.isFinite(v.speed) &&
      v.speed >= 0.5 &&
      v.speed <= 4
        ? v.speed
        : d.speed,
    speedSchema: 2,
    area: [0.5, 0.75, 1].includes(v.area!) ? v.area! : d.area,
    density: [24, 48, 96].includes(v.density!) ? v.density! : d.density,
    offset: Math.round(finite(v.offset, -600, 600, 0) * 10) / 10,
    deduplicate:
      typeof v.deduplicate === "boolean" ? v.deduplicate : d.deduplicate,
    blockColor: v.blockColor === true,
    blockTop: v.blockTop === true,
    blockBottom: v.blockBottom === true,
    blockLong: typeof v.blockLong === "boolean" ? v.blockLong : d.blockLong,
    ...(v.sources ? { sources: normalizeSources(v.sources) } : {}),
  };
}
export interface DanmakuClock {
  position: number;
  sampledAt: number;
  paused: boolean;
  speed: number;
  active: boolean;
  loaded: boolean;
  buffering: boolean;
  session: string;
}
export interface DanmakuPresentation {
  name: string;
  count: number;
  skipped: number;
  status: string;
  settings: DanmakuSettings;
  offset: number;
  bound: boolean;
  loading?: boolean;
  source?: "local" | "online";
  density?: import("./density").DanmakuDensity;
  online?: {
    sessionKey?: string;
    confirmed?: boolean;
    pending?: boolean;
    loadedCount?: number;
    videoDuration?: number;
    context?: import("./online").DanmakuMediaContext;
    configured: boolean;
    mock: boolean;
    builtIn?: boolean;
    status: string;
    query: string;
    candidates: import("./online").DanmakuMatch[];
    match?: import("./online").DanmakuMatch;
    loading: boolean;
    sourceName?: string;
    failures?: { source: string; kind: string }[];
    mode?: string;
    sources?: { id: string; name: string; enabled: boolean }[];
  };
}
export type DanmakuCommand =
  | "choose"
  | "unbind"
  | "toggle"
  | "settings"
  | "search"
  | "select"
  | "reload"
  | "rematch"
  | "online"
  | "configure"
  | "source-mode"
  | "clear-credential";
