import type { ComponentProps } from "react";
import type MediaCard from "./MediaCard";
import { Bookmark, Star } from "lucide-react";
import { Poster } from "./Poster";
import QuickPlay from "./QuickPlay";
import FavoriteButton from "./FavoriteButton";
import MediaProgress, { mediaProgress } from "./MediaProgress";

const types: Record<string, string> = {
  Movie: "电影",
  Series: "电视剧",
  Season: "季",
  Episode: "剧集",
  Folder: "文件夹",
  CollectionFolder: "媒体库",
  BoxSet: "合集",
  Playlist: "片单",
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
  const artwork = api ? api.images(item, false, 160) : [];
  const progress = mediaProgress(item);
  return (
    <article className="media-row" aria-label={item.Name}>
      <button
        className="media-row-detail"
        aria-label={`查看详情 ${item.Name}`}
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
          ? `${Math.round(item.RunTimeTicks / 600000000)} 分钟`
          : "—"}
      </span>
      <span
        className="media-row-rating"
        aria-label={
          item.CommunityRating ? `评分 ${item.CommunityRating}` : "暂无评分"
        }
      >
        <Star size={13} />
        {item.CommunityRating?.toFixed(1) || "—"}
      </span>
      <span className="media-row-progress">
        <small>
          {item.UserData?.Played
            ? "已看"
            : progress
              ? `已看 ${Math.round(progress)}%`
              : "未看"}
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
              aria-label={`${saved ? "移出待看" : "加入待看"} ${item.Name}`}
              title={saved ? "移出待看" : "加入待看"}
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
