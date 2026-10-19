import { expect, it } from "vitest";
import { presentationModel, type PlayerUiModel } from "./uiModel";
it("sends presentation data without media deliveries, raw network failures or account credentials", () => {
  const source = {
    Id: "v",
    Name: "原版",
    DirectStreamUrl: "https://host.test/video?api_key=secret",
    MediaStreams: [
      { Type: "Subtitle", DeliveryUrl: "https://host.test/sub?token=secret" },
    ],
  };
  const data = {
    revision: 1,
    theater: true,
    canHide: true,
    busy: false,
    error: "Failed https://host.test/path?api_key=secret",
    diagnosticFeedback: "",
    introSeconds: 90,
    outroSeconds: 60,
    previousDisabled: false,
    nextDisabled: false,
    capabilities: {
      return: true,
      previous: false,
      next: false,
      restart: true,
      versions: true,
    },
    routes: [],
    item: { Id: "m", Name: "影片", Type: "Movie", MediaSources: [source] },
    queue: {
      items: [{ Id: "q", Name: "队列", Type: "Movie", MediaSources: [source] }],
      index: 0,
      busy: false,
      autoNext: true,
    },
    state: {
      active: true,
      loaded: true,
      title: "影片",
      position: 10,
      duration: 100,
      paused: false,
      volume: 75,
      muted: false,
      tracks: [
        {
          id: 1,
          type: "sub",
          title: "中文字幕",
          selected: true,
          external: true,
          "external-filename": "https://host.test/sub?token=secret",
        },
      ],
      networkDetails: ["https://host.test"],
      error: "https://host.test/fail?api_key=secret",
      syncError: "",
      finished: false,
    },
  } as unknown as PlayerUiModel;
  const output = presentationModel(data);
  expect(JSON.stringify(output)).not.toMatch(
    /secret|host.test|DirectStreamUrl|DeliveryUrl|external-filename/,
  );
  expect(output.state.tracks[0]).toEqual({
    id: 1,
    type: "sub",
    title: "中文字幕",
    selected: true,
  });
  expect(output.item?.MediaSources?.[0].Id).toBe("v");
  expect(data.item?.MediaSources?.[0].DirectStreamUrl).toContain("secret");
});
