// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { readBrowseLocation, saveBrowseLocation } from "./browseLocation";
const a = {
  server: "https://example.test",
  serverId: "s",
  userId: "u",
  name: "fixture",
  token: "synthetic-not-stored",
  deviceId: "d",
};
const state = {
  item: {
    Id: "movies",
    Name: "Movies",
    Type: "CollectionFolder",
    CollectionType: "movies",
  },
  filters: {
    genre: "Drama",
    year: "2024",
    rating: "7",
    type: "Movie",
    resolution: "",
  },
  sort: "CommunityRating",
  sortOrder: "Descending" as const,
  filter: "unplayed",
  mode: "infinite" as const,
};
beforeEach(() => sessionStorage.clear());
it("restores library/filter/order/mode for the exact account without persisting tokens, items or media URLs", () => {
  saveBrowseLocation(a, state);
  expect(readBrowseLocation(a)).toEqual(state);
  expect(sessionStorage.getItem("miry-browse-location-v1")).not.toContain(
    a.token,
  );
  expect(readBrowseLocation({ ...a, userId: "other" })).toBeUndefined();
  expect(
    readBrowseLocation({ ...a, server: "https://other.test" }),
  ).toBeUndefined();
  saveBrowseLocation(a);
  expect(readBrowseLocation(a)).toBeUndefined();
});
it.each(["null", "[]", "{broken", JSON.stringify({ version: 2 })])(
  "fails safely for invalid refresh data %s",
  (value) => {
    sessionStorage.setItem("miry-browse-location-v1", value);
    expect(readBrowseLocation(a)).toBeUndefined();
  },
);
