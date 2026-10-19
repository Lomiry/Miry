import { expect, it } from "vitest";
import { pageInfo } from "./pagination";

const items = (count: number) =>
  Array.from({ length: count }, (_, n) => ({
    Id: String(n),
    Name: "Film",
    Type: "Movie",
  }));

it("keeps traversing full pages when a server always reports zero", () => {
  expect(pageInfo({ Items: items(30), TotalRecordCount: 0 }, 0, 30)).toEqual({
    total: 30,
    totalKnown: false,
    hasMore: true,
  });
  expect(pageInfo({ Items: items(2), TotalRecordCount: 0 }, 30, 30)).toEqual({
    total: 32,
    totalKnown: true,
    hasMore: false,
  });
});

it("handles exact page boundaries and genuinely empty results", () => {
  expect(pageInfo({ Items: [], TotalRecordCount: 0 }, 30, 30)).toEqual({
    total: 30,
    totalKnown: true,
    hasMore: false,
  });
  expect(pageInfo({ Items: [], TotalRecordCount: 0 }, 0, 30)).toEqual({
    total: 0,
    totalKnown: true,
    hasMore: false,
  });
});

it("preserves reliable totals and rejects inconsistent counts", () => {
  expect(pageInfo({ Items: items(30), TotalRecordCount: 80 }, 30, 30)).toEqual({
    total: 80,
    totalKnown: true,
    hasMore: true,
  });
  expect(
    pageInfo({ Items: items(20), TotalRecordCount: 80 }, 60, 30).hasMore,
  ).toBe(false);
  expect(
    pageInfo({ Items: items(30), TotalRecordCount: 5 }, 30, 30).totalKnown,
  ).toBe(false);
  expect(
    pageInfo(
      { Items: items(17), TotalRecordCount: undefined as unknown as number },
      0,
      30,
    ).total,
  ).toBe(17);
});
