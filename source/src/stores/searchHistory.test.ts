// @vitest-environment jsdom
import { beforeEach, expect, it, vi, afterEach } from "vitest";
import {
  recordSearch,
  readSearchHistory,
  searchScope,
  searchSuggestions,
  saveSearchHistory,
} from "./searchHistory";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("isolates connections while retaining history across alternate routes", () => {
  const account = {
    server: "https://first.test/emby",
    userId: "u",
    name: "A",
    token: "secret",
    deviceId: "d",
  };
  recordSearch(searchScope(account), "  Star   Wars ");
  recordSearch(searchScope(account), "star wars");
  expect(
    readSearchHistory(
      searchScope({
        ...account,
        homeServer: account.server,
        server: "https://alternate.test/emby",
      }),
    ),
  ).toEqual(["star wars"]);
  expect(
    readSearchHistory(searchScope({ ...account, userId: "other" })),
  ).toEqual([]);
  expect(readSearchHistory("demo")).toEqual([]);
  expect(localStorage.getItem("miry-search-history")).not.toContain(
    account.token,
  );
});
it("limits stored terms, matches locally, and supports deletion and clearing", () => {
  for (let index = 0; index < 25; index++)
    recordSearch("demo", `片名 ${index}`);
  expect(readSearchHistory("demo")).toHaveLength(20);
  expect(searchSuggestions(readSearchHistory("demo"), "  片名 ")).toHaveLength(
    6,
  );
  recordSearch("demo", "Interstellar");
  expect(searchSuggestions(readSearchHistory("demo"), "STELL")).toEqual([
    "Interstellar",
  ]);
  expect(saveSearchHistory("demo", [])).toEqual([]);
  expect(readSearchHistory("demo")).toEqual([]);
});
it("ignores invalid data and still allows searches when storage is unavailable", () => {
  localStorage.setItem(
    "miry-search-history",
    JSON.stringify({ demo: [null, {}, "", "有效", "有效", "x".repeat(100)] }),
  );
  expect(readSearchHistory("demo")).toEqual(["有效", "x".repeat(80)]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(recordSearch("demo", "新关键词")[0]).toBe("新关键词");
});
