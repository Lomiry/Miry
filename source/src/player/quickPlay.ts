import { ApiError, type EmbyClient } from "../api/client";
import type { Item } from "../types/emby";

export function episodeLabel(item: Item) {
  return `${item.ParentIndexNumber !== undefined ? `第 ${item.ParentIndexNumber} 季 · ` : ""}${item.IndexNumber !== undefined ? `第 ${item.IndexNumber} 集 · ` : ""}${item.Name}`;
}
const playable = (item: Item) =>
  item.Type === "Episode" && !item.IsMissing && !item.IsVirtual;
// Resolve through bounded server queries; never download the entire show to find one episode.
export async function resolveQuickPlay(
  api: EmbyClient,
  item: Item,
  signal: AbortSignal,
): Promise<Item> {
  if (!["Series", "Season"].includes(item.Type)) return item;
  const query = {
    ParentId: item.Id,
    Recursive: true,
    IncludeItemTypes: "Episode",
    IsMissing: false,
    IsVirtualItem: false,
    Fields: "Overview,ParentId",
    Limit: 1,
  };
  const optional = async (request: Promise<{ Items: Item[] }>) => {
    try {
      return (await request).Items.find(playable);
    } catch (e) {
      if (
        signal.aborted ||
        !(e instanceof ApiError) ||
        ![400, 404, 405].includes(e.status)
      )
        throw e;
      return undefined;
    }
  };
  const resumed = await optional(
    api.request(
      "/Users/" + api.account.userId + "/Items/Resume",
      { ...query, MediaTypes: "Video" },
      undefined,
      signal,
    ),
  );
  if (
    resumed &&
    !resumed.UserData?.Played &&
    (resumed.UserData?.PlaybackPositionTicks || 0) > 0
  )
    return resumed;
  if (item.Type === "Series") {
    const next = await optional(api.nextUp(item.Id, signal));
    if (next && (!next.SeriesId || next.SeriesId === item.Id)) return next;
  }
  const unplayed = (
    await api.items(
      {
        ...query,
        IsPlayed: false,
        SortBy: "ParentIndexNumber,IndexNumber",
        SortOrder: "Ascending",
      },
      signal,
    )
  ).Items.find(playable);
  if (unplayed) return unplayed;
  const first = (
    await api.items(
      {
        ...query,
        SortBy: "ParentIndexNumber,IndexNumber",
        SortOrder: "Ascending",
      },
      signal,
    )
  ).Items.find(playable);
  if (!first) throw new Error("暂时没有可播放的剧集，请刷新或选择其他季。");
  return first;
}
