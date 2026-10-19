import { Film, Tv, ChevronRight, Info } from "lucide-react";
import type { Item, UserData } from "../types/emby";
import type { EmbyClient } from "../api/client";
import { Artwork } from "./Artwork";
import PosterFallback from "./PosterFallback";
import { plainOverview } from "./People";
import QuickPlay, { type StartPlayback } from "./QuickPlay";
import MediaCard from "./MediaCard";
import MediaShelf from "./MediaShelf";
import MediaMeta from "./MediaMeta";
import { EmptyState } from "./ContentState";
import type { Recommendation } from "../api/homeRecommendations";
export function recommendationMeta(item: Item) {
  return [
    item.ProductionYear,
    item.Type === "Movie"
      ? "电影"
      : item.Type === "Series"
        ? "剧集"
        : undefined,
    typeof item.CommunityRating === "number" && item.CommunityRating > 0
      ? item.CommunityRating.toFixed(1)
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function HomeView({
  items,
  views,
  resume,
  nextUp,
  api,
  later,
  onPlay,
  onDetail,
  onLater,
  onCatalog,
  onLibrary,
  onUserData,
  recommendations,
  onRecommendation,
}: {
  items: Item[];
  views: Item[];
  resume: Item[];
  nextUp: Item[];
  api: EmbyClient | null;
  later: Item[];
  onPlay: StartPlayback;
  onDetail: (item: Item) => void;
  onLater: (item: Item) => void;
  onCatalog: (type?: "Movie" | "Series", recent?: boolean) => void;
  onLibrary: (item: Item) => void;
  onUserData?: (item: Item, data: UserData) => void;
  recommendations?: Recommendation[];
  onRecommendation?: (entry: Recommendation) => void;
}) {
  const featured = resume[0] || nextUp[0] || items[0];
  const cards = (list: Item[], landscape = false) =>
    list.map((item) => (
      <MediaCard
        key={item.Id}
        item={item}
        api={api}
        landscape={landscape}
        saved={later.some((i) => i.Id === item.Id)}
        onPlay={onPlay}
        onDetail={onDetail}
        onLater={onLater}
        onUserData={onUserData}
      />
    ));
  // Keep shelves distinct: the first six additions, then the remaining titles by type.
  const recent = items.slice(0, 6);
  const movies = items.slice(6).filter((i) => i.Type === "Movie"),
    series = items.slice(6).filter((i) => i.Type === "Series");
  const upcoming = nextUp.filter((i) => i.Id !== featured?.Id);
  return (
    <div className="home-view">
      {featured && (
        <section
          className="feature-banner"
          aria-label={resume.length ? "继续观看" : "精选内容"}
        >
          <div className="feature-art" aria-hidden="true">
            <Artwork
              eager
              sources={api ? api.images(featured, true, 1280) : []}
              fallback={<PosterFallback item={featured} />}
            />
          </div>
          <div className="feature-copy">
            <p className="feature-kicker">
              {resume.length
                ? "继续观看"
                : nextUp.length
                  ? "接着追剧"
                  : "最近加入"}
            </p>
            {featured.SeriesName && (
              <p className="feature-series">{featured.SeriesName}</p>
            )}
            <h1>{featured.Name}</h1>
            <MediaMeta item={featured} />
            {featured.Overview && (
              <p className="feature-overview">
                {plainOverview(featured.Overview)}
              </p>
            )}
            <div className="feature-actions">
              <QuickPlay
                key={featured.Id}
                api={api}
                item={featured}
                onPlay={onPlay}
              />
              <button className="secondary" onClick={() => onDetail(featured)}>
                <Info size={18} />
                详情
              </button>
            </div>
          </div>
        </section>
      )}
      <nav className="catalog-shortcuts" aria-label="快捷媒体库">
        <button onClick={() => onCatalog("Movie")}>
          <Film size={19} />
          全部电影
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onCatalog("Series")}>
          <Tv size={19} />
          全部剧集
          <ChevronRight size={16} />
        </button>
        {views.map((view) => (
          <button
            key={view.Id}
            aria-label={`打开媒体库 ${view.Name}`}
            onClick={() => onLibrary(view)}
          >
            {view.CollectionType === "tvshows" ? (
              <Tv size={19} />
            ) : (
              <Film size={19} />
            )}
            {view.Name}
            <ChevronRight size={16} />
          </button>
        ))}
      </nav>
      {resume.length > 1 && (
        <MediaShelf title="继续观看" landscape>
          {cards(resume.slice(1), true)}
        </MediaShelf>
      )}
      {upcoming.length > 0 && (
        <MediaShelf title="接着追剧" landscape>
          {cards(upcoming, true)}
        </MediaShelf>
      )}
      {items.length > 0 && (
        <MediaShelf
          title="最近加入"
          onViewAll={() => onCatalog(undefined, true)}
        >
          {cards(recent)}
        </MediaShelf>
      )}
      {!recommendations && movies.length > 0 && (
        <MediaShelf title="电影" onViewAll={() => onCatalog("Movie")}>
          {cards(movies)}
        </MediaShelf>
      )}
      {!recommendations && series.length > 0 && (
        <MediaShelf title="剧集" onViewAll={() => onCatalog("Series")}>
          {cards(series)}
        </MediaShelf>
      )}
      {[...new Set(recommendations?.map((e) => e.category))].map((category) => (
        <MediaShelf key={category} title={category}>
          {recommendations
            ?.filter(
              (e) =>
                e.category === category &&
                !(
                  e.api.account.server === api?.account.server &&
                  recent.some((i) => i.Id === e.item.Id)
                ),
            )
            .map((entry) => (
              <MediaCard
                key={`${entry.connection.account.serverId || entry.connection.account.server}:${entry.item.Id}`}
                item={entry.item}
                api={entry.api}
                playable={
                  entry.api.account.server === api?.account.server &&
                  entry.api.account.userId === api?.account.userId
                }
                onPlay={onPlay}
                onDetail={() => onRecommendation?.(entry)}
              >
                <small className="recommendation-meta">
                  {recommendationMeta(entry.item)}
                </small>
              </MediaCard>
            ))}
        </MediaShelf>
      ))}
      {!featured && (
        <EmptyState
          title="媒体库还没有内容"
          description="选择左侧媒体库，或刷新后再试。"
        />
      )}
    </div>
  );
}
