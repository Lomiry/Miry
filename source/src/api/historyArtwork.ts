import type { EmbyClient } from "./client";
import type { Account } from "../types/emby";
import {
  readHistory,
  patchHistoryArtwork,
  type WatchedEntry,
} from "../stores/history";

// Old records load immediately. Recover artwork in the background with at most three requests.
export async function recoverHistoryArtwork(
  api: EmbyClient,
  account: Account,
  signal: AbortSignal,
  update: (entries: WatchedEntry[]) => void,
) {
  const pending = readHistory(account).filter((e) => {
    if (Date.now() - (e.artworkCheckedAt || 0) < 86400000) return false;
    const i = e.item;
    return i.Type === "Movie"
      ? !i.BackdropImageTags?.length && !i.ImageTags?.Thumb
      : !i.ImageTags?.Primary &&
          !i.ImageTags?.Thumb &&
          !i.SeriesPrimaryImageTag &&
          !i.ParentThumbImageTag &&
          !i.SeriesThumbImageTag;
  });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (!signal.aborted && next < pending.length) {
        const entry = pending[next++];
        try {
          const fresh = await api.item(entry.item.Id, signal);
          if (signal.aborted) return;
          update(patchHistoryArtwork(account, fresh));
        } catch {
          /* A missing item or offline server must not block the history list. */
        }
      }
    }),
  );
}
