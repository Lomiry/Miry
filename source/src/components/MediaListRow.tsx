import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import type { ComponentProps } from "react";
import type MediaCard from "./MediaCard";
import { Bookmark, Star } from "lucide-react";
import { Poster } from "./Poster";
import QuickPlay from "./QuickPlay";
import FavoriteButton from "./FavoriteButton";
import MediaProgress, { mediaProgress } from "./MediaProgress";

const types: Record<string, string> = {
  get Movie() {
    return t("library.movies");
  },
  get Series() {
    return t("library.tv_series");
  },
  get Season() {
    return t("library.season");
  },
  get Episode() {
    return t("library.tv_shows");
  },
  get Folder() {
    return t("library.folder");
  },
  get CollectionFolder() {
    return t("library.libraries");
  },
  get BoxSet() {
    return t("library.collections");
  },
  get Playlist() {
    return t("library.playlist");
  },
};
export default function MediaListRow({
  item,
  api,
  saved,
  onDetail,
  onPlay,
  onLater,
  onUserData,
  playable = true,
  children,
}: ComponentProps<typeof MediaCard>) {
  useI18n();

  const artwork = api ? api.images(item, false, 160) : [];
  const progress = mediaProgress(item);
  return (
    <article className="media-row" aria-label={item.Name}>
      <button
        className="media-row-detail"
        aria-label={t("library.view_details_for_2", { p0: item.Name })}
        onClick={() => onDetail(item)}
      >
        <Poster
          item={item}
          url={artwork[0]}
          fallbackUrls={artwork.slice(1).filter((s): s is string => !!s)}
          caption={false}
        />
        <span className="media-row-title">
          <strong title={item.Name}>{item.Name}</strong>
          <small>
            {item.SeriesName || item.Genres?.slice(0, 2).join(" / ")}
          </small>
        </span>
      </button>
      <span className="media-row-year">{item.ProductionYear || "—"}</span>
      <span className="media-row-type">{types[item.Type] || item.Type}</span>
      <span className="media-row-duration">
        {item.RunTimeTicks
          ? t("library.min_2", {
              p0: Math.round(item.RunTimeTicks / 600000000),
            })
          : "—"}
      </span>
      <span
        className="media-row-rating"
        aria-label={
          item.CommunityRating
            ? t("library.rating_2", { p0: item.CommunityRating })
            : t("library.no_rating")
        }
      >
        <Star size={13} />
        {item.CommunityRating?.toFixed(1) || "—"}
      </span>
      <span className="media-row-progress">
        <small>
          {item.UserData?.Played
            ? t("library.watched")
            : progress
              ? t("library.watched_2", { p0: Math.round(progress) })
              : t("library.unwatched")}
        </small>
        <MediaProgress item={item} />
      </span>
      <div className="media-row-actions">
        {playable &&
          onPlay &&
          ["Movie", "Series", "Season", "Episode"].includes(item.Type) && (
            <QuickPlay api={api} item={item} compact onPlay={onPlay} />
          )}
        {onUserData &&
          ["Movie", "Episode", "Series", "Season", "BoxSet"].includes(
            item.Type,
          ) && (
            <FavoriteButton
              api={api}
              item={item}
              onChange={(data) => onUserData(item, data)}
            />
          )}
        {playable &&
          onLater &&
          ["Movie", "Episode", "Series", "Season"].includes(item.Type) && (
            <button
              aria-label={`${saved ? t("library.remove_from_watch_later") : t("library.add_to_watch_later")} ${item.Name}`}
              title={
                saved
                  ? t("library.remove_from_watch_later")
                  : t("library.add_to_watch_later")
              }
              aria-pressed={saved}
              onClick={() => onLater(item)}
            >
              <Bookmark size={17} />
            </button>
          )}
        {children}
      </div>
    </article>
  );
}
