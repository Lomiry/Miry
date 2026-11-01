import { t } from "../i18n/core";
import type { Item } from "../types/emby";
import type { BrowseFilters } from "../components/LibraryFilters";

export type SortOrder = "Ascending" | "Descending";
export const librarySorts = [
  {
    value: "SortName",
    get label() {
      return t("library.name");
    },
  },
  {
    value: "DateCreated",
    get label() {
      return t("library.date_added");
    },
  },
  {
    value: "ProductionYear",
    get label() {
      return t("library.release_year");
    },
  },
  {
    value: "CommunityRating",
    get label() {
      return t("library.community_rating");
    },
  },
  {
    value: "Runtime",
    get label() {
      return t("library.duration");
    },
  },
  {
    value: "DatePlayed",
    get label() {
      return t("library.last_played");
    },
  },
  {
    value: "PlayCount",
    get label() {
      return t("library.play_count");
    },
  },
] as const;
export function defaultSortOrder(sort: string): SortOrder {
  return sort === "SortName" ? "Ascending" : "Descending";
}
export function sortQuery(sort: string, order: SortOrder) {
  return {
    // Emby supports comma-delimited sort fields. Preserve server ordering for ties.
    SortBy: sort === "SortName" ? sort : `${sort},SortName`,
    SortOrder: order,
  };
}

export function libraryQuery(
  library: Item | undefined,
  filters: BrowseFilters,
  sort: string,
  played: string,
  order: SortOrder = defaultSortOrder(sort),
) {
  const collection = library?.CollectionType?.toLowerCase();
  const mediaType =
    collection === "movies"
      ? "Movie"
      : collection === "tvshows"
        ? "Series"
        : collection === "playlists"
          ? "Playlist"
          : !library ||
              collection === "mixed" ||
              (library.Type === "CollectionFolder" && !collection)
            ? "Movie,Series"
            : undefined;
  return {
    ParentId: library?.Id,
    Recursive:
      mediaType || Object.values(filters).some(Boolean) ? true : undefined,
    IncludeItemTypes: filters.type || mediaType,
    ...sortQuery(sort, order),
    IsPlayed: played === "all" ? undefined : played === "played",
    Genres: filters.genre || undefined,
    Years: filters.year || undefined,
    MinCommunityRating: filters.rating || undefined,
    EnableTotalRecordCount: true,
    EnableUserData: true,
  };
}
