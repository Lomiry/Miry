// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import {
  defaultLibraries,
  readLibraryPreferences,
  saveLibraryPreferences,
  visibleLibraries,
  orderedLibraries,
} from "./libraryPreferences";
const views = ["a", "b", "c"].map((Id) => ({
  Id,
  Name: Id,
  Type: "CollectionFolder",
}));
beforeEach(() => localStorage.clear());
it("applies user ordering without dropping new or unrecognized libraries", () => {
  const prefs = { hidden: ["b"], order: ["c", "a", "gone"] };
  saveLibraryPreferences("first", prefs);
  expect(
    visibleLibraries(views, readLibraryPreferences("first")).map(
      (view) => view.Id,
    ),
  ).toEqual(["c", "a"]);
  expect(
    orderedLibraries(
      [...views, { Id: "new", Name: "New", Type: "CollectionFolder" }],
      prefs,
    ).map((view) => view.Id),
  ).toEqual(["c", "a", "b", "new"]);
  expect(views.map((view) => view.Id)).toEqual(["a", "b", "c"]);
  expect(readLibraryPreferences("other")).toEqual(defaultLibraries());
});
it("repairs malformed preferences and restores defaults", () => {
  localStorage.setItem(
    "miry-library-preferences",
    JSON.stringify({ demo: { hidden: ["a", "a", null], order: false } }),
  );
  expect(readLibraryPreferences("demo")).toEqual({ hidden: ["a"], order: [] });
  saveLibraryPreferences("demo", defaultLibraries());
  expect(visibleLibraries(views, readLibraryPreferences("demo"))).toEqual(
    views,
  );
  localStorage.setItem("miry-library-preferences", "null");
  expect(readLibraryPreferences("demo")).toEqual(defaultLibraries());
});
