import { expect, it, vi, afterEach } from "vitest";
import { EmbyClient } from "../api/client";
import {
  chooseSource,
  transcodeUrl,
  deviceProfile,
  preparePlayback,
} from "./playback";
import { defaults } from "../stores/settings";
const api = new EmbyClient({
  server: "https://qa.test/proxy/emby",
  userId: "u",
  token: "private",
  deviceId: "d",
  name: "QA",
});
const item = { Id: "m", Name: "QA", Type: "Movie" },
  transcode = {
    Id: "v",
    SupportsTranscoding: true,
    TranscodingUrl: "/emby/Videos/m/master.m3u8?api_key=private&Tag=keep",
  },
  direct = { Id: "d", SupportsDirectStream: true };
afterEach(() => vi.unstubAllGlobals());
it("renegotiates offset HLS with the current session so resume is applied only once", async () => {
  const fetch = vi.fn().mockImplementation(async (_u, opts) => {
    const body = JSON.parse(opts.body);
    return new Response(
      JSON.stringify({
        PlaySessionId: "s",
        MediaSources: [
          {
            ...transcode,
            TranscodingUrl: `/emby/Videos/m/master.m3u8?StartTimeTicks=${body.StartTimeTicks}`,
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  const launch = await preparePlayback(
    api,
    { ...item, UserData: { PlaybackPositionTicks: 123e7 } },
    false,
  );
  expect(launch.startSeconds).toBe(123);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    StartTimeTicks: 0,
    CurrentPlaySessionId: "s",
    MediaSourceId: "v",
  });
});
it("uses an explicit H264/AAC HLS profile and retains HEVC AV1 PGS ASS and DTS decoding declarations", () => {
  const p = deviceProfile();
  expect(p.TranscodingProfiles[0]).toMatchObject({
    VideoCodec: "h264",
    AudioCodec: "aac",
    Protocol: "hls",
  });
  expect(p.DirectPlayProfiles[0].VideoCodec).toContain("av1");
  expect(p.DirectPlayProfiles[0].VideoCodec).toContain("hevc");
  expect(p.SubtitleProfiles).toContainEqual({ Format: "pgs", Method: "Embed" });
  expect(deviceProfile("direct-only").TranscodingProfiles).toEqual([]);
});
it("prefers direct playback and allows server-order auto while direct-only cannot transcode", () => {
  const info = { PlaySessionId: "s", MediaSources: [transcode, direct] };
  expect(chooseSource(info, undefined, "prefer-direct").Id).toBe("d");
  expect(chooseSource(info, undefined, "auto").Id).toBe("v");
  expect(() =>
    chooseSource(
      { ...info, MediaSources: [transcode] },
      undefined,
      "direct-only",
    ),
  ).toThrow("无法直接播放");
  expect(chooseSource(info, "v", "prefer-direct").Id).toBe("v");
});
it("uses the server transcode URL on the same origin with credentials only in headers", () => {
  const url = new URL(transcodeUrl(api, item, transcode, "session"));
  expect(url.pathname).toBe("/proxy/emby/Videos/m/master.m3u8");
  expect(url.searchParams.get("Tag")).toBe("keep");
  expect(url.searchParams.get("api_key")).toBeNull();
  expect(url.searchParams.get("PlaySessionId")).toBe("session");
  expect(() =>
    transcodeUrl(
      api,
      item,
      { ...transcode, TranscodingUrl: "https://other.test/stream" },
      "s",
    ),
  ).toThrow("无效");
});
it("negotiates and reports Transcode through the existing launch contract, and explicitly disables it in direct-only", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ PlaySessionId: "s", MediaSources: [transcode] }),
        ),
    );
  vi.stubGlobal("fetch", fetch);
  const launch = await preparePlayback(api, item, false);
  expect(launch.playMethod).toBe("Transcode");
  expect(launch.playSessionId).toBe("s");
  await expect(
    preparePlayback(api, item, false, undefined, undefined, {
      ...defaults,
      compatibility: "direct-only",
    }),
  ).rejects.toThrow("无法直接播放");
  expect(JSON.parse(fetch.mock.calls.at(-1)![1].body).EnableTranscoding).toBe(
    false,
  );
});
