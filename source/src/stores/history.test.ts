// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  readHistory,
  recordHistory,
  clearHistory,
  patchHistoryArtwork,
  removeHistory,
} from "./history";
const account = {
  server: "https://a.test/emby",
  userId: "u",
  token: "secret",
  name: "A",
  deviceId: "d",
};
const item = {
  Id: "1",
  Name: "Movie",
  Type: "Movie",
  MediaSources: [
    { Id: "secret-source", Name: "https://media.test/?api_key=secret" },
  ],
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("isolates the same media ID across servers and users", () => {
  recordHistory(account, item, 40);
  recordHistory(
    { ...account, userId: "other" },
    { ...item, Name: "Other" },
    90,
  );
  expect(readHistory(account)[0].item.UserData?.PlaybackPositionTicks).toBe(
    400000000,
  );
  expect(readHistory({ ...account, server: "https://b.test/emby" })).toEqual(
    [],
  );
});
it("updates an existing entry without duplicate IDs and strips stream data", () => {
  recordHistory(account, item, 10);
  recordHistory(account, item, 20, true);
  expect(readHistory(account)).toHaveLength(1);
  expect(readHistory(account)[0].item.UserData).toMatchObject({
    Played: true,
    PlaybackPositionTicks: 0,
  });
  expect(JSON.stringify(readHistory(account))).not.toContain("secret");
});
it("bounds history and allows clearing only this account", () => {
  for (let i = 0; i < 105; i++)
    recordHistory(account, { ...item, Id: String(i) });
  expect(readHistory(account)).toHaveLength(100);
  expect(readHistory(account)[0].item.Id).toBe("104");
  recordHistory({ ...account, userId: "other" }, item);
  clearHistory(account);
  expect(readHistory(account)).toEqual([]);
  expect(readHistory({ ...account, userId: "other" })).toHaveLength(1);
});
it("does not break active playback when local storage is full", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Quota", "QuotaExceededError");
  });
  expect(() => recordHistory(account, item, 30)).not.toThrow();
});
it("retains series artwork and patches old covers without changing progress or time", () => {
  const original = recordHistory(
    account,
    { ...item, SeriesId: "series", SeriesPrimaryImageTag: "poster" },
    40,
  )[0];
  expect(original.item.SeriesPrimaryImageTag).toBe("poster");
  patchHistoryArtwork(account, {
    ...item,
    BackdropImageTags: ["wide"],
    UserData: { PlaybackPositionTicks: 0 },
  });
  expect(readHistory(account)[0]).toMatchObject({
    at: original.at,
    item: {
      BackdropImageTags: ["wide"],
      SeriesPrimaryImageTag: "poster",
      UserData: { PlaybackPositionTicks: 400000000 },
    },
  });
  expect(JSON.stringify(readHistory(account))).not.toContain("secret");
});
it("does not restore deleted records when background artwork requests finish", () => {
  recordHistory(account, item);
  recordHistory({ ...account, userId: "other" }, item);
  removeHistory(account, item.Id);
  patchHistoryArtwork(account, { ...item, BackdropImageTags: ["wide"] });
  expect(readHistory(account)).toEqual([]);
  expect(readHistory({ ...account, userId: "other" })).toHaveLength(1);
});
