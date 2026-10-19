import { expect, it, vi } from "vitest";
import { newerVersion, diagnostics } from "./desktop";
import { validRecovery } from "./recovery";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
it("compares stable versions without treating arbitrary release tags as updates", () => {
  expect(newerVersion("0.14.0", "0.13.3")).toBe(true);
  expect(newerVersion("0.13.3", "0.13.3")).toBe(false);
  expect(newerVersion("preview", "0.13.3")).toBe(false);
  expect(newerVersion("0.9.9", "0.13.3")).toBe(false);
});
it("validates local recovery age and positions separately from Continue Watching", () => {
  const r = {
    serverId: "s",
    itemId: "m",
    sourceId: "v",
    title: "QA",
    position: 10,
    timestamp: Date.now(),
    version: "0.13.3",
  };
  expect(validRecovery(r)).toEqual(r);
  expect(validRecovery({ ...r, position: NaN })).toBeUndefined();
  expect(
    validRecovery({ ...r, timestamp: Date.now() - 8 * 864e5 }),
  ).toBeUndefined();
  expect(validRecovery({ ...r, serverId: "" })).toBeUndefined();
});
it("exports a whitelist instead of track paths, titles or session authentication", () => {
  const d = diagnostics(undefined, {
    active: true,
    tracks: [{ "external-filename": "https://private.test/file" }],
    error: "Authorization: secret",
    syncError: "",
    title: "private",
    audioDevice: "private-id",
  } as never);
  const text = JSON.stringify(d);
  expect(text).not.toContain("private");
  expect(text).not.toContain("secret");
  expect(text).not.toContain("tracks");
});
