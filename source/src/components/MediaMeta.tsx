import { Star } from "lucide-react";
import type { Item } from "../types/emby";
export default function MediaMeta({ item }: { item: Item }) {
  return (
    <div className="media-meta">
      {item.ProductionYear && <span>{item.ProductionYear}</span>}
      {item.RunTimeTicks ? (
        <span>{Math.round(item.RunTimeTicks / 600000000)} 分钟</span>
      ) : (
        <span>
          {["Series", "Season", "Episode"].includes(item.Type)
            ? "剧集"
            : "电影"}
        </span>
      )}
      {item.CommunityRating ? (
        <span
          className="media-rating"
          aria-label={`评分 ${item.CommunityRating}`}
        >
          <Star size={13} />
          {item.CommunityRating.toFixed(1)}
        </span>
      ) : null}
      {!!item.Genres?.length && (
        <span>{item.Genres.slice(0, 3).join(" / ")}</span>
      )}
    </div>
  );
}
