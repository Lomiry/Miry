// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { readPageSize, savePageSize, validPageSize } from "./browsePreferences";
import { readSortPreference, saveSortPreference } from "./browsePreferences";
import type { Account } from "../types/emby";
beforeEach(() => localStorage.clear());
it("defaults to 30 and reloads persisted custom preferences", () => {
  expect(readPageSize()).toBe(30);
  for (const size of [10, 20, 30, 50, 100, 73, 200]) {
    savePageSize(size);
    expect(readPageSize()).toBe(size);
  }
});
it.each([
  0,
  -1,
  9,
  201,
  30.5,
  NaN,
  Infinity,
  "50",
  null,
  {},
  Number.MAX_SAFE_INTEGER,
])("rejects invalid stored/API page size %s", (value) => {
  expect(validPageSize(value)).toBe(false);
  localStorage.setItem("miry-browse-page-size", JSON.stringify(value));
  expect(readPageSize()).toBe(30);
  savePageSize(value as number);
  expect(readPageSize()).toBe(30);
});
it("recovers corrupt persisted JSON", () => {
  localStorage.setItem("miry-browse-page-size", "{");
  expect(readPageSize()).toBe(30);
});

const account: Account = {
  server: "https://media.example.com/emby",
  userId: "qa",
  token: "fixture",
  deviceId: "qa",
  name: "QA",
};
it("persists unified sorting per account and stable home server without changing legacy page size", () => {
  savePageSize(73);
  saveSortPreference(account, { sort: "DateCreated", sortOrder: "Ascending" });
  expect(readSortPreference(account)).toEqual({
    sort: "DateCreated",
    sortOrder: "Ascending",
  });
  expect(readSortPreference({ ...account, userId: "another" }).sort).toBe(
    "SortName",
  );
  expect(
    readSortPreference({ ...account, server: "https://another.example.com" })
      .sort,
  ).toBe("SortName");
  expect(
    readSortPreference({
      ...account,
      homeServer: account.server,
      server: "https://backup.example.com",
    }).sort,
  ).toBe("DateCreated");
  expect(readPageSize()).toBe(73);
  saveSortPreference(null, {
    sort: "CommunityRating",
    sortOrder: "Descending",
  });
  expect(readSortPreference(null).sort).toBe("SortName");
});
it.each([
  "{",
  "null",
  "[]",
  '{"https://media.example.com/emby|qa":{"sort":"unknown","sortOrder":"Ascending"}}',
  '{"https://media.example.com/emby|qa":{"sort":"DateCreated","sortOrder":"wrong"}}',
])(
  "falls back from invalid sort preferences without erasing existing settings: %s",
  (raw) => {
    localStorage.setItem("miry-browse-sort", raw);
    localStorage.setItem("miry-settings", '{"volume":42}');
    expect(readSortPreference(account)).toEqual({
      sort: "SortName",
      sortOrder: "Ascending",
    });
    expect(localStorage.getItem("miry-settings")).toBe('{"volume":42}');
  },
);
