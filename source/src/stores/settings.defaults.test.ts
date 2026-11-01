// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { readSettings, saveSettings } from "./settings";
import { readAppearance, saveAppearance } from "./appearance";

afterEach(() => localStorage.clear());

it("uses stage 0 defaults for a new user without writing preferences", () => {
  expect(readAppearance()).toMatchObject({
    theme: "system",
    uiSize: "standard",
  });
  expect(readSettings()).toMatchObject({
    volume: 100,
    fullscreen: false,
    danmaku: { area: 1, density: 48, deduplicate: false, blockLong: false },
  });
  expect(localStorage.length).toBe(0);
});

it.each([undefined, null])(
  "fills missing/null fields (%s) without losing valid siblings",
  (missing) => {
    localStorage.setItem(
      "miry-appearance",
      JSON.stringify({
        theme: missing,
        uiSize: "large",
        sidebarCollapsed: false,
      }),
    );
    localStorage.setItem(
      "miry-settings",
      JSON.stringify({
        volume: missing,
        autoNext: false,
        danmaku: {
          speedSchema: 2,
          area: missing,
          density: missing,
          deduplicate: missing,
          blockLong: missing,
          opacity: 0,
        },
      }),
    );
    expect(readAppearance()).toEqual({
      theme: "system",
      uiSize: "large",
      sidebarCollapsed: false,
    });
    expect(readSettings()).toMatchObject({
      volume: 100,
      autoNext: false,
      danmaku: {
        area: 1,
        density: 48,
        deduplicate: false,
        blockLong: false,
        opacity: 0,
      },
    });
  },
);

it.each(["miry-settings", "miry-appearance"])(
  "accepts a null %s object as unconfigured",
  (key) => {
    localStorage.setItem(key, "null");
    expect(readSettings().volume).toBe(100);
    expect(readSettings().danmaku).toMatchObject({
      area: 1,
      deduplicate: false,
      blockLong: false,
    });
    expect(readAppearance()).toMatchObject({
      theme: "system",
      uiSize: "standard",
    });
    expect(localStorage.getItem(key)).toBe("null");
  },
);

it.each([true, false])(
  "preserves explicit %s filters, zero volume and saved appearance through reload",
  (filter) => {
    const appearance = {
      theme: "dark",
      uiSize: "larger",
      sidebarCollapsed: false,
    } as const;
    const settings = {
      volume: 0,
      autoNext: false,
      systemMedia: false,
      danmaku: {
        speedSchema: 2,
        speed: 1.5,
        area: 0.5,
        density: 24,
        deduplicate: filter,
        blockLong: filter,
        enabled: false,
        onlineEnabled: false,
        autoMatch: false,
        opacity: 0,
        offset: 0,
      },
    };
    const stored = JSON.stringify(settings);
    localStorage.setItem("miry-appearance", JSON.stringify(appearance));
    localStorage.setItem("miry-settings", stored);
    expect(readSettings()).toMatchObject(settings);
    expect(readAppearance()).toEqual(appearance);
    expect(localStorage.getItem("miry-settings")).toBe(stored);
    saveSettings(readSettings());
    saveAppearance(readAppearance());
    expect(readSettings()).toMatchObject(settings);
    expect(readAppearance()).toEqual(appearance);
    const saved = localStorage.getItem("miry-settings");
    saveSettings(readSettings());
    expect(localStorage.getItem("miry-settings")).toBe(saved);
  },
);

it("fills partial legacy settings once while retaining old area and enabled filters", () => {
  localStorage.setItem("miry-appearance", JSON.stringify({ theme: "light" }));
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({
      autoNext: false,
      danmaku: { speed: 0.75, area: 0.75, deduplicate: true, opacity: 0 },
    }),
  );
  const expected = {
    volume: 100,
    autoNext: false,
    danmaku: {
      speedSchema: 2,
      speed: 1.5,
      area: 0.75,
      density: 48,
      deduplicate: true,
      blockLong: false,
      opacity: 0,
    },
  };
  expect(readSettings()).toMatchObject(expected);
  expect(readAppearance()).toMatchObject({
    theme: "light",
    uiSize: "standard",
  });
  const migrated = localStorage.getItem("miry-settings");
  expect(readSettings()).toMatchObject(expected);
  expect(localStorage.getItem("miry-settings")).toBe(migrated);
  saveSettings(readSettings());
  expect(readSettings()).toMatchObject(expected);
});
