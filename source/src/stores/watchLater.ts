import type { Account, Item } from "../types/emby";
import { connectionId } from "./connections";
import type { EmbyClient } from "../api/client";
const key = (account: Account | null) =>
  "miry-later:" + (account ? connectionId(account) : "demo");
export function readLater(account: Account | null): Item[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) || "[]");
    return Array.isArray(raw)
      ? raw
          .filter(
            (i) => typeof i?.Id === "string" && typeof i.Name === "string",
          )
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function toggleLater(account: Account | null, item: Item) {
  const list = readLater(account),
    exists = list.some((i) => i.Id === item.Id);
  const safe: Item = {
    Id: item.Id,
    Name: item.Name,
    Type: item.Type,
    SeriesName: item.SeriesName,
    SeriesId: item.SeriesId,
    IndexNumber: item.IndexNumber,
    ParentIndexNumber: item.ParentIndexNumber,
    ImageTags: item.ImageTags,
    ProductionYear: item.ProductionYear,
    CommunityRating: item.CommunityRating,
    Genres: item.Genres,
    RunTimeTicks: item.RunTimeTicks,
  };
  const next = exists
    ? list.filter((i) => i.Id !== item.Id)
    : [safe, ...list].slice(0, 200);
  localStorage.setItem(key(account), JSON.stringify(next));
  return next;
}
export function clearLater(account: Account | null) {
  localStorage.removeItem(key(account));
}
export async function refreshLater(
  account: Account,
  api: EmbyClient,
  signal?: AbortSignal,
) {
  const saved = readLater(account);
  if (!saved.length) return saved;
  const page = await api.items(
    { Ids: saved.map((i) => i.Id).join(","), Limit: 200, EnableUserData: true },
    signal,
  );
  if (signal?.aborted) return saved;
  const incoming = new Map(page.Items.map((item) => [item.Id, item]));
  // Re-read membership after the request so concurrent saves/removals are retained.
  const latest = readLater(account);
  for (const item of latest) {
    const fresh = incoming.get(item.Id);
    if (fresh) {
      item.ProductionYear = fresh.ProductionYear;
      item.CommunityRating = fresh.CommunityRating;
      item.Genres = fresh.Genres;
    }
  }
  localStorage.setItem(key(account), JSON.stringify(latest));
  return latest;
}
