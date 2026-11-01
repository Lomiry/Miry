import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { Star } from "lucide-react";
import type { Item } from "../types/emby";
export default function MediaMeta({ item }: { item: Item }) {
  useI18n();

  return (
    <div className="media-meta">
      {item.ProductionYear && <span>{item.ProductionYear}</span>}
      {item.RunTimeTicks ? (
        <span>
          {Math.round(item.RunTimeTicks / 600000000)} {t("library.min_3")}
        </span>
      ) : (
        <span>
          {["Series", "Season", "Episode"].includes(item.Type)
            ? t("library.tv_shows")
            : t("library.movies")}
        </span>
      )}
      {item.CommunityRating ? (
        <span
          className="media-rating"
          aria-label={t("library.rating_2", { p0: item.CommunityRating })}
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
