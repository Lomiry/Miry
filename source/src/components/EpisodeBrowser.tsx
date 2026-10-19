import Select from "./Select";
import { useEffect, useState } from "react";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import { demoChildren } from "../demo";
import EpisodeCard from "./EpisodeCard";
import { privateText } from "../privacy";
import { Info, Check, Play } from "lucide-react";
import IconButton from "./IconButton";
import { PlayButton } from "./PlayerPanel";
import type { StartPlayback } from "./QuickPlay";
import { mediaProgress } from "./MediaProgress";
import SectionHeader from "./SectionHeader";
import { plainOverview } from "./People";
import { pageInfo } from "../api/pagination";
import Pagination from "./Pagination";
import { EmptyState, ErrorState } from "./ContentState";

export default function EpisodeBrowser({
  api,
  parent,
  seasons,
  onPlay,
  onDetail,
  currentId,
  initialSeasonId,
  onSeasonChange,
  initialPage = 0,
  onPageChange,
  progressItems = [],
}: {
  api: EmbyClient | null;
  parent: Item;
  seasons: Item[];
  onPlay: StartPlayback;
  onDetail: (item: Item) => void;
  currentId?: string;
  initialSeasonId?: string;
  onSeasonChange?: (id: string) => void;
  initialPage?: number;
  onPageChange?: (season: string, page: number) => void;
  progressItems?: Item[];
}) {
  const [seasonId, setSeasonId] = useState(
    parent.Type === "Season"
      ? parent.Id
      : initialSeasonId || seasons[0]?.Id || "",
  );
  const [episodes, setEpisodes] = useState<Item[]>([]),
    [page, setPage] = useState(initialPage),
    [total, setTotal] = useState(0);
  const [totalKnown, setTotalKnown] = useState(true),
    [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [reservedRows, setReservedRows] = useState(6);
  useEffect(() => {
    if (
      parent.Type === "Series" &&
      seasons.length &&
      !seasons.some((season) => season.Id === seasonId)
    )
      setSeasonId(seasons[0].Id);
  }, [parent.Type, seasons, seasonId]);
  useEffect(() => {
    if (!seasonId) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setEpisodes([]);
    const selected = seasons.find((s) => s.Id === seasonId) || parent;
    const load = api
      ? api.items(
          {
            ParentId: seasonId,
            IncludeItemTypes: "Episode",
            IsMissing: false,
            IsVirtualItem: false,
            SortBy: "IndexNumber",
            Limit: 50,
            StartIndex: page * 50,
          },
          controller.signal,
        )
      : Promise.resolve({ Items: demoChildren(selected), TotalRecordCount: 6 });
    void load
      .then((result) => {
        if (!controller.signal.aborted) {
          setEpisodes(result.Items);
          setReservedRows(result.Items.length || 6);
          const info = pageInfo(result, page * 50, 50);
          setTotal(info.total);
          setTotalKnown(info.totalKnown);
          setHasMore(info.hasMore);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(privateText(e.message || "剧集加载失败。"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, parent.Id, seasonId, page, retry]);
  const visibleEpisodes = episodes.map((episode) => {
    const progressItem = progressItems.find((item) => item.Id === episode.Id);
    return progressItem
      ? {
          ...episode,
          UserData: { ...episode.UserData, ...progressItem.UserData },
        }
      : episode;
  });
  const continuing = visibleEpisodes.find(
    (ep) =>
      !ep.UserData?.Played && (ep.UserData?.PlaybackPositionTicks || 0) > 0,
  );
  const next =
    page === 0
      ? currentId && visibleEpisodes.some((ep) => ep.Id === currentId)
        ? visibleEpisodes
            .slice(visibleEpisodes.findIndex((ep) => ep.Id === currentId) + 1)
            .find((ep) => !ep.UserData?.Played)
        : continuing || visibleEpisodes.find((ep) => !ep.UserData?.Played)
      : continuing;
  return (
    <section className="episode-browser" aria-label="选集播放">
      <SectionHeader className="section-heading" title="选集播放">
        {parent.Type === "Series" && (
          <div className="season-selection">
            <label>
              季{" "}
              <Select
                aria-label="选择季"
                value={seasonId}
                onChange={(e) => {
                  setSeasonId(e.target.value);
                  setPage(0);
                  onSeasonChange?.(e.target.value);
                }}
              >
                {seasons.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </Select>
            </label>
            <IconButton
              label={`查看 ${seasons.find((s) => s.Id === seasonId)?.Name || "本季"}详情`}
              onClick={() => {
                const season = seasons.find((s) => s.Id === seasonId);
                if (season) onDetail(season);
              }}
            >
              <Info size={17} />
            </IconButton>
          </div>
        )}
      </SectionHeader>
      {busy ? (
        <div
          className="episode-list episode-skeleton"
          role="status"
          aria-label="正在加载剧集"
        >
          <span className="visually-hidden">正在加载剧集…</span>
          {Array.from({ length: reservedRows }, (_, i) => (
            <div className="episode-row" key={i} aria-hidden="true">
              <div className="episode-skeleton-thumb" />
              <div className="episode-skeleton-text">
                <span />
                <small />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="剧集暂时无法加载"
          message={error}
          onRetry={() => setRetry((n) => n + 1)}
        />
      ) : episodes.length ? (
        <div className="episode-list">
          {visibleEpisodes.map((ep) => {
            const current = currentId === ep.Id;
            const isNext = !current && next?.Id === ep.Id;
            const progress = mediaProgress(ep);
            return (
              <article
                className={`episode-row${current ? " is-current" : isNext ? " is-next" : ep.UserData?.Played ? " is-watched" : ""}`}
                key={ep.Id}
                aria-current={current ? "true" : undefined}
              >
                <button className="episode-open" onClick={() => onDetail(ep)}>
                  <div className="episode-thumb">
                    <EpisodeCard
                      item={ep}
                      url={
                        api
                          ? api.artworkImages(ep, "episode", 280)[0]
                          : undefined
                      }
                      fallbackUrls={api
                        ?.artworkImages(ep, "episode", 280)
                        .slice(1)}
                      landscape
                      caption={false}
                    />
                  </div>
                  <div className="episode-description">
                    <span className="episode-number">
                      第 {ep.IndexNumber ?? "?"} 集
                    </span>
                    <strong title={ep.Name}>{ep.Name}</strong>
                    <small>
                      {(current || isNext) && (
                        <span className="episode-status">
                          <Play size={12} />
                          {current
                            ? "正在播放"
                            : continuing?.Id === ep.Id
                              ? "继续观看"
                              : "下一集"}
                        </span>
                      )}
                      {ep.UserData?.Played ? (
                        <span className="episode-watched">
                          <Check size={12} />
                          已看
                        </span>
                      ) : progress > 0 ? (
                        `已看 ${Math.round(progress)}%`
                      ) : (
                        "未看"
                      )}
                      {ep.RunTimeTicks
                        ? ` · ${Math.round(ep.RunTimeTicks / 600000000)} 分钟`
                        : ""}
                    </small>
                    {ep.Overview && <p>{plainOverview(ep.Overview)}</p>}
                  </div>
                </button>
                <PlayButton
                  api={api}
                  item={ep}
                  concise
                  onStarted={() => {}}
                  onPlay={onPlay}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="暂时没有可播放的剧集"
          description="请选择其他季，或稍后刷新。"
        />
      )}
      {(page > 0 || hasMore) && (
        <Pagination
          page={page}
          pages={totalKnown ? Math.ceil(total / 50) : undefined}
          hasMore={hasMore}
          busy={busy}
          label="剧集翻页"
          onChange={(next) => {
            setPage(next);
            onPageChange?.(seasonId, next);
          }}
        />
      )}
    </section>
  );
}
