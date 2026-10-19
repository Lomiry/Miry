import { memo, type ReactNode } from "react";
import { Star } from "lucide-react";
import { Artwork } from "./Artwork";
import type { Item } from "../types/emby";
import MediaProgress from "./MediaProgress";
import PosterFallback from "./PosterFallback";

export function MediaCaption({
  item,
  metadataOnly = false,
}: {
  item: Item;
  metadataOnly?: boolean;
}) {
  if (metadataOnly) {
    const year = item.ProductionYear;
    const rating = item.CommunityRating;
    const score =
      typeof rating === "number" && Number.isFinite(rating) && rating > 0
        ? rating.toFixed(1)
        : undefined;
    const genres = [
      ...new Set(
        (item.Genres ?? [])
          .filter((genre) => typeof genre === "string")
          .map((genre) => genre.trim())
          .filter(Boolean),
      ),
    ]
      .slice(0, 2)
      .join(" / ");
    const metadata = [
      typeof year === "number" && Number.isInteger(year) && year > 0
        ? String(year)
        : undefined,
      genres,
      score && Number(score) > 0 ? score : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <>
        <strong title={item.Name}>{item.Name}</strong>
        {metadata && <small className="poster-metadata">{metadata}</small>}
      </>
    );
  }
  const kind =
    (
      {
        Series: "剧集",
        Episode: `第 ${item.IndexNumber ?? "?"} 集`,
        Season: "季",
        BoxSet: "合集",
        Playlist: "播放列表",
        Folder: "媒体库",
        CollectionFolder: "媒体库",
      } as Record<string, string>
    )[item.Type] || "电影";
  return (
    <>
      <strong title={item.Name}>{item.Name}</strong>
      <small>
        {item.ProductionYear ? `${item.ProductionYear} · ` : ""}
        {kind}
        {item.CommunityRating ? (
          <span className="card-rating">
            <Star size={11} />
            {item.CommunityRating.toFixed(1)}
          </span>
        ) : null}
      </small>
    </>
  );
}

export const Poster = memo(function Poster({
  item,
  url,
  fallbackUrls = [],
  onClick,
  caption = true,
  metadataOnly = false,
  landscape = false,
  actions,
  fallback,
}: {
  item: Item;
  url?: string;
  fallbackUrls?: string[];
  onClick?: () => void;
  caption?: boolean;
  metadataOnly?: boolean;
  landscape?: boolean;
  actions?: ReactNode;
  fallback?: ReactNode;
}) {
  const image = (
    <Artwork
      sources={[url, ...fallbackUrls]}
      alt={item.Name}
      fallback={fallback || <PosterFallback item={item} />}
    />
  );
  return (
    <div className="card">
      <div className={`poster${landscape ? " poster-landscape" : ""}`}>
        {onClick ? (
          <button
            className="poster-open"
            aria-label={`查看详情 ${item.Name}`}
            onClick={onClick}
          >
            {image}
          </button>
        ) : (
          image
        )}
        {item.UserData?.Played && (
          <span className="watched" aria-label="已看">
            ✓
          </span>
        )}
        <MediaProgress item={item} />
        {actions}
      </div>
      {caption &&
        (onClick ? (
          <button className="card-caption" onClick={onClick}>
            <MediaCaption item={item} metadataOnly={metadataOnly} />
          </button>
        ) : (
          <div className="card-caption">
            <MediaCaption item={item} metadataOnly={metadataOnly} />
          </div>
        ))}
    </div>
  );
});
