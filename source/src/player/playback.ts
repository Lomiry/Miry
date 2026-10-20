import type { Item, MediaSource, PlaybackInfo } from "../types/emby";
import { ApiError, type EmbyClient } from "../api/client";
import { recordNetwork } from "../api/diagnostics";
import { defaults, type Settings } from "../stores/settings";
import {
  identifyQuality,
  normalizeQuality,
  type MediaQuality,
} from "./quality";
import { normalizeShortcuts } from "./shortcuts";
import { normalizeVideoFit, type VideoFit } from "./videoFit";
export class PlaybackError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "PlaybackError";
  }
}
function deliveredUrl(
  server: string,
  delivery: string,
  method: "DirectPlay" | "DirectStream" | "Transcode",
) {
  let url: URL;
  try {
    url = new URL(delivery, server + "/");
  } catch {
    throw new PlaybackError(`${method}-url`, "服务器返回的播放入口无效。");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new PlaybackError(
      "unsupported-protocol",
      "播放入口仅支持 HTTP 或 HTTPS。",
    );
  if (
    url.username ||
    url.password ||
    url.hash ||
    /(?:^|\/)Download(?:\/|$)/i.test(url.pathname)
  )
    throw new PlaybackError(`${method}-url`, "服务器返回的播放入口无效。");
  return url;
}
export const mpvProfile = {
  Name: "Miry mpv",
  MaxStreamingBitrate: 1000000000,
  DirectPlayProfiles: [
    {
      Type: "Video",
      Container: "mkv,mp4,m4v,avi,mov,webm,ts,m2ts,mpeg,mpg,wmv,flv,ogv",
      VideoCodec: "h264,hevc,av1,vp8,vp9,mpeg2video,mpeg4,vc1",
      AudioCodec:
        "aac,ac3,eac3,truehd,dts,flac,opus,vorbis,mp3,pcm_s16le,pcm_s24le",
    },
  ],
  SubtitleProfiles: [
    { Format: "pgs", Method: "Embed" },
    { Format: "srt", Method: "External" },
    { Format: "ass", Method: "External" },
    { Format: "ssa", Method: "External" },
    { Format: "subrip", Method: "External" },
    { Format: "pgssub", Method: "Embed" },
    { Format: "dvdsub", Method: "Embed" },
  ],
};
export function deviceProfile(
  mode: Settings["compatibility"] = "prefer-direct",
) {
  return {
    ...mpvProfile,
    TranscodingProfiles:
      mode === "direct-only"
        ? []
        : [
            {
              Type: "Video",
              Container: "ts",
              VideoCodec: "h264",
              AudioCodec: "aac",
              Protocol: "hls",
              Context: "Streaming",
              MaxAudioChannels: "2",
              MinSegments: 1,
              SegmentLength: 4,
            },
          ],
  };
}
export function secondsToTicks(seconds: number) {
  return Math.round(
    Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 10000000,
  );
}
export function resolveMediaUrl(server: string, delivery: string) {
  const base = new URL(server);
  if (/^https?:\/\//i.test(delivery)) return new URL(delivery);
  if (delivery.startsWith(base.pathname + "/"))
    return new URL(delivery, base.origin);
  const relative = delivery.replace(/^\/emby\//i, "/").replace(/^\//, "");
  return new URL(relative, server + "/");
}
export function streamUrl(
  api: EmbyClient,
  item: Item,
  source: MediaSource,
  session: string,
) {
  const base = new URL(api.account.server);
  const extension = /^[a-z0-9]{1,16}$/i.test(source.Container || "")
    ? `.${source.Container!.toLowerCase()}`
    : "";
  const fallback = () =>
    new URL(
      `${api.account.server}/Videos/${encodeURIComponent(item.Id)}/stream${extension}?Static=true`,
    );
  let url = fallback();
  if (
    source.SupportsDirectPlay !== true &&
    source.SupportsDirectStream === true &&
    !source.DirectStreamUrl
  )
    throw new PlaybackError("DirectStream-url", "服务器未提供直接串流入口。");
  if (source.DirectStreamUrl) {
    const delivered = deliveredUrl(
      api.account.server,
      source.DirectStreamUrl,
      source.SupportsDirectPlay === true ? "DirectPlay" : "DirectStream",
    );
    if (
      delivered.username ||
      delivered.password ||
      delivered.hash ||
      /(?:^|\/)Download(?:\/|$)/i.test(delivered.pathname)
    )
      throw new Error("服务器返回的播放入口无效。");
    if (delivered.origin === base.origin) url = delivered;
    else if (
      source.SupportsDirectPlay !== true &&
      source.SupportsDirectStream === true
    )
      throw new PlaybackError(
        "DirectStream-url",
        "服务器的直接串流入口不属于当前连接。",
      );
  }
  // Authentication stays in HTTP headers; signed delivery parameters remain intact.
  for (const key of [...url.searchParams.keys()])
    if (
      ["api_key", "access_token", "accesstoken", "x-emby-token"].includes(
        key.toLowerCase(),
      )
    )
      url.searchParams.delete(key);
  url.searchParams.set("MediaSourceId", source.Id);
  url.searchParams.set("PlaySessionId", session);
  url.searchParams.set("DeviceId", api.account.deviceId);
  return url.toString();
}
export function chooseSource(
  info: PlaybackInfo,
  sourceId?: string,
  mode: Settings["compatibility"] = "direct-only",
): MediaSource {
  if (!info || typeof info !== "object" || !Array.isArray(info.MediaSources))
    throw new PlaybackError(
      "playback-info-format",
      "服务器返回的播放信息格式无效。",
    );
  if (info.ErrorCode)
    throw new PlaybackError(
      "no-playable-source",
      `服务器无法准备播放：${/^[a-z0-9_]{1,64}$/i.test(info.ErrorCode) ? info.ErrorCode : "无可用媒体源"}`,
    );
  const candidates = info.MediaSources.filter(
    (s) =>
      s &&
      typeof s.Id === "string" &&
      !!s.Id &&
      (!sourceId || s.Id === sourceId) &&
      !s.RequiresOpening &&
      !s.RequiresClosing,
  );
  const direct = (s: MediaSource) =>
    s.SupportsDirectPlay === true || s.SupportsDirectStream === true;
  const transcode = (s: MediaSource) =>
    s.SupportsTranscoding === true &&
    typeof s.TranscodingUrl === "string" &&
    !!s.TranscodingUrl;
  const source =
    mode === "auto"
      ? candidates?.find((s) => direct(s) || transcode(s))
      : candidates?.find(direct) ||
        (mode !== "direct-only" ? candidates?.find(transcode) : undefined);
  if (!source) {
    if (
      mode !== "direct-only" &&
      candidates.some(
        (s) => s.SupportsTranscoding === true && !s.TranscodingUrl,
      )
    )
      throw new PlaybackError(
        "no-transcoding-url",
        "服务器未提供转码播放入口。",
      );
    throw new PlaybackError(
      "no-playable-source",
      "此媒体无法直接播放或协商兼容播放，或需要动态开启媒体源。",
    );
  }
  return source;
}
export function preferredStream(
  source: MediaSource,
  type: string,
  language: string,
) {
  const aliases: Record<string, string[]> = {
    zh: ["zh", "chi", "zho", "chs", "cht", "cmn"],
    en: ["en", "eng"],
    ja: ["ja", "jpn"],
  };
  return source.MediaStreams?.find(
    (s) =>
      s.Type === type &&
      (aliases[language] || [language]).includes(
        (s.Language || "").toLowerCase(),
      ),
  )?.Index;
}
async function preparePlaybackInner(
  api: EmbyClient,
  item: Item,
  fromStart: boolean,
  signal?: AbortSignal,
  sourceId?: string,
  settings: Settings = defaults,
  context?: { mediaSourceId?: string; playMethod?: string },
) {
  const startTicks = fromStart ? 0 : item.UserData?.PlaybackPositionTicks || 0;
  let info = await api.request<PlaybackInfo>(
    `/Items/${encodeURIComponent(item.Id)}/PlaybackInfo`,
    {},
    {
      UserId: api.account.userId,
      MediaSourceId: sourceId,
      StartTimeTicks: startTicks,
      IsPlayback: true,
      AutoOpenLiveStream: false,
      EnableDirectPlay: true,
      EnableDirectStream: true,
      EnableTranscoding: settings.compatibility !== "direct-only",
      DeviceProfile: deviceProfile(settings.compatibility),
    },
    signal,
  );
  let source = chooseSource(
    info,
    sourceId,
    settings.compatibility || "prefer-direct",
  );
  if (context) {
    context.mediaSourceId = source.Id;
    context.playMethod = source.SupportsDirectPlay
      ? "DirectPlay"
      : source.SupportsDirectStream
        ? "DirectStream"
        : "Transcode";
  }
  // Keep native positions absolute: request a full VOD when the server initially
  // offers a stream already offset to the resume point. Do not seek twice.
  if (
    !source.SupportsDirectPlay &&
    !source.SupportsDirectStream &&
    source.TranscodingUrl
  ) {
    const offset = new URL(
      source.TranscodingUrl,
      api.account.server + "/",
    ).searchParams.get("StartTimeTicks");
    if (offset !== null && Number(offset) > 0) {
      info = await api.request<PlaybackInfo>(
        `/Items/${encodeURIComponent(item.Id)}/PlaybackInfo`,
        {},
        {
          UserId: api.account.userId,
          MediaSourceId: source.Id,
          CurrentPlaySessionId: info.PlaySessionId,
          StartTimeTicks: 0,
          IsPlayback: true,
          AutoOpenLiveStream: false,
          EnableDirectPlay: false,
          EnableDirectStream: false,
          EnableTranscoding: true,
          DeviceProfile: deviceProfile(settings.compatibility),
        },
        signal,
      );
      source = chooseSource(
        info,
        source.Id,
        settings.compatibility || "prefer-direct",
      );
      const nextOffset =
        source.TranscodingUrl &&
        new URL(
          source.TranscodingUrl,
          api.account.server + "/",
        ).searchParams.get("StartTimeTicks");
      if (nextOffset && Number(nextOffset) > 0)
        throw Error("服务器未提供完整可定位的兼容播放流，请选择直接播放源。");
    }
  }
  if (typeof info.PlaySessionId !== "string" || !info.PlaySessionId)
    throw new PlaybackError(
      "playback-info-format",
      "服务器没有返回有效的播放会话 ID。",
    );
  const subtitles = (source.MediaStreams || [])
    .filter((s) => s.Type === "Subtitle" && s.IsExternal && s.DeliveryUrl)
    .flatMap((s) => {
      if (!Number.isInteger(s.Index) || s.Index < 0) return [];
      try {
        deliveredUrl(api.account.server, s.DeliveryUrl!, "DirectPlay");
      } catch {
        return [];
      }
      const url = resolveMediaUrl(api.account.server, s.DeliveryUrl!);
      if (url.origin !== new URL(api.account.server).origin) return [];
      const route = /\/Videos\/[^/]+\/([^/]+)\/Subtitles\/([0-9]+)\//i.exec(
        url.pathname,
      );
      if (
        route &&
        (decodeURIComponent(route[1]) !== source.Id ||
          Number(route[2]) !== s.Index)
      )
        return [];
      url.searchParams.delete("api_key");
      for (const key of [...url.searchParams.keys()])
        if (
          ["access_token", "accesstoken", "x-emby-token"].includes(
            key.toLowerCase(),
          )
        )
          url.searchParams.delete(key);
      url.searchParams.set("MediaSourceId", source.Id);
      url.searchParams.set("StreamIndex", String(s.Index));
      return [
        {
          url: url.toString(),
          index: s.Index,
          title: s.DisplayTitle || s.Language || `字幕 ${s.Index}`,
          language: s.Language || "",
        },
      ];
    });
  // Explicit server delivery indexes describe remux/transcode output selection.
  const delivery =
    !source.SupportsDirectPlay &&
    (source.SupportsDirectStream
      ? source.DirectStreamUrl
      : source.TranscodingUrl);
  const deliveryIndex = (type: "Audio" | "Subtitle") => {
    if (!delivery) return undefined;
    const raw = new URL(delivery, api.account.server + "/").searchParams.get(
      `${type}StreamIndex`,
    );
    if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
    const index = Number(raw);
    return Number.isSafeInteger(index) &&
      (index >= 0 || (type === "Subtitle" && index === -1))
      ? index
      : undefined;
  };
  return {
    serverId: api.account.serverId || "",
    server: api.account.server,
    userId: api.account.userId,
    token: api.account.token,
    deviceId: api.account.deviceId,
    itemId: item.Id,
    title: item.SeriesName ? `${item.SeriesName} · ${item.Name}` : item.Name,
    sourceId: source.Id,
    playSessionId: info.PlaySessionId,
    url:
      source.SupportsDirectPlay || source.SupportsDirectStream
        ? streamUrl(api, item, source, info.PlaySessionId)
        : transcodeUrl(api, item, source, info.PlaySessionId),
    startSeconds: startTicks / 10000000,
    audioIndex:
      deliveryIndex("Audio") ??
      (settings.audioLanguage === "auto"
        ? source.DefaultAudioStreamIndex
        : (preferredStream(source, "Audio", settings.audioLanguage) ??
          source.DefaultAudioStreamIndex)),
    subtitleIndex:
      deliveryIndex("Subtitle") ??
      (settings.subtitleLanguage === "off"
        ? -1
        : settings.subtitleLanguage === "auto"
          ? source.DefaultSubtitleStreamIndex
          : (preferredStream(source, "Subtitle", settings.subtitleLanguage) ??
            source.DefaultSubtitleStreamIndex)),
    subtitles,
    subtitlePosition: settings.subtitlePosition,
    subtitleScale: settings.subtitleScale,
    videoFit: normalizeVideoFit(settings.videoFit),
    secondarySubtitlePosition: settings.secondarySubtitlePosition,
    secondarySubtitleScale: settings.secondarySubtitleScale,
    volume: settings.volume,
    fullscreen: settings.fullscreen,
    hardwareDecode: settings.hardwareDecode,
    embedded: settings.embedded,
    quality: normalizeQuality(settings.quality, settings.hardwareDecode),
    mediaQuality: identifyQuality(source),
    shortcuts: normalizeShortcuts(settings.shortcuts),
    playMethod: source.SupportsDirectPlay
      ? "DirectPlay"
      : source.SupportsDirectStream
        ? "DirectStream"
        : "Transcode",
  };
}
export async function preparePlayback(
  api: EmbyClient,
  item: Item,
  fromStart: boolean,
  signal?: AbortSignal,
  sourceId?: string,
  settings: Settings = defaults,
) {
  const context = {
    mediaSourceId: sourceId,
    playMethod: undefined as string | undefined,
  };
  try {
    return await preparePlaybackInner(
      api,
      item,
      fromStart,
      signal,
      sourceId,
      settings,
      context,
    );
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error;
    const status = error instanceof ApiError ? error.status : undefined;
    const failure =
      error instanceof PlaybackError
        ? error
        : error instanceof ApiError
          ? new PlaybackError(
              "playback-info-request",
              `播放信息获取失败${status ? `（HTTP ${status}）` : ""}，请检查连接和账号权限。`,
              status,
            )
          : new PlaybackError(
              "playback-info-format",
              "服务器返回的播放信息无效。",
            );
    recordNetwork({
      stage: "playback-preparation",
      method: "POST",
      url: "[server]/Items/{id}/PlaybackInfo",
      backend: "Miry source selection",
      elapsedMs: 0,
      status: failure.status,
      category: status ? "http" : "format",
      underlying: failure.code,
      itemId:
        /^[\w-]{1,128}$/.test(item.Id) && item.Id !== api.account.token
          ? item.Id
          : "[id]",
      mediaSourceId:
        context.mediaSourceId &&
        /^[\w-]{1,128}$/.test(context.mediaSourceId) &&
        context.mediaSourceId !== api.account.token
          ? context.mediaSourceId
          : undefined,
      playMethod: context.playMethod,
    });
    throw failure;
  }
}
export function transcodeUrl(
  api: EmbyClient,
  item: Item,
  source: MediaSource,
  session: string,
) {
  if (!source.TranscodingUrl) throw Error("服务器没有提供兼容播放入口。");
  deliveredUrl(api.account.server, source.TranscodingUrl, "Transcode");
  const url = resolveMediaUrl(api.account.server, source.TranscodingUrl),
    base = new URL(api.account.server);
  if (
    url.origin !== base.origin ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    /(?:^|\/)Download(?:\/|$)/i.test(url.pathname)
  )
    throw Error("服务器返回的兼容播放入口无效。");
  for (const k of [...url.searchParams.keys()])
    if (
      ["api_key", "access_token", "accesstoken", "x-emby-token"].includes(
        k.toLowerCase(),
      )
    )
      url.searchParams.delete(k);
  url.searchParams.set("MediaSourceId", source.Id);
  url.searchParams.set("PlaySessionId", session);
  url.searchParams.set("DeviceId", api.account.deviceId);
  return url.toString();
}
export interface Track {
  id: number;
  type: string;
  title?: string;
  lang?: string;
  codec?: string;
  selected?: boolean;
  "main-selection"?: number;
  "ff-index"?: number;
  external?: boolean;
  "external-filename"?: string;
}
export interface PlayerSnapshot {
  videoFit?: VideoFit;
  syncTimeouts?: number;
  playMethod?: string;
  inputRateBps?: number | null;
  doubleClickMs?: number;
  shortcuts?: import("./shortcuts").Shortcuts;
  active: boolean;
  loaded: boolean;
  title: string;
  position: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  tracks: Track[];
  error: string;
  syncError: string;
  finished: boolean;
  playSessionId?: string;
  itemId?: string;
  syncComplete?: boolean;
  speed?: number;
  subtitleDelay?: number;
  subtitlePosition?: number;
  ontop?: boolean;
  fullscreen?: boolean;
  secondarySubtitle?: number;
  subtitleScale?: number;
  secondarySubtitlePosition?: number;
  secondarySubtitleScale?: number;
  embedded?: boolean;
  bufferSeconds?: number;
  buffering?: boolean;
  audioDelay?: number;
  loopA?: number;
  loopB?: number;
  networkDetails?: string[];
  loadElapsedMs?: number;
  mediaQuality?: MediaQuality;
  videoParams?: Record<string, unknown>;
  videoOutput?: Record<string, unknown>;
  windowsHdr?: { hdr: boolean | null; advancedColor: boolean | null };
  outputPolicy?: string;
  requestedOutputPolicy?: string;
  audioDevice?: string;
  audioOutput?: Record<string, unknown>;
  audioFallback?: boolean;
  renderer?: string;
  hardwareDecoder?: string;
}
