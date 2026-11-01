import { displayError } from "../privacy";
import type { PlaybackSelection } from "../player/sourcePreference";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Play, X, LoaderCircle } from "lucide-react";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import { episodeLabel, resolveQuickPlay } from "../player/quickPlay";
import { formatTime } from "../player/formatTime";

export type StartPlayback = (
  item: Item,
  fromStart: boolean,
  sourceId?: string,
  signal?: AbortSignal,
  selection?: PlaybackSelection,
) => Promise<void>;
export default function QuickPlay({
  api,
  item,
  onPlay,
  compact = false,
  resumeLabel = false,
  overlay = false,
}: {
  api: EmbyClient | null;
  item: Item;
  onPlay: StartPlayback;
  compact?: boolean;
  resumeLabel?: boolean;
  overlay?: boolean;
}) {
  useI18n();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [target, setTarget] = useState<Item | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function start(fromStart = false) {
    if (pending.current) return;
    setError("");
    if (!api) {
      setError(t("player.demo_titles_have_no_video_files_connect"));
      return;
    }
    if (!isTauri()) {
      setError(t("library.open_the_desktop_app_to_play_media"));
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const selected =
        fromStart && target
          ? target
          : await resolveQuickPlay(api, item, controller.signal);
      if (controller.signal.aborted) return;
      setTarget(selected);
      await onPlay(selected, fromStart, undefined, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const position =
    (target?.Id === item.Id ? item : target || item).UserData
      ?.PlaybackPositionTicks || 0;
  const label =
    position > 0
      ? t("library.continue_watching_2", {
          p0: formatTime(position / 10000000),
        })
      : target
        ? t("library.play_now")
        : ["Series", "Season"].includes(item.Type)
          ? t("library.play_now")
          : t("library.play");
  return (
    <div
      className={`${compact ? "quick-play compact-play" : "quick-play"}${overlay ? " overlay-play" : ""}${busy ? " is-busy" : ""}${error ? " has-error" : ""}`}
    >
      <div className="quick-buttons">
        <button
          className={compact ? "quick-card-button" : "primary"}
          aria-label={
            compact ? t("library.quick_play", { p0: item.Name }) : label
          }
          disabled={busy}
          onClick={() => void start()}
        >
          {busy && overlay ? (
            <LoaderCircle className="ui-spinner" size={22} />
          ) : (
            <Play size={overlay ? 23 : compact ? 15 : 18} />
          )}
          <span className={overlay ? "visually-hidden" : undefined}>
            {busy
              ? t("player.preparing_playback")
              : compact
                ? resumeLabel && position > 0
                  ? t("player.resume_2", {
                      p0: formatTime(position / 10000000),
                    })
                  : t("library.quick_play_2")
                : label}
          </span>
        </button>
        {!compact && target && position > 0 && (
          <button
            className="secondary compact"
            disabled={busy}
            onClick={() => void start(true)}
          >
            {" "}
            {t("library.play_episode_from_beginning")}{" "}
          </button>
        )}
        {busy && (
          <button
            aria-label={t("library.cancel_quick_play")}
            onClick={() => pending.current?.abort()}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {!compact && target && (
        <small className="quick-hint">{episodeLabel(target)}</small>
      )}
      {error && (
        <p className="play-error" role="alert">
          {displayError(error)}
        </p>
      )}
    </div>
  );
}
