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
  const [expanded, setExpanded] = useState(false);
  const overview = useMemo(
    () => plainOverview(item.Overview || ""),
    [item.Overview],
  );
  const playable = ["Movie", "Episode", "Series", "Season"].includes(item.Type);
  return (
    <>
      <section className="media-detail" aria-label="影片详情">
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
                <QuickPlay api={api} item={item} onPlay={onPlay} />
              )}
              {["Movie", "Episode"].includes(item.Type) && (
                <PlayButton
                  api={api}
                  item={item}
                  onStarted={() => {}}
                  onPlay={onPlay}
                />
              )}
              {onCollection && (
                <button className="primary" onClick={onCollection}>
                  <Play size={18} />
                  播放本页片单
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
                  {saved ? "移出待看" : "加入待看"}
                </button>
              )}
            </div>
            <div className="detail-synopsis">
              <p className={expanded ? "synopsis expanded" : "synopsis"}>
                {overview || "暂无简介"}
              </p>
              {overview.length > 170 && (
                <button
                  className="text-button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "收起简介" : "展开简介"}
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
          <summary>媒体信息</summary>
          {item.MediaSources.map((source) => (
            <div key={source.Id}>
              <strong>
                {privateText(
                  source.Name || source.Container?.toUpperCase() || "视频",
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
