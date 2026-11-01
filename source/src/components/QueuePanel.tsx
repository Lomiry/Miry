import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { Play, SkipForward, X } from "lucide-react";
import type { PlaybackQueue, QueueState } from "../player/queue";
export default function QueuePanel({
  queue,
  state,
  autoNext,
  onAutoChange,
}: {
  queue: PlaybackQueue;
  state: QueueState;
  autoNext: boolean;
  onAutoChange: (next: boolean) => void;
}) {
  useI18n();

  if (!state.items.length && !state.error) return null;
  return (
    <section className="queue-panel">
      <div className="section-heading">
        <h2>{t("player.play_queue")}</h2>
        <span>
          {state.index + 1} / {state.items.length}
        </span>
      </div>
      <div className="queue-tools">
        <label>
          <input
            type="checkbox"
            checked={autoNext}
            onChange={(e) => onAutoChange(e.target.checked)}
          />{" "}
          {t("player.auto_play_next_episode")}{" "}
        </label>
        <button
          disabled={
            state.busy ||
            (state.index + 1 >= state.items.length &&
              state.items[state.index]?.Type !== "Episode")
          }
          onClick={() => void queue.next(true)}
        >
          <SkipForward size={16} /> {t("library.next_episode")}{" "}
        </button>
      </div>
      <ol>
        {state.items
          .slice(Math.max(0, state.index - 1), state.index + 8)
          .map((item, n) => {
            const index = Math.max(0, state.index - 1) + n;
            return (
              <li
                key={item.Id}
                className={index === state.index ? "current" : ""}
              >
                <button
                  disabled={state.busy}
                  onClick={() => void queue.select(index)}
                >
                  <Play size={14} />
                  <span>
                    {item.ParentIndexNumber !== undefined
                      ? `S${item.ParentIndexNumber} `
                      : ""}
                    {item.IndexNumber !== undefined
                      ? `E${item.IndexNumber} · `
                      : ""}
                    {item.Name}
                  </span>
                  {index === state.index && (
                    <small>{t("player.current")}</small>
                  )}
                </button>
                {index !== state.index && (
                  <button
                    aria-label={t("player.remove", { p0: item.Name })}
                    disabled={state.busy}
                    onClick={() => queue.remove(index)}
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
      </ol>
      {state.busy && (
        <p className="setting-note">
          {t("player.preparing_playback_or_syncing_progress")}
        </p>
      )}
      {state.loading && (
        <p className="setting-note">{t("player.loading_upcoming_episodes")}</p>
      )}
      {(state.error || state.warning) && (
        <p className="play-error" role="alert">
          {displayError(state.error || state.warning)}
        </p>
      )}
    </section>
  );
}
