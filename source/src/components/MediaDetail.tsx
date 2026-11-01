import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useMemo, useState } from "react";
import { Bookmark, ChevronDown, ChevronUp, Play } from "lucide-react";
import type { Item, UserData } from "../types/emby";
import type { EmbyClient } from "../api/client";
import { privateText } from "../privacy";
import { Artwork } from "./Artwork";
import { Poster } from "./Poster";
import PosterFallback from "./PosterFallback";
import MediaMeta from "./MediaMeta";
import { Cast, plainOverview } from "./People";
import { PlayButton } from "./PlayerPanel";
import QuickPlay, { type StartPlayback } from "./QuickPlay";
import ItemActions from "./ItemActions";
import PlaybackChoices from "./PlaybackChoices";

export default function MediaDetail({
  item,
  api,
  saved,
  onPlay,
  onLater,
  onChange,
  onPerson,
  onCollection,
}: {
  item: Item;
  api: EmbyClient | null;
  saved: boolean;
  onPlay: StartPlayback;
  onLater: () => void;
  onChange: (data: UserData) => void;
  onPerson: (item: Item) => void;
  onCollection?: () => void;
}) {
  useI18n();

  const [expanded, setExpanded] = useState(false);
  const overview = useMemo(
    () => plainOverview(item.Overview || ""),
    [item.Overview],
  );
  const playable = ["Movie", "Episode", "Series", "Season"].includes(item.Type);
  return (
    <>
      <section className="media-detail" aria-label={t("library.media_details")}>
        <div className="detail-backdrop" aria-hidden="true">
          <Artwork
            eager
            sources={api ? api.images(item, true, 1280) : []}
            fallback={<PosterFallback item={item} />}
          />
        </div>
        <div className="detail-composition">
          <div className="detail-cover">
            <Poster
              item={item}
              url={api ? api.image(item, false, 400) : undefined}
              fallbackUrls={api?.images(item, false, 400).slice(1)}
              caption={false}
            />
          </div>
          <div className="detail-copy">
            {item.SeriesName && item.SeriesName !== item.Name && (
              <p className="feature-series">{item.SeriesName}</p>
            )}
            <h1>{item.Name}</h1>
            <MediaMeta item={item} />
            <div className="detail-primary">
              {["Series", "Season"].includes(item.Type) && (
                <PlaybackChoices
                  sources={[]}
                  sourceId=""
                  audio=""
                  subtitle=""
                  busy={false}
                  onSource={() => {}}
                  onAudio={() => {}}
                  onSubtitle={() => {}}
                />
              )}
              {["Series", "Season"].includes(item.Type) && (
                <QuickPlay api={api} item={item} onPlay={onPlay} />
              )}
              {["Movie", "Episode"].includes(item.Type) && (
                <PlayButton
                  showSelections
                  api={api}
                  item={item}
                  onStarted={() => {}}
                  onPlay={onPlay}
                />
              )}
              {onCollection && (
                <button className="primary" onClick={onCollection}>
                  <Play size={18} />{" "}
                  {t("library.play_titles_on_this_page")}{" "}
                </button>
              )}
            </div>
            <div className="detail-secondary">
              <ItemActions api={api} item={item} onChange={onChange} />
              {playable && (
                <button
                  className="quiet-action"
                  aria-pressed={saved}
                  onClick={onLater}
                >
                  <Bookmark size={17} />
                  {saved
                    ? t("library.remove_from_watch_later")
                    : t("library.add_to_watch_later")}
                </button>
              )}
            </div>
            <div className="detail-synopsis">
              <p className={expanded ? "synopsis expanded" : "synopsis"}>
                {overview || t("library.no_overview_available")}
              </p>
              {overview.length > 170 && (
                <button
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? t("library.show_less") : t("library.show_more")}
                  {expanded ? (
                    <ChevronUp size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      {!!item.People?.length && (
        <Cast people={item.People} api={api} onPerson={onPerson} />
      )}
      {!!item.MediaSources?.length && (
        <details className="detail-media-info">
          <summary>{t("library.media_information")}</summary>
          {item.MediaSources.map((source) => (
            <div key={source.Id}>
              <strong>
                {privateText(
                  source.Name ||
                    source.Container?.toUpperCase() ||
                    t("library.video"),
                )}
              </strong>
              <p>
                {source.Bitrate
                  ? `${(source.Bitrate / 1000000).toFixed(1)} Mbps · `
                  : ""}
                {source.MediaStreams?.map((s) => s.DisplayTitle || s.Codec)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
