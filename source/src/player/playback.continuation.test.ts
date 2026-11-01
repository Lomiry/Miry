import { expect, it } from "vitest";
import {
  continuationSettings,
  preferredStream,
  type PlayerSnapshot,
} from "./playback";
import { defaults } from "../stores/settings";
it("inherits language policy and subtitle off without reusing old media track IDs", () => {
  const snapshot = {
    tracks: [
      { id: 50, type: "audio", selected: true, lang: "jpn" },
      { id: 99, type: "sub", selected: true, lang: "eng" },
    ],
  } as PlayerSnapshot;
  const next = continuationSettings(defaults, snapshot);
  const source = {
    Id: "new",
    MediaStreams: [
      { Type: "Audio", Index: 3, Language: "ja" },
      { Type: "Subtitle", Index: 7, Language: "en" },
    ],
  };
  expect(preferredStream(source, "Audio", next.audioLanguage)).toBe(3);
  expect(preferredStream(source, "Subtitle", next.subtitleLanguage)).toBe(7);
  snapshot.tracks[1].selected = false;
  expect(continuationSettings(defaults, snapshot).subtitleLanguage).toBe("off");
  expect(defaults.subtitleLanguage).toBe("auto");
});
