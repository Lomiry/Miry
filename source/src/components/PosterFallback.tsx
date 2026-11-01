import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { Film, Tv, Layers, ListVideo } from "lucide-react";
import type { Item } from "../types/emby";
export default function PosterFallback({ item }: { item: Item }) {
  useI18n();

  const Icon =
    item.Type === "BoxSet"
      ? Layers
      : item.Type === "Playlist"
        ? ListVideo
        : ["Series", "Season", "Episode"].includes(item.Type)
          ? Tv
          : Film;
  const initials =
    item.Name.trim().split(/\s+/).length > 1
      ? item.Name.trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => Array.from(s)[0])
          .join("")
          .toUpperCase()
      : Array.from(item.Name.trim()).slice(0, 2).join("");
  return (
    <div
      className="poster-fallback"
      role="img"
      aria-label={item.Name + t("library.default_artwork")}
    >
      <Icon size={28} aria-hidden="true" />
      <span className="poster-initials" aria-hidden="true">
        {initials || "M"}
      </span>
      <small>{t("library.no_artwork")}</small>
    </div>
  );
}
