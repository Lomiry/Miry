import { expect, it } from "vitest";
import { searchPresentation } from "./searchPresentation";
import type { SearchGroup } from "./aggregate";

const item = (Id: string) => ({ Id, Name: Id, Type: "Movie" });
const group = (patch: Partial<SearchGroup> = {}): SearchGroup => ({
  connection: {
    remember: false,
    account: {
      server: "https://fixture.test",
      userId: "u",
      name: "Fixture",
      deviceId: "d",
      token: "fictional",
    },
  },
  items: [],
  total: 0,
  totalKnown: true,
  hasMore: false,
  error: "",
  ...patch,
});
it("counts the displayed page rather than a missing or larger server total", () => {
  for (const total of [0, 500])
    expect(
      searchPresentation(group({ items: [item("one")], total })).displayed,
    ).toBe(1);
});
it("keeps suggestions separate and excludes duplicates without changing server pagination", () => {
  const source = group({
    items: [item("main")],
    total: 200,
    suggestions: [item("main"), item("other"), item("other")],
  });
  expect(searchPresentation(source)).toMatchObject({
    primary: 1,
    supplemental: 1,
    displayed: 2,
    suggestions: [item("other")],
  });
  expect(source.suggestions).toHaveLength(3);
  expect(source.total).toBe(200);
});
it("counts suggestion-only cards even when the main count is zero", () => {
  expect(
    searchPresentation(group({ suggestions: [item("other")] })),
  ).toMatchObject({ primary: 0, supplemental: 1, displayed: 1 });
});
it("does not count cards hidden by a group error", () => {
  expect(
    searchPresentation(
      group({
        error: "controlled",
        items: [item("stale")],
        suggestions: [item("old")],
      }),
    ).displayed,
  ).toBe(0);
});
