import type { Account, Item } from "../types/emby";
import { connectionId } from "./connections";
export interface WatchedEntry {
  item: Item;
  at: number;
  artworkCheckedAt?: number;
}
const artworkKeys = [
  "ImageTags",
  "BackdropImageTags",
  "SeriesPrimaryImageTag",
  "SeriesThumbImageTag",
  "ParentThumbItemId",
  "ParentThumbImageTag",
  "ParentBackdropItemId",
  "ParentBackdropImageTags",
  "SeriesId",
] as const;
export function historyArtwork(item: Item): Partial<Item> {
  return Object.fromEntries(
    artworkKeys.filter((k) => item[k] !== undefined).map((k) => [k, item[k]]),
  );
}
const key = (account: Account) => "miry-history:" + connectionId(account);
function write(account: Account, list: WatchedEntry[]) {
  try {
    localStorage.setItem(key(account), JSON.stringify(list));
  } catch {
    /* Playback stays available. */
  }
  return list;
}
export function removeHistory(account: Account, id: string) {
  return write(
    account,
    readHistory(account).filter((e) => e.item.Id !== id),
  );
}
export function patchHistoryArtwork(account: Account, item: Item) {
  return write(
    account,
    readHistory(account).map((e) =>
      e.item.Id === item.Id
        ? {
            ...e,
            item: { ...e.item, ...historyArtwork(item) },
            artworkCheckedAt: Date.now(),
          }
        : e,
    ),
  );
}
export function readHistory(account: Account | null): WatchedEntry[] {
  if (!account) return [];
  try {
    const data = JSON.parse(localStorage.getItem(key(account)) || "[]");
    return Array.isArray(data)
      ? data
          .filter((e) => e?.item?.Id && typeof e.at === "number")
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function recordHistory(
  account: Account,
  item: Item,
  position?: number,
  finished = false,
) {
  // Only display metadata is retained, never media URLs, authentication or stream sources.
  const safe: Item = {
    Id: item.Id,
    Name: item.Name,
    Type: item.Type,
    SeriesId: item.SeriesId,
    SeriesName: item.SeriesName,
    ParentId: item.ParentId,
    IndexNumber: item.IndexNumber,
    ParentIndexNumber: item.ParentIndexNumber,
    ProductionYear: item.ProductionYear,
    ...historyArtwork(item),
    RunTimeTicks: item.RunTimeTicks,
    UserData: {
      ...item.UserData,
      ...(position !== undefined
        ? {
            PlaybackPositionTicks: Math.round(Math.max(0, position) * 10000000),
          }
        : {}),
      ...(finished ? { Played: true, PlaybackPositionTicks: 0 } : {}),
    },
  };
  const list = [
    { item: safe, at: Date.now() },
    ...readHistory(account).filter((e) => e.item.Id !== item.Id),
  ].slice(0, 100);
  return write(account, list);
}
export function clearHistory(account: Account) {
  localStorage.removeItem(key(account));
}
