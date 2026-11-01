import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { Bookmark } from "lucide-react";
import type { ReactNode } from "react";
import type { Item, UserData } from "../types/emby";
import type { EmbyClient } from "../api/client";
import { Poster } from "./Poster";
import QuickPlay, { type StartPlayback } from "./QuickPlay";
import FavoriteButton from "./FavoriteButton";
import CollectionArtwork from "./CollectionArtwork";

export function MediaTile({
  item,
  api,
  landscape = false,
  metadataOnly = false,
  saved = false,
  onDetail,
  onLater,
  onPlay,
  onUserData,
  playable = true,
  children,
}: {
  item: Item;
  api: EmbyClient | null;
  landscape?: boolean;
  metadataOnly?: boolean;
  saved?: boolean;
  onDetail: (item: Item) => void;
  onLater?: (item: Item) => void;
  onPlay?: StartPlayback;
  onUserData?: (item: Item, data: UserData) => void;
  playable?: boolean;
  children?: ReactNode;
}) {
  useI18n();

  const artwork = api
    ? [
        ...api.artworkImages(
          item,
          landscape ? "episode" : "poster",
          landscape ? 400 : 240,
        ),
      ]
    : [];
  return (
    <article
      className={`media-tile poster-card${landscape ? " tile-resume" : ""}`}
    >
      <div className="tile-visual">
        <Poster
          item={item}
          url={artwork[0]}
          fallbackUrls={artwork.slice(1).filter((s): s is string => !!s)}
          landscape={landscape}
          metadataOnly={metadataOnly}
          onClick={() => onDetail(item)}
          fallback={
            item.Type === "BoxSet" && api ? (
              <CollectionArtwork item={item} api={api} />
            ) : undefined
          }
          actions={
            <div className="tile-actions">
              {playable &&
                onPlay &&
                ["Movie", "Episode", "Series", "Season"].includes(
                  item.Type,
                ) && (
                  <QuickPlay
                    api={api}
                    item={item}
                    compact
                    overlay
                    resumeLabel={landscape}
                    onPlay={onPlay}
                  />
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
                ["Movie", "Episode", "Series", "Season"].includes(
                  item.Type,
                ) && (
                  <button
                    className="tile-save"
                    title={
                      saved
                        ? t("library.remove_from_watch_later")
                        : t("library.add_to_watch_later")
                    }
                    aria-label={`${saved ? t("library.remove_from_watch_later") : t("library.add_to_watch_later")} ${item.Name}`}
                    aria-pressed={saved}
                    onClick={() => onLater(item)}
                  >
                    <Bookmark size={17} />
                  </button>
                )}
            </div>
          }
        />
      </div>
      {children}
    </article>
  );
}

export default function PosterCard(
  props: React.ComponentProps<typeof MediaTile>,
) {
  useI18n();

  return <MediaTile {...props} landscape={false} metadataOnly />;
}
