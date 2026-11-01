import type { Account, Item } from "../types/emby";
import type { BrowseFilters } from "../components/LibraryFilters";
import { connectionId } from "./connectionRemarks";
import { librarySorts, type SortOrder } from "../api/library";
import type { BrowseMode } from "./browsePreferences";
const key = "miry-browse-location-v1";
export interface BrowseLocation {
  item: Item;
  filters: BrowseFilters;
  sort: string;
  sortOrder: SortOrder;
  filter: string;
  mode: BrowseMode;
}
export function readBrowseLocation(
  account: Account | null,
): BrowseLocation | undefined {
  if (!account) return;
  try {
    const text = sessionStorage.getItem(key) || "";
    if (text.length > 8192) return;
    const v = JSON.parse(text);
    if (
      v.version !== 1 ||
      v.scope !== connectionId(account) ||
      typeof v.item?.Id !== "string" ||
      !v.item.Id ||
      v.item.Id.length > 128 ||
      typeof v.item.Name !== "string" ||
      v.item.Name.length > 200 ||
      v.item.Type !== "CollectionFolder" ||
      !librarySorts.some((s) => s.value === v.sort) ||
      !["Ascending", "Descending"].includes(v.sortOrder) ||
      !["all", "played", "unplayed"].includes(v.filter) ||
      !["pages", "infinite"].includes(v.mode)
    )
      return;
    if (
      !v.filters ||
      ["genre", "year", "rating", "type", "resolution"].some(
        (k) =>
          v.filters[k] !== undefined &&
          (typeof v.filters[k] !== "string" || v.filters[k].length > 200),
      )
    )
      return;
    return {
      item: {
        Id: v.item.Id,
        Name: v.item.Name,
        Type: "CollectionFolder",
        ...(typeof v.item.CollectionType === "string"
          ? { CollectionType: v.item.CollectionType }
          : {}),
      },
      filters: {
        genre: v.filters.genre || "",
        year: v.filters.year || "",
        rating: v.filters.rating || "",
        type: v.filters.type || "",
        resolution: v.filters.resolution || "",
      },
      sort: v.sort,
      sortOrder: v.sortOrder,
      filter: v.filter,
      mode: v.mode,
    };
  } catch {
    return;
  }
}
export function saveBrowseLocation(
  account: Account | null,
  value?: BrowseLocation,
) {
  try {
    if (!account || !value) {
      sessionStorage.removeItem(key);
      return;
    }
    // Persist navigation only: never the account/token, media URLs or loaded items.
    const { Id, Name, Type, CollectionType } = value.item;
    sessionStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        scope: connectionId(account),
        ...value,
        item: { Id, Name, Type, CollectionType },
      }),
    );
  } catch {
    /* Browsing remains available with denied/full session storage. */
  }
}
