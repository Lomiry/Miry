import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Play, X, LoaderCircle } from "lucide-react";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import { episodeLabel, resolveQuickPlay } from "../player/quickPlay";
import { formatTime } from "./PlayerPanel";
import { privateText } from "../privacy";

export type StartPlayback = (
  item: Item,
  fromStart: boolean,
  sourceId?: string,
  signal?: AbortSignal,
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [target, setTarget] = useState<Item | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function start(fromStart = false) {
    if (pending.current) return;
    setError("");
    if (!api) {
      setError("演示内容没有视频文件，请连接自己的 Emby 服务器后播放。");
      return;
    }
    if (!isTauri()) {
      setError("请在桌面客户端中播放。");
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
  const position = (target || item).UserData?.PlaybackPositionTicks || 0;
  const label =
    position > 0
      ? `继续观看 · ${formatTime(position / 10000000)}`
      : target
        ? "立即播放"
        : ["Series", "Season"].includes(item.Type)
          ? "立即播放"
          : "播放";
  return (
    <div
      className={`${compact ? "quick-play compact-play" : "quick-play"}${overlay ? " overlay-play" : ""}${busy ? " is-busy" : ""}${error ? " has-error" : ""}`}
    >
      <div className="quick-buttons">
        <button
          className={compact ? "quick-card-button" : "primary"}
          aria-label={compact ? `快速播放 ${item.Name}` : label}
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
              ? "准备播放…"
              : compact
                ? resumeLabel && position > 0
                  ? `继续播放 · ${formatTime(position / 10000000)}`
                  : "快速播放"
                : label}
          </span>
        </button>
        {!compact && target && position > 0 && (
          <button
            className="secondary compact"
            disabled={busy}
            onClick={() => void start(true)}
          >
            本集从头播放
          </button>
        )}
        {busy && (
          <button
            aria-label="取消快速播放"
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
          {privateText(error)}
        </p>
      )}
    </div>
  );
}
