import { afterEach, expect, it, vi } from "vitest";
import { EmbyClient } from "../api/client";
import {
  chooseSource,
  preparePlayback,
  secondsToTicks,
  streamUrl,
  resolveMediaUrl,
} from "./playback";
import { defaults } from "../stores/settings";
const api = new EmbyClient({
  server: "https://host.test/proxy/emby",
  userId: "user",
  token: "secret",
  name: "Test",
  deviceId: "device",
});
afterEach(() => vi.unstubAllGlobals());
it.each(["fit", "fill", "stretch"] as const)(
  "restores %s on each new video launch",
  async (videoFit) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              PlaySessionId: "session",
              MediaSources: [{ Id: "source", SupportsDirectPlay: true }],
            }),
          ),
      ),
    );
    for (const Id of ["first", "next"]) {
      const launch = await preparePlayback(
        api,
        { Id, Name: "Test", Type: "Movie" },
        false,
        undefined,
        undefined,
        { ...defaults, videoFit },
      );
      expect(launch.videoFit).toBe(videoFit);
    }
  },
);
it("creates a direct stream URL without leaking credentials into the URL", () => {
  const url = new URL(
    streamUrl(
      api,
      { Id: "a/b", Name: "Test", Type: "Movie" },
      { Id: "source" },
      "session",
    ),
  );
  expect(url.pathname).toBe("/proxy/emby/Videos/a%2Fb/stream");
  expect(url.searchParams.get("Static")).toBe("true");
  expect(url.searchParams.get("api_key")).toBeNull();
});
it("rejects unsupported dynamic sources and server errors", () => {
  expect(() =>
    chooseSource({
      MediaSources: [
        { Id: "a", RequiresOpening: true, SupportsDirectPlay: true },
      ],
      PlaySessionId: "s",
    }),
  ).toThrow("无法直接播放");
  expect(() =>
    chooseSource({
      MediaSources: [],
      PlaySessionId: "s",
      ErrorCode: "NoCompatibleStream",
    }),
  ).toThrow("NoCompatibleStream");
});
it("uses the server original-file route rather than the unsupported generic stream endpoint", () => {
  const url = new URL(
    streamUrl(
      api,
      { Id: "movie", Name: "Test", Type: "Movie" },
      {
        Id: "selected",
        Container: "mkv",
        DirectStreamUrl:
          "/proxy/emby/videos/movie/original.mkv?api_key=secret&MediaSourceId=old&PlaySessionId=old&Tag=keep",
      },
      "session",
    ),
  );
  expect(url.pathname).toBe("/proxy/emby/videos/movie/original.mkv");
  expect(url.searchParams.get("Tag")).toBe("keep");
  expect(url.searchParams.get("Static")).toBeNull();
  expect(url.searchParams.get("MediaSourceId")).toBe("selected");
  expect(url.searchParams.get("PlaySessionId")).toBe("session");
  expect(url.searchParams.get("api_key")).toBeNull();
});
it("preserves root-relative delivery routes without inserting the API prefix", () => {
  const item = { Id: "movie", Name: "Test", Type: "Movie" };
  const root = new URL(
    streamUrl(
      api,
      item,
      { Id: "source", DirectStreamUrl: "/videos/movie/original.mp4" },
      "session",
    ),
  );
  expect(root.pathname).toBe("/videos/movie/original.mp4");
  const relative = new URL(
    streamUrl(
      api,
      item,
      { Id: "source", DirectStreamUrl: "videos/movie/original.mp4" },
      "session",
    ),
  );
  expect(relative.pathname).toBe("/proxy/emby/videos/movie/original.mp4");
});
it("uses a container extension when the server omits a direct stream route and keeps credentials on the server origin", () => {
  const item = { Id: "movie", Name: "Test", Type: "Movie" };
  const url = new URL(
    streamUrl(
      api,
      item,
      {
        Id: "source",
        Container: "MKV",
        DirectStreamUrl: "https://other.test/stream",
      },
      "session",
    ),
  );
  expect(url.origin).toBe("https://host.test");
  expect(url.pathname).toBe("/proxy/emby/Videos/movie/stream.mkv");
  expect(url.searchParams.get("Static")).toBe("true");
  expect(() =>
    streamUrl(
      api,
      item,
      {
        Id: "source",
        DirectStreamUrl: "https://user:password@host.test/stream",
      },
      "s",
    ),
  ).toThrow("播放入口无效");
  expect(() =>
    streamUrl(
      api,
      item,
      { Id: "source", DirectStreamUrl: "/Items/movie/Download" },
      "s",
    ),
  ).toThrow("播放入口无效");
});
it("requests playback info with resume position and filters external subtitle origins", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        PlaySessionId: "session",
        MediaSources: [
          {
            Id: "source",
            SupportsDirectPlay: true,
            MediaStreams: [
              {
                Type: "Subtitle",
                Index: 3,
                IsExternal: true,
                DeliveryUrl: "/proxy/emby/subs?api_key=secret",
              },
              {
                Type: "Subtitle",
                Index: 4,
                IsExternal: true,
                DeliveryUrl: "https://other.test/subs",
              },
            ],
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const launch = await preparePlayback(
    api,
    {
      Id: "movie",
      Name: "Test",
      Type: "Movie",
      UserData: { PlaybackPositionTicks: 123000000 },
    },
    false,
  );
  expect(launch.startSeconds).toBe(12.3);
  expect(launch.subtitles).toHaveLength(1);
  expect(launch.subtitles[0].url).not.toContain("secret");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    StartTimeTicks: 123000000,
    EnableTranscoding: true,
    IsPlayback: true,
  });
});
it("converts seconds to Emby ticks without invalid positions", () => {
  expect(secondsToTicks(32.15)).toBe(321500000);
  expect(secondsToTicks(-2)).toBe(0);
  expect(secondsToTicks(Infinity)).toBe(0);
});
it("preserves reverse proxy base paths for relative subtitle delivery URLs", () => {
  for (const path of [
    "/Videos/a/Subtitles/1",
    "/emby/Videos/a/Subtitles/1",
    "Videos/a/Subtitles/1",
    "/proxy/emby/Videos/a/Subtitles/1",
  ])
    expect(resolveMediaUrl(api.account.server, path).pathname).toBe(
      "/proxy/emby/Videos/a/Subtitles/1",
    );
});
it("honors the selected version and preferred audio without silently switching versions", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        PlaySessionId: "session",
        MediaSources: [
          { Id: "1080", SupportsDirectPlay: true },
          {
            Id: "4k",
            SupportsDirectPlay: true,
            DefaultAudioStreamIndex: 1,
            DefaultSubtitleStreamIndex: 2,
            MediaStreams: [{ Type: "Audio", Index: 4, Language: "chi" }],
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const launch = await preparePlayback(
    api,
    { Id: "movie", Name: "Test", Type: "Movie" },
    false,
    undefined,
    "4k",
    {
      ...defaults,
      audioLanguage: "zh",
      subtitleLanguage: "off",
      volume: 40,
      hardwareDecode: false,
      subtitlePosition: 77,
      subtitleScale: 1.37,
      secondarySubtitlePosition: 25,
      secondarySubtitleScale: 0.5,
    },
  );
  expect(launch).toMatchObject({
    sourceId: "4k",
    audioIndex: 4,
    subtitleIndex: -1,
    volume: 40,
    hardwareDecode: false,
    subtitlePosition: 77,
    subtitleScale: 1.37,
    secondarySubtitlePosition: 25,
    secondarySubtitleScale: 0.5,
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body).MediaSourceId).toBe("4k");
  expect(() =>
    chooseSource(
      {
        PlaySessionId: "s",
        MediaSources: [{ Id: "other", SupportsDirectPlay: true }],
      },
      "4k",
    ),
  ).toThrow();
});
