// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { defaults, readSettings, saveSettings } from "./settings";
afterEach(() => localStorage.clear());
it("ignores the legacy update opt-out and preserves other preferences", () => {
  const legacy = JSON.stringify({ volume: 42, autoCheckUpdates: false });
  localStorage.setItem("miry-settings", legacy);
  expect(readSettings().volume).toBe(42);
  expect(readSettings()).not.toHaveProperty("autoCheckUpdates");
  expect(defaults).not.toHaveProperty("autoCheckUpdates");
  expect(localStorage.getItem("miry-settings")).toBe(legacy);
  saveSettings(readSettings());
  expect(readSettings().volume).toBe(42);
});
it.each([undefined, null, "unknown", "FILL", 1, {}, []])(
  "falls back to fit for legacy/invalid video fit %j without changing speed schema2",
  (videoFit) => {
    localStorage.setItem(
      "miry-settings",
      JSON.stringify({
        ...defaults,
        videoFit,
        danmaku: { ...defaults.danmaku, speedSchema: 2, speed: 3 },
      }),
    );
    expect(readSettings().videoFit).toBe("fit");
    expect(readSettings().danmaku?.speed).toBe(3);
  },
);
it.each(["fit", "fill", "stretch"] as const)(
  "restores video mode %s after settings reload",
  (videoFit) => {
    saveSettings({
      ...defaults,
      videoFit,
      subtitleScale: 1.3,
      subtitlePosition: 72,
    });
    expect(readSettings()).toMatchObject({
      videoFit,
      subtitleScale: 1.3,
      subtitlePosition: 72,
    });
  },
);
it.each([
  [0.5, 1],
  [0.75, 1.5],
  [1, 2],
  [1.5, 3],
  [2, 4],
  [-1, 1],
  [null, 1],
  ["bad", 1],
])(
  "migrates legacy speed %s to %s once, preserving other preferences",
  (old, expected) => {
    localStorage.setItem(
      "miry-settings",
      JSON.stringify({ volume: 42, danmaku: { speed: old, opacity: 0.7 } }),
    );
    expect(readSettings().danmaku).toMatchObject({
      speed: expected,
      speedSchema: 2,
      opacity: 0.7,
    });
    const migrated = localStorage.getItem("miry-settings");
    expect(readSettings().danmaku?.speed).toBe(expected);
    expect(localStorage.getItem("miry-settings")).toBe(migrated);
    expect(readSettings().volume).toBe(42);
  },
);
it("uses new default 1 and preserves schema 2 speed without repeated doubling", () => {
  expect(readSettings().danmaku?.speed).toBe(1);
  saveSettings({ ...defaults, danmaku: { ...defaults.danmaku!, speed: 1.5 } });
  expect(readSettings().danmaku?.speed).toBe(1.5);
});
it("removes an obsolete custom release source while preserving user settings", () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({
      ...defaults,
      volume: 42,
      releaseEndpoint: "https://old.test/latest",
    }),
  );
  expect(readSettings().volume).toBe(42);
  expect(readSettings()).not.toHaveProperty("releaseEndpoint");
  expect(JSON.parse(localStorage.getItem("miry-settings")!)).not.toHaveProperty(
    "releaseEndpoint",
  );
  saveSettings({
    ...defaults,
    releaseEndpoint: "https://old.test/latest",
  } as typeof defaults);
  expect(JSON.parse(localStorage.getItem("miry-settings")!)).not.toHaveProperty(
    "releaseEndpoint",
  );
});
it("discards the retired display policy while preserving current preferences", () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ ...defaults, volume: 42, refreshRateMatch: "playback" }),
  );
  expect(readSettings().volume).toBe(42);
  expect(readSettings()).not.toHaveProperty("refreshRateMatch");
  expect(JSON.parse(localStorage.getItem("miry-settings")!)).not.toHaveProperty(
    "refreshRateMatch",
  );
  saveSettings({
    ...defaults,
    refreshRateMatch: "fullscreen",
  } as typeof defaults);
  expect(JSON.parse(localStorage.getItem("miry-settings")!)).not.toHaveProperty(
    "refreshRateMatch",
  );
});
it("persists preferences without account credentials", () => {
  saveSettings({
    ...defaults,
    autoNext: false,
    subtitleLanguage: "off",
    volume: 40,
  });
  expect(readSettings()).toMatchObject({
    autoNext: false,
    subtitleLanguage: "off",
    volume: 40,
  });
  saveSettings({ ...defaults, subtitlePosition: 72, subtitleScale: 1.37 });
  expect(readSettings().subtitlePosition).toBe(72);
  expect(readSettings().subtitleScale).toBe(1.37);
  expect(localStorage.getItem("miry-settings")).not.toContain("token");
});
it("recovers from malformed or out of range preferences", () => {
  localStorage.setItem("miry-settings", "bad json");
  expect(readSettings()).toEqual(defaults);
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ volume: 400, audioLanguage: "injected", autoNext: "yes" }),
  );
  expect(readSettings()).toMatchObject({
    volume: 100,
    audioLanguage: "auto",
    autoNext: true,
    subtitlePosition: 100,
  });
});
