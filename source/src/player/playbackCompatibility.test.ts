import { afterEach, expect, it, vi } from "vitest";
import { EmbyClient } from "../api/client";
import {
  clearNetworkDiagnostics,
  readNetworkDiagnostics,
} from "../api/diagnostics";
import {
  chooseSource,
  preparePlayback,
  streamUrl,
  transcodeUrl,
} from "./playback";
import { defaults } from "../stores/settings";
import type { MediaSource, PlaybackInfo } from "../types/emby";
const api = new EmbyClient({
  server: "https://compat.test/proxy/emby",
  userId: "u",
  token: "secret",
  name: "QA",
  deviceId: "d",
});
const item = { Id: "movie", Name: "Movie", Type: "Movie" };
afterEach(() => {
  vi.unstubAllGlobals();
  clearNetworkDiagnostics();
});
it.each(["DirectPlay", "DirectStream", "Transcode"] as const)(
  "keeps selected source, tracks, session and %s state without fallback",
  async (method) => {
    const chosen: MediaSource = {
      Id: "4k",
      Container: "mkv",
      Path: "D:\\Movies\\movie.mkv",
      SupportsDirectPlay: method === "DirectPlay",
      SupportsDirectStream: method === "DirectStream",
      SupportsTranscoding: method === "Transcode",
      DirectStreamUrl:
        "/proxy/emby/Videos/movie/stream.mkv?Tag=a%2Bb&Static=false",
      TranscodingUrl:
        "/proxy/emby/Videos/movie/master.m3u8?SegmentContainer=ts&StartTimeTicks=0&sig=a%2Bb&api_key=secret",
      DefaultAudioStreamIndex: 4,
      DefaultSubtitleStreamIndex: 8,
      MediaStreams: [
        { Type: "Audio", Index: 4, Language: "eng" },
        {
          Type: "Subtitle",
          Index: 8,
          IsExternal: true,
          DeliveryUrl:
            "/Videos/movie/Subtitles/8/Stream.srt?MediaSourceId=wrong&access_token=secret",
        },
      ],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          PlaySessionId: "session",
          MediaSources: [{ Id: "1080", SupportsDirectPlay: true }, chosen],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const launch = await preparePlayback(api, item, false, undefined, "4k", {
      ...defaults,
      compatibility: "prefer-direct",
    });
    expect(launch.playMethod).toBe(method);
    expect(launch.sourceId).toBe("4k");
    expect(launch.audioIndex).toBe(4);
    expect(launch.subtitleIndex).toBe(8);
    const url = new URL(launch.url);
    expect(url.searchParams.get("MediaSourceId")).toBe("4k");
    expect(url.searchParams.get("PlaySessionId")).toBe("session");
    expect(url.searchParams.get("DeviceId")).toBe("d");
    expect(launch.url).not.toContain("secret");
    expect(launch.url).not.toContain("Movies");
    if (method === "Transcode") {
      expect(url.pathname).toContain("master.m3u8");
      expect(url.searchParams.get("sig")).toBe("a+b");
    } else {
      expect(url.searchParams.get("Tag")).toBe("a+b");
      expect(url.searchParams.get("Static")).toBe("false");
    }
    const sub = new URL(launch.subtitles[0].url);
    expect(sub.searchParams.get("MediaSourceId")).toBe("4k");
    expect(sub.searchParams.get("StreamIndex")).toBe("8");
    expect(sub.searchParams.has("access_token")).toBe(false);
    expect(JSON.parse(fetch.mock.calls[0][1].body).MediaSourceId).toBe("4k");
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it("refuses remux without delivery URL and never makes it static DirectPlay", () => {
  expect(() =>
    streamUrl(api, item, { Id: "s", SupportsDirectStream: true }, "session"),
  ).toThrow("直接串流入口");
});
it.each([
  "ftp://compat.test/movie",
  "file:///D:/Movies/movie",
  "rtsp://compat.test/movie",
])("rejects unsupported delivery protocol %s", (url) => {
  expect(() =>
    streamUrl(
      api,
      item,
      { Id: "s", SupportsDirectPlay: true, DirectStreamUrl: url },
      "session",
    ),
  ).toThrow("HTTP");
  expect(() =>
    transcodeUrl(api, item, { Id: "s", TranscodingUrl: url }, "session"),
  ).toThrow("HTTP");
});
it.each([
  null,
  {},
  { MediaSources: {} },
  { MediaSources: [null, {}, { Id: "wrong", SupportsDirectPlay: true }] },
])("reports malformed or unplayable source without TypeError: %j", (info) => {
  expect(() => chooseSource(info as PlaybackInfo, "selected")).toThrow();
});
it("distinguishes a missing transcode URL and never switches the selected version", () => {
  expect(() =>
    chooseSource(
      {
        PlaySessionId: "s",
        MediaSources: [{ Id: "s", SupportsTranscoding: true }],
      },
      "s",
      "auto",
    ),
  ).toThrow("转码播放入口");
  expect(() =>
    chooseSource(
      {
        PlaySessionId: "s",
        MediaSources: [{ Id: "other", SupportsDirectPlay: true }],
      },
      "selected",
    ),
  ).toThrow("无法直接播放");
});
it.each([401, 403, 404, 500, 503])(
  "keeps HTTP %s preparation failure concise and credential-free",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("Authorization: secret", { status })),
    );
    await expect(preparePlayback(api, item, true)).rejects.toMatchObject({
      code: "playback-info-request",
      status,
    });
    const logs = readNetworkDiagnostics();
    expect(logs.at(-1)?.stage).toBe("playback-preparation");
    expect(JSON.stringify(logs)).not.toContain("secret");
  },
);
it("rejects malformed JSON preparation responses without exposing server content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("api_key=secret")),
  );
  await expect(preparePlayback(api, item, true)).rejects.toMatchObject({
    code: "playback-info-request",
  });
  expect(JSON.stringify(readNetworkDiagnostics())).not.toContain("secret");
});
it.each(
  ["4K", "1080p", "REMUX", "WEB-DL"].flatMap((version) =>
    ["DirectPlay", "DirectStream", "Transcode"].map((method) => [
      version,
      method,
    ]),
  ),
)(
  "keeps %s version and %s session/source, two subtitles and proxy query",
  async (version, method) => {
    const chosen: MediaSource = {
      Id: version,
      Name: version,
      SupportsDirectPlay: method === "DirectPlay",
      SupportsDirectStream: method === "DirectStream",
      SupportsTranscoding: method === "Transcode",
      DirectStreamUrl: `/proxy/emby/Videos/movie/stream.mkv?tag=x%2By&AudioStreamIndex=4&SubtitleStreamIndex=8`,
      TranscodingUrl: `/proxy/emby/Videos/movie/master.m3u8?sig=x%2By&AudioStreamIndex=4&SubtitleStreamIndex=8&StartTimeTicks=0`,
      DefaultAudioStreamIndex: 4,
      DefaultSubtitleStreamIndex: 8,
      MediaStreams: [
        { Type: "Audio", Index: 4, Language: "eng" },
        {
          Type: "Subtitle",
          Index: 8,
          IsExternal: true,
          DeliveryUrl: `/proxy/emby/Videos/movie/${version}/Subtitles/8/Stream.srt?api_key=secret`,
        },
        {
          Type: "Subtitle",
          Index: 9,
          IsExternal: true,
          DeliveryUrl: `/proxy/emby/Videos/movie/${version}/Subtitles/9/Stream.srt?api_key=secret`,
        },
      ],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          PlaySessionId: "matrix-session",
          MediaSources: [{ Id: "other", SupportsDirectPlay: true }, chosen],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const launch = await preparePlayback(api, item, true, undefined, version);
    expect(launch.playMethod).toBe(method);
    expect(launch.sourceId).toBe(version);
    expect(launch.audioIndex).toBe(4);
    expect(launch.subtitleIndex).toBe(8);
    expect(launch.subtitles.map((s) => s.index)).toEqual([8, 9]);
    for (const sub of launch.subtitles) {
      const url = new URL(sub.url);
      expect(url.pathname).toContain("/proxy/emby/");
      expect(url.searchParams.get("MediaSourceId")).toBe(version);
      expect(url.searchParams.get("StreamIndex")).toBe(String(sub.index));
      expect(url.searchParams.has("api_key")).toBe(false);
    }
    const url = new URL(launch.url);
    expect(url.pathname).toContain("/proxy/emby/");
    expect(url.searchParams.get("MediaSourceId")).toBe(version);
    expect(url.searchParams.get("PlaySessionId")).toBe("matrix-session");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      MediaSourceId: version,
      UserId: "u",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
it.each(["DirectPlay", "DirectStream", "Transcode"])(
  "uses current endpoint after route change for %s while retaining logical owner",
  async (method) => {
    for (const server of [
      "https://link00.test/proxy/emby",
      "https://link01.test/proxy/emby",
    ]) {
      const routed = new EmbyClient({
        ...api.account,
        server,
        serverId: "same-server",
        homeServer: api.account.server,
      });
      const source: MediaSource = {
        Id: "selected",
        SupportsDirectPlay: method === "DirectPlay",
        SupportsDirectStream: method === "DirectStream",
        SupportsTranscoding: method === "Transcode",
        DirectStreamUrl: "/proxy/emby/Videos/movie/stream.mkv?q=a%2Bb",
        TranscodingUrl: "/proxy/emby/Videos/movie/master.m3u8?q=a%2Bb",
        MediaStreams: [
          {
            Type: "Subtitle",
            Index: 8,
            IsExternal: true,
            DeliveryUrl:
              "/proxy/emby/Videos/movie/selected/Subtitles/8/Stream.srt",
          },
        ],
      };
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ PlaySessionId: "routed", MediaSources: [source] }),
          ),
        );
      vi.stubGlobal("fetch", fetch);
      const launch = await preparePlayback(
        routed,
        item,
        true,
        undefined,
        "selected",
      );
      expect(launch.serverId).toBe("same-server");
      expect(launch.userId).toBe("u");
      expect(new URL(launch.url).origin).toBe(new URL(server).origin);
      expect(new URL(launch.subtitles[0].url).origin).toBe(
        new URL(server).origin,
      );
      expect(String(fetch.mock.calls[0][0])).toContain(server);
      expect(new URL(launch.url).searchParams.get("q")).toBe("a+b");
      expect(launch.url).not.toContain("secret");
    }
  },
);
it("uses the server-selected transcoded stream indexes rather than an unavailable original language preference", async () => {
  const source: MediaSource = {
    Id: "s",
    SupportsTranscoding: true,
    TranscodingUrl:
      "/proxy/emby/Videos/movie/master.m3u8?AudioStreamIndex=5&SubtitleStreamIndex=8&SubtitleMethod=Encode",
    DefaultAudioStreamIndex: 5,
    DefaultSubtitleStreamIndex: 8,
    MediaStreams: [
      { Type: "Audio", Index: 5, Language: "eng" },
      { Type: "Audio", Index: 6, Language: "chi" },
      { Type: "Subtitle", Index: 8, Language: "eng" },
      { Type: "Subtitle", Index: 9, Language: "chi" },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ PlaySessionId: "s", MediaSources: [source] }),
        ),
      ),
  );
  const launch = await preparePlayback(api, item, true, undefined, "s", {
    ...defaults,
    audioLanguage: "zh",
    subtitleLanguage: "zh",
  });
  expect(launch.audioIndex).toBe(5);
  expect(launch.subtitleIndex).toBe(8);
});
it("includes safe item/source/method context for a known missing DirectStream URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          PlaySessionId: "s",
          MediaSources: [{ Id: "source", SupportsDirectStream: true }],
        }),
      ),
    ),
  );
  await expect(
    preparePlayback(api, item, true, undefined, "source"),
  ).rejects.toThrow();
  expect(readNetworkDiagnostics().at(-1)).toMatchObject({
    itemId: "movie",
    mediaSourceId: "source",
    playMethod: "DirectStream",
    underlying: "DirectStream-url",
  });
  expect(JSON.stringify(readNetworkDiagnostics())).not.toContain("secret");
});
