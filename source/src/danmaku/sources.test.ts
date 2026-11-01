// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import {
  normalizeSources,
  orderedSources,
  sourceDefaults,
  validEndpoint,
} from "./sources";
import { readSettings, saveSettings } from "../stores/settings";
import { normalizeDanmaku } from "./types";
beforeEach(() => localStorage.clear());
const custom = {
  id: "custom",
  name: "LogVar",
  protocol: "logvar" as const,
  endpoint: "https://danmaku.example.com/proxy",
  enabled: true,
  priority: 1,
};
it("preserves stage 0 defaults and the existing provider without writing new settings", () => {
  expect(normalizeSources(readSettings().danmaku?.sources)).toEqual(
    sourceDefaults,
  );
  expect(readSettings().danmaku).toMatchObject({
    area: 1,
    density: 48,
    deduplicate: false,
    blockLong: false,
  });
  expect(localStorage.length).toBe(0);
});
it("persists CRUD, mode, enablement and priority through existing settings", () => {
  let config = normalizeSources({
    mode: "auto",
    sources: [...sourceDefaults.sources, custom],
  });
  const save = () =>
    saveSettings({
      ...readSettings(),
      danmaku: normalizeDanmaku({ ...readSettings().danmaku, sources: config }),
    });
  save();
  expect(readSettings().danmaku?.sources).toEqual(config);
  config = normalizeSources({
    ...config,
    mode: "custom",
    sources: config.sources.map((s) =>
      s.id === "custom"
        ? { ...s, name: "Edited", priority: 0, enabled: false }
        : s,
    ),
  });
  save();
  expect(orderedSources(readSettings().danmaku!.sources!)).toEqual([]);
  expect(readSettings().danmaku?.sources?.sources[1].name).toBe("Edited");
  config = normalizeSources({
    mode: "custom",
    sources: sourceDefaults.sources,
  });
  save();
  expect(readSettings().danmaku?.sources?.mode).toBe("dandanplay");
});
it("bounds configurations, ignores unsupported protocols and strips extra secret fields", () => {
  const config = normalizeSources({
    sources: [
      custom,
      custom,
      { ...custom, id: "invalid", protocol: "unknown" as "logvar" },
      { ...custom, id: "second", token: "not-stored" } as typeof custom,
    ],
  });
  expect(config.sources.map((s) => s.id)).toEqual([
    "dandanplay",
    "custom",
    "second",
  ]);
  expect(JSON.stringify(config)).not.toContain("not-stored");
  expect(
    normalizeSources({
      sources: Array.from({ length: 40 }, (_, i) => ({
        ...custom,
        id: `x${i}`,
      })),
    }).sources.length,
  ).toBeLessThanOrEqual(12);
});
it.each([
  "http://remote.example.com",
  "https://user:pass@example.com",
  "https://example.com/?token=x",
  "https://example.com/#key",
  "file:///private",
  "https://example.com/api/v2",
  "https://example.com/\n",
  "https://example.com\\path",
])("rejects unsafe or ambiguous endpoint %s", (value) =>
  expect(validEndpoint(value)).toBe(false),
);
it.each([
  "https://example.com",
  "https://example.com/proxy/",
  "http://127.0.0.1:9321",
  "http://[::1]:9321",
])("accepts compatible base %s", (value) =>
  expect(validEndpoint(value)).toBe(true),
);
it("sorts only enabled sources in auto and obeys manual selection", () => {
  const config = normalizeSources({
    mode: "auto",
    sources: [{ ...sourceDefaults.sources[0], priority: 9 }, custom],
  });
  expect(orderedSources(config).map((s) => s.id)).toEqual([
    "custom",
    "dandanplay",
  ]);
  expect(
    orderedSources({ ...config, mode: "dandanplay" }).map((s) => s.id),
  ).toEqual(["dandanplay"]);
});
