// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readSettings, saveSettings } from "./settings";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it("defaults old configs without rewriting their primary subtitle preferences", () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ subtitlePosition: 77, subtitleScale: 1.37 }),
  );
  const writes = vi.spyOn(Storage.prototype, "setItem");
  expect(readSettings()).toMatchObject({
    subtitlePosition: 77,
    subtitleScale: 1.37,
    secondarySubtitlePosition: 0,
    secondarySubtitleScale: 1,
  });
  expect(writes).not.toHaveBeenCalled();
});
it.each([
  [0, 0.5],
  [25, 1],
  [100, 2],
])(
  "persists secondary position %s and scale %s across startup independently",
  async (position, scale) => {
    saveSettings({
      ...readSettings(),
      subtitlePosition: 77,
      subtitleScale: 1.37,
      secondarySubtitlePosition: position,
      secondarySubtitleScale: scale,
    });
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.readSettings()).toMatchObject({
      subtitlePosition: 77,
      subtitleScale: 1.37,
      secondarySubtitlePosition: position,
      secondarySubtitleScale: scale,
    });
  },
);
it.each([
  [-5, 0.1, 0, 0.5],
  [150, 3, 100, 2],
  ["bad", null, 0, 1],
])(
  "normalizes secondary boundaries %s / %s",
  (position, scale, expectedPosition, expectedScale) => {
    localStorage.setItem(
      "miry-settings",
      JSON.stringify({
        secondarySubtitlePosition: position,
        secondarySubtitleScale: scale,
      }),
    );
    expect(readSettings()).toMatchObject({
      secondarySubtitlePosition: expectedPosition,
      secondarySubtitleScale: expectedScale,
    });
  },
);
