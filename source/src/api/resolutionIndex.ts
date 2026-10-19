import type { EmbyClient } from "./client";
import type { Item, ItemPage } from "../types/emby";
import { playbackResolution } from "../player/resolution";
import { normalizePageSize } from "../stores/browsePreferences";
type Query = Record<string, string | number | boolean | undefined>;
export function itemResolutions(item: Item): Set<string> {
  const streams = [
    ...(item.MediaStreams || []),
    ...(item.MediaSources || [])
      .filter(
        (s) =>
          s.SupportsDirectPlay !== false ||
          s.SupportsDirectStream ||
          s.SupportsTranscoding,
      )
      .flatMap((s) => s.MediaStreams || []),
  ];
  return new Set(
    streams
      .filter(
        (s) =>
          s.Type === "Video" &&
          Number.isFinite(s.Width) &&
          Number.isFinite(s.Height) &&
          s.Width! > 0 &&
          s.Height! > 0,
      )
      .map((s) => {
        const label = playbackResolution({ w: s.Width, h: s.Height });
        return label === "8K"
          ? "4K"
          : label === "4K" || label === "1080p" || label === "720p"
            ? label
            : "SD";
      }),
  );
}
interface Entry {
  at: number;
  revision: number;
  ids: Map<string, string[]>;
}
export class ResolutionIndex {
  private cache = new Map<string, Entry>();
  clear() {
    this.cache.clear();
  }
  async page(
    api: EmbyClient,
    query: Query,
    resolution: string,
    page: number,
    signal: AbortSignal,
    requestedPageSize = 30,
  ): Promise<ItemPage> {
    const pageSize = normalizePageSize(requestedPageSize);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const { StartIndex: _start, Limit: _limit, ...base } = query;
    const key = JSON.stringify([api.account.server, api.account.userId, base]);
    let entry = this.cache.get(key);
    if (
      !entry ||
      Date.now() - entry.at > 300000 ||
      entry.revision !== api.cache.revision
    ) {
      const matches = new Map<string, Set<string>>(),
        seen = new Set<string>(),
        series = new Set<string>();
      const add = (id: string, labels: Set<string>) => {
        for (const label of labels) {
          const list = matches.get(label) || new Set<string>();
          list.add(id);
          matches.set(label, list);
        }
      };
      let scanned = 0;
      const scan = async (q: Query, visit: (item: Item) => void) => {
        let offset = 0;
        while (true) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          const data = await api.items(
            {
              ...q,
              StartIndex: offset,
              Limit: 1000,
              Fields: "MediaSources,MediaStreams,SeriesId",
              EnableImages: false,
              EnableUserData: false,
              EnableTotalRecordCount: true,
            },
            signal,
          );
          scanned += data.Items.length;
          if (scanned > 50000)
            throw Error("媒体库超过清晰度索引范围，请选择更小的媒体库后重试。");
          for (const item of data.Items) visit(item);
          offset += data.Items.length;
          if (
            Number.isFinite(data.TotalRecordCount)
              ? offset >= data.TotalRecordCount
              : data.Items.length < 1000
          )
            break;
          if (!data.Items.length)
            throw Error("清晰度元数据分页不完整，请重试。");
        }
      };
      const order: string[] = [];
      await scan(base, (item) => {
        if (seen.has(item.Id)) return;
        seen.add(item.Id);
        order.push(item.Id);
        if (item.Type === "Series") series.add(item.Id);
        add(item.Id, itemResolutions(item));
      });
      if (series.size)
        await scan(
          {
            ParentId: base.ParentId,
            Recursive: true,
            IncludeItemTypes: "Episode",
            SortBy: "SortName",
          },
          (item) => {
            if (item.SeriesId && series.has(item.SeriesId))
              add(item.SeriesId, itemResolutions(item));
          },
        );
      const ranks = new Map(order.map((id, n) => [id, n]));
      const ids = new Map(
        [...matches].map(([label, set]) => [
          label,
          [...set].sort((a, b) => ranks.get(a)! - ranks.get(b)!),
        ]),
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      entry = { at: Date.now(), revision: api.cache.revision, ids };
      this.cache.delete(key);
      this.cache.set(key, entry);
      while (this.cache.size > 3)
        this.cache.delete(this.cache.keys().next().value!);
    }
    const all = entry.ids.get(resolution) || [],
      selected = all.slice(page * pageSize, (page + 1) * pageSize);
    if (!selected.length) return { Items: [], TotalRecordCount: all.length };
    const data = await api.items(
      {
        Ids: selected.join(","),
        Limit: pageSize,
        EnableTotalRecordCount: false,
      },
      signal,
    );
    const byId = new Map(data.Items.map((item) => [item.Id, item]));
    if (selected.some((id) => !byId.has(id))) {
      this.cache.delete(key);
      throw Error("媒体库已变化，请刷新清晰度筛选。");
    }
    return {
      Items: selected.map((id) => byId.get(id)!),
      TotalRecordCount: all.length,
    };
  }
}
