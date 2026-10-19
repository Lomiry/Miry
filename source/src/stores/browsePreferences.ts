import { librarySorts, type SortOrder } from "../api/library";
import type { Account } from "../types/emby";
import { connectionId } from "./connectionRemarks";

export const pageSizeOptions = [20, 30, 50, 100] as const;
export const defaultPageSize = 30;
export const minPageSize = 10;
export const maxPageSize = 200;
const key = "miry-browse-page-size";

export function validPageSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minPageSize &&
    value <= maxPageSize
  );
}
export function normalizePageSize(value: unknown): number {
  return validPageSize(value) ? value : defaultPageSize;
}
export function readPageSize(): number {
  try {
    return normalizePageSize(JSON.parse(localStorage.getItem(key) || "null"));
  } catch {
    return defaultPageSize;
  }
}
export function savePageSize(value: number) {
  if (!validPageSize(value)) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export interface SortPreference {
  sort: string;
  sortOrder: SortOrder;
}
const sortKey = "miry-browse-sort";
const defaultSort: SortPreference = {
  sort: "SortName",
  sortOrder: "Ascending",
};
function validSort(value: unknown): value is SortPreference {
  if (!value || typeof value !== "object") return false;
  const preference = value as SortPreference;
  return (
    librarySorts.some((option) => option.value === preference.sort) &&
    ["Ascending", "Descending"].includes(preference.sortOrder)
  );
}
function sortPreferences(): Record<string, SortPreference> {
  try {
    const data = JSON.parse(localStorage.getItem(sortKey) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data)
        .filter((entry): entry is [string, SortPreference] =>
          validSort(entry[1]),
        )
        .slice(-100),
    );
  } catch {
    return {};
  }
}
// One preference per connection/account, shared by ordinary libraries and catalogs.
// Recent catalogs and history snapshots are temporary views, not preference writes.
export function readSortPreference(account: Account | null): SortPreference {
  return {
    ...((account ? sortPreferences()[connectionId(account)] : undefined) ??
      defaultSort),
  };
}
export function saveSortPreference(
  account: Account | null,
  value: SortPreference,
) {
  if (!account || !validSort(value)) return;
  const preferences = sortPreferences();
  delete preferences[connectionId(account)];
  preferences[connectionId(account)] = {
    sort: value.sort,
    sortOrder: value.sortOrder,
  };
  localStorage.setItem(
    sortKey,
    JSON.stringify(Object.fromEntries(Object.entries(preferences).slice(-100))),
  );
}
