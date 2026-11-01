import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
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
import { favoriteScope } from "../api/favorites";
export function recommendationMeta(item: Item) {
  return [
    item.ProductionYear,
    item.Type === "Movie"
      ? t("library.movies")
      : item.Type === "Series"
        ? t("library.tv_shows")
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
  useI18n();

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
          aria-label={
            resume.length
              ? t("library.continue_watching")
              : t("library.featured")
          }
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
                ? t("library.continue_watching")
                : nextUp.length
                  ? t("library.next_up")
                  : t("library.recently_added")}
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
                <Info size={18} /> {t("library.details")}{" "}
              </button>
            </div>
          </div>
        </section>
      )}
      <nav
        className="catalog-shortcuts"
        aria-label={t("library.library_shortcuts")}
      >
        <button onClick={() => onCatalog("Movie")}>
          <Film size={19} /> {t("library.all_movies")}{" "}
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onCatalog("Series")}>
          <Tv size={19} /> {t("library.all_tv_shows")}{" "}
          <ChevronRight size={16} />
        </button>
        {views.map((view) => (
          <button
            key={view.Id}
            aria-label={t("library.open_library", { p0: view.Name })}
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
        <MediaShelf title={t("library.continue_watching")} landscape>
          {cards(resume.slice(1), true)}
        </MediaShelf>
      )}
      {upcoming.length > 0 && (
        <MediaShelf title={t("library.next_up")} landscape>
          {cards(upcoming, true)}
        </MediaShelf>
      )}
      {items.length > 0 && (
        <MediaShelf
          title={t("library.recently_added")}
          onViewAll={() => onCatalog(undefined, true)}
        >
          {cards(recent)}
        </MediaShelf>
      )}
      {!recommendations && movies.length > 0 && (
        <MediaShelf
          title={t("library.movies")}
          onViewAll={() => onCatalog("Movie")}
        >
          {cards(movies)}
        </MediaShelf>
      )}
      {!recommendations && series.length > 0 && (
        <MediaShelf
          title={t("library.tv_shows")}
          onViewAll={() => onCatalog("Series")}
        >
          {cards(series)}
        </MediaShelf>
      )}
      {[...new Set(recommendations?.map((e) => e.category))].map((category) => {
        const categoryKey = recommendations?.find(
          (e) => e.category === category,
        )?.categoryKey;
        return (
          <MediaShelf
            key={category}
            title={categoryKey ? t(categoryKey) : category}
          >
            {recommendations
              ?.filter(
                (e) =>
                  e.category === category &&
                  !(
                    api &&
                    favoriteScope(e.api.account) ===
                      favoriteScope(api.account) &&
                    recent.some((i) => i.Id === e.item.Id)
                  ),
              )
              .map((entry) => (
                <MediaCard
                  key={JSON.stringify([
                    favoriteScope(entry.connection.account),
                    entry.item.Id,
                  ])}
                  item={entry.item}
                  api={entry.api}
                  playable={
                    !!api &&
                    favoriteScope(entry.api.account) ===
                      favoriteScope(api.account)
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
        );
      })}
      {!featured && (
        <EmptyState
          title={t("library.your_libraries_are_empty")}
          description={t("library.select_a_library_in_the_sidebar_or")}
        />
      )}
    </div>
  );
}
