import { expect, it } from "vitest";
import { libraryQuery, librarySorts } from "./library";
import { emptyFilters } from "../components/LibraryFilters";

it("includes nested movies and series using collection metadata, regardless of library name", () => {
  for (const [CollectionType, IncludeItemTypes] of [
    ["movies", "Movie"],
    ["tvshows", "Series"],
  ]) {
    expect(
      libraryQuery(
        {
          Id: "library",
          Name: "Archive",
          Type: "CollectionFolder",
          CollectionType,
        },
        emptyFilters,
        "SortName",
        "all",
      ),
    ).toMatchObject({
      ParentId: "library",
      Recursive: true,
      IncludeItemTypes,
      EnableTotalRecordCount: true,
      EnableUserData: true,
    });
  }
});
it("keeps folder navigation and existing playlists read-only while browsing untyped video libraries recursively", () => {
  expect(
    libraryQuery(
      { Id: "folder", Name: "Folder", Type: "Folder" },
      emptyFilters,
      "SortName",
      "all",
    ).Recursive,
  ).toBeUndefined();
  expect(
    libraryQuery(
      { Id: "video", Name: "Video", Type: "CollectionFolder" },
      emptyFilters,
      "SortName",
      "all",
    ).IncludeItemTypes,
  ).toBe("Movie,Series");
  expect(
    libraryQuery(
      {
        Id: "lists",
        Name: "Lists",
        Type: "CollectionFolder",
        CollectionType: "playlists",
      },
      emptyFilters,
      "SortName",
      "all",
    ).IncludeItemTypes,
  ).toBe("Playlist");
});
it("applies catalog filters without restricting the query to a single parent", () => {
  expect(
    libraryQuery(
      undefined,
      { type: "Movie", genre: "Drama", year: "2024", rating: "8" },
      "DateCreated",
      "unplayed",
    ),
  ).toEqual({
    ParentId: undefined,
    Recursive: true,
    IncludeItemTypes: "Movie",
    SortBy: "DateCreated,SortName",
    SortOrder: "Descending",
    IsPlayed: false,
    Genres: "Drama",
    Years: "2024",
    MinCommunityRating: "8",
    EnableTotalRecordCount: true,
    EnableUserData: true,
  });
});

it.each(librarySorts)(
  "sends both directions and a secondary name order for $value",
  ({ value }) => {
    for (const order of ["Ascending", "Descending"] as const) {
      expect(
        libraryQuery(undefined, emptyFilters, value, "all", order),
      ).toMatchObject({
        SortBy: value === "SortName" ? value : `${value},SortName`,
        SortOrder: order,
      });
    }
  },
);
