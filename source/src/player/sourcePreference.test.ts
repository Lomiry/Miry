import { afterEach, expect, it, vi } from "vitest";
import { rankSources } from "./sourcePreference";
import { chooseSource, preparePlayback } from "./playback";
import { EmbyClient } from "../api/client";
import { defaults } from "../stores/settings";
import type { MediaSource } from "../types/emby";
const sources: MediaSource[] = [
  {
    Id: "bitrate",
    Bitrate: 50000000,
    SupportsDirectPlay: true,
    MediaStreams: [{ Type: "Video", Index: 0, Height: 1080, Width: 1920 }],
  },
  {
    Id: "resolution",
    Bitrate: 20000000,
    SupportsDirectPlay: true,
    MediaStreams: [
      { Type: "Video", Index: 0, Height: 2160, Width: 3840 },
      { Type: "Audio", Index: 1 },
      { Type: "Audio", Index: 2 },
      { Type: "Subtitle", Index: 0 },
    ],
  },
];
afterEach(() => vi.restoreAllMocks());
it.each([
  ["resolution", "resolution"],
  ["bitrate", "bitrate"],
] as const)(
  "ranks by %s without mutating the candidate list",
  (policy, expected) => {
    expect(rankSources(sources, policy)[0].Id).toBe(expected);
    expect(
      chooseSource(
        { PlaySessionId: "s", MediaSources: sources },
        undefined,
        "prefer-direct",
        policy,
      ).Id,
    ).toBe(expected);
    expect(sources[0].Id).toBe("bitrate");
  },
);
it("retains explicit manual source selection and compatibility boundaries", () => {
  expect(
    chooseSource(
      { PlaySessionId: "session", MediaSources: sources },
      "bitrate",
      "prefer-direct",
      "resolution",
    ).Id,
  ).toBe("bitrate");
  const extra = {
    Id: "transcode",
    Bitrate: 90000000,
    SupportsTranscoding: true,
    TranscodingUrl: "/stream.m3u8",
  };
  expect(
    chooseSource(
      { PlaySessionId: "session", MediaSources: [extra, ...sources] },
      undefined,
      "prefer-direct",
      "bitrate",
    ).Id,
  ).toBe("bitrate");
  expect(
    chooseSource(
      { PlaySessionId: "session", MediaSources: [extra, ...sources] },
      undefined,
      "auto",
      "bitrate",
    ).Id,
  ).toBe("transcode");
});
it("falls back stably for missing or invalid metadata and handles no candidates", () => {
  const items = [
    { Id: "first", SupportsDirectPlay: true, Bitrate: NaN },
    { Id: "second", SupportsDirectPlay: true, Bitrate: -1 },
  ];
  expect(rankSources(items)[0].Id).toBe("first");
  expect(rankSources([])).toEqual([]);
  expect(() =>
    chooseSource({ PlaySessionId: "session", MediaSources: [] }),
  ).toThrow();
});
const api = () =>
  new EmbyClient({
    server: "https://fixture.test",
    userId: "u",
    name: "Fixture",
    deviceId: "d",
    token: "fictional",
  });
it.each([
  ["resolution", undefined, "resolution"],
  ["bitrate", undefined, "bitrate"],
  ["resolution", "bitrate", "bitrate"],
] as const)(
  "uses current policy %s and manual choice %s at the real negotiation boundary",
  async (policy, id, expected) => {
    const client = api();
    vi.spyOn(client, "request").mockResolvedValue({
      PlaySessionId: "session",
      MediaSources: sources,
    });
    const result = await preparePlayback(
      client,
      { Id: "movie", Name: "Fixture", Type: "Movie" },
      false,
      undefined,
      id,
      { ...defaults, sourcePreference: policy },
    );
    expect(result.sourceId).toBe(expected);
  },
);
it("forwards source-bound audio and subtitle off without losing explicit values", async () => {
  const client = api();
  const request = vi
    .spyOn(client, "request")
    .mockResolvedValue({ PlaySessionId: "session", MediaSources: sources });
  const result = await preparePlayback(
    client,
    { Id: "movie", Name: "Fixture", Type: "Movie", MediaSources: sources },
    false,
    undefined,
    "resolution",
    defaults,
    { sourceId: "resolution", audioIndex: 2, subtitleIndex: -1 },
  );
  expect(result.audioIndex).toBe(2);
  expect(result.subtitleIndex).toBe(-1);
  expect(request.mock.calls[0][2]).toMatchObject({
    MediaSourceId: "resolution",
    AudioStreamIndex: 2,
    SubtitleStreamIndex: -1,
  });
});
it("does not carry another source's track IDs into this source", async () => {
  const client = api();
  vi.spyOn(client, "request").mockResolvedValue({
    PlaySessionId: "session",
    MediaSources: [{ ...sources[0], DefaultAudioStreamIndex: 7 }],
  });
  const result = await preparePlayback(
    client,
    { Id: "movie-b", Name: "B", Type: "Movie" },
    false,
    undefined,
    "bitrate",
    defaults,
    { sourceId: "resolution", audioIndex: 2, subtitleIndex: 0 },
  );
  expect(result.audioIndex).toBe(7);
  expect(result.subtitleIndex).not.toBe(0);
});
it("reports a server-transcoded track mismatch rather than claiming the requested track was applied", async () => {
  const client = api();
  vi.spyOn(client, "request").mockResolvedValue({
    PlaySessionId: "s",
    MediaSources: [
      {
        ...sources[1],
        SupportsDirectPlay: false,
        SupportsTranscoding: true,
        TranscodingUrl: "/stream.m3u8?AudioStreamIndex=1",
      },
    ],
  });
  await expect(
    preparePlayback(
      client,
      { Id: "movie", Name: "Fixture", Type: "Movie" },
      false,
      undefined,
      "resolution",
      { ...defaults, compatibility: "auto" },
      { sourceId: "resolution", audioIndex: 2 },
    ),
  ).rejects.toMatchObject({ code: "track-selection-unavailable" });
});
