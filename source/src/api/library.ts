import type { Item } from "../types/emby";
import type { BrowseFilters } from "../components/LibraryFilters";

export type SortOrder = "Ascending" | "Descending";
export const librarySorts = [
  { value: "SortName", label: "名称" },
  { value: "DateCreated", label: "最近添加" },
  { value: "ProductionYear", label: "上映年份" },
  { value: "CommunityRating", label: "社区评分" },
  { value: "Runtime", label: "播放时长" },
  { value: "DatePlayed", label: "最近播放" },
  { value: "PlayCount", label: "播放次数" },
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
