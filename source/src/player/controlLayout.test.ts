// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  controlPresets,
  normalizeControlLayout,
  visibleControls,
} from "./controlLayout";
import { readSettings, saveSettings } from "../stores/settings";
afterEach(() => localStorage.clear());
it.each([undefined, null, false, 0, {}, { preset: "other", buttons: null }])(
  "defaults invalid layout %j to standard without migration",
  (raw) => {
    localStorage.setItem(
      "miry-settings",
      JSON.stringify({ controlLayout: raw, volume: 0, autoNext: false }),
    );
    const before = localStorage.getItem("miry-settings");
    expect(visibleControls(readSettings().controlLayout)).toEqual(
      controlPresets.standard,
    );
    expect(readSettings()).toMatchObject({ volume: 0, autoNext: false });
    expect(localStorage.getItem("miry-settings")).toBe(before);
  },
);
it.each(["minimal", "standard", "full"] as const)(
  "resolves %s independently of custom data",
  (preset) => {
    expect(visibleControls({ preset, buttons: [] })).toEqual(
      controlPresets[preset],
    );
  },
);
it("keeps custom order, an empty custom toolbar, and preferences across reload", () => {
  const settings = readSettings();
  settings.controlLayout = normalizeControlLayout({
    preset: "custom",
    buttons: ["speed", "volume", "speed", "unknown", false],
  });
  saveSettings(settings);
  expect(visibleControls(readSettings().controlLayout)).toEqual([
    "speed",
    "volume",
  ]);
  saveSettings({
    ...settings,
    controlLayout: { preset: "custom", buttons: [] },
  });
  expect(visibleControls(readSettings().controlLayout)).toEqual([]);
});
