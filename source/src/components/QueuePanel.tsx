import { Play, SkipForward, X } from "lucide-react";
import type { PlaybackQueue, QueueState } from "../player/queue";
import { privateText } from "../privacy";
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
  if (!state.items.length && !state.error) return null;
  return (
    <section className="queue-panel">
      <div className="section-heading">
        <h2>播放队列</h2>
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
          自动下一集
        </label>
        <button
          disabled={
            state.busy ||
            (state.index + 1 >= state.items.length &&
              state.items[state.index]?.Type !== "Episode")
          }
          onClick={() => void queue.next(true)}
        >
          <SkipForward size={16} />
          下一集
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
                  {index === state.index && <small>当前</small>}
                </button>
                {index !== state.index && (
                  <button
                    aria-label={`移除 ${item.Name}`}
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
      {state.busy && <p className="setting-note">正在准备播放或同步进度…</p>}
      {state.loading && <p className="setting-note">正在加载后续剧集…</p>}
      {(state.error || state.warning) && (
        <p className="play-error" role="alert">
          {privateText(state.error || state.warning)}
        </p>
      )}
    </section>
  );
}
