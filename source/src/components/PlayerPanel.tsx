import Select from "./Select";
import type { VideoFit } from "../player/videoFit";
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, X, MonitorPlay } from "lucide-react";
import { preparePlayback, type PlayerSnapshot } from "../player/playback";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import VideoViewport from "./VideoViewport";
import PlayerChrome from "./PlayerChrome";
import useDanmaku from "../danmaku/useDanmaku";
import useDanmakuClock from "../danmaku/useDanmakuClock";
import DanmakuLayer from "../danmaku/DanmakuLayer";
import { usePlayerOverlay } from "../player/usePlayerOverlay";
import type { PlayerUiModel, PlayerAction } from "../player/uiModel";
import { formatTime } from "../player/formatTime";
export { formatTime } from "../player/formatTime";
import { privateText } from "../privacy";
import { PreviewLoader, type PreviewFrame } from "../player/preview";
import { readSettings, saveSettings, type Settings } from "../stores/settings";
import {
  diagnosticUrl,
  networkCategory,
  readNetworkDiagnostics,
  recordNetwork,
  redactNetworkDetail,
} from "../api/diagnostics";
import { APP_VERSION } from "../version";
export function PlayButton({
  api,
  item,
  onStarted,
  onPlay,
  concise = false,
}: {
  api: EmbyClient | null;
  item: Item;
  onStarted: () => void;
  concise?: boolean;
  onPlay?: (
    item: Item,
    fromStart: boolean,
    sourceId?: string,
    signal?: AbortSignal,
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [sourceId, setSourceId] = useState(item.MediaSources?.[0]?.Id || "");
  useEffect(() => () => controller.current?.abort(), []);
  async function start(fromStart: boolean) {
    setError("");
    if (!api) {
      setError("演示内容没有视频文件，请连接自己的 Emby 服务器后播放。");
      return;
    }
    if (!isTauri()) {
      setError("mpv 播放需要桌面版，请打开 Miry.exe。");
      return;
    }
    setBusy(true);
    const pending = new AbortController();
    controller.current = pending;
    try {
      if (onPlay) {
        await onPlay(item, fromStart, sourceId || undefined, pending.signal);
        onStarted();
      } else {
        const launch = await preparePlayback(
          api,
          item,
          fromStart,
          pending.signal,
          sourceId || undefined,
        );
        if (pending.signal.aborted) return;
        await invoke("player_start", { launch });
        if (pending.signal.aborted) {
          await invoke("player_stop");
          setError("已取消播放。");
        } else {
          onStarted();
        }
      }
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "已取消准备播放。"
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  const position = item.UserData?.PlaybackPositionTicks || 0;
  return (
    <div className="play-actions">
      {(item.MediaSources?.length || 0) > 1 && (
        <label className="version-picker">
          播放版本
          <Select
            aria-label="播放版本"
            disabled={busy}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {item.MediaSources!.map((s) => (
              <option value={s.Id} key={s.Id}>
                {privateText(s.Name || "视频版本")} ·{" "}
                {s.Container?.toUpperCase()}{" "}
                {s.MediaStreams?.find((t) => t.Type === "Video")?.Height
                  ? `${s.MediaStreams.find((t) => t.Type === "Video")!.Height}p`
                  : ""}
              </option>
            ))}
          </Select>
        </label>
      )}
      <button
        className="primary"
        disabled={busy}
        title={
          concise ? `${position ? "继续播放" : "播放"} ${item.Name}` : undefined
        }
        onClick={() => start(false)}
      >
        <Play size={17} />
        {busy
          ? "准备播放…"
          : position
            ? concise
              ? "继续播放"
              : `继续播放 · ${formatTime(position / 10000000)}`
            : "播放"}
      </button>
      {position > 0 && (
        <button
          disabled={busy}
          className="secondary compact"
          onClick={() => start(true)}
        >
          从头播放
        </button>
      )}
      {busy && (
        <button
          aria-label="取消准备播放"
          onClick={() => controller.current?.abort()}
        >
          <X size={16} />
        </button>
      )}
      {error && (
        <p role="alert" className="play-error">
          {privateText(error)}
        </p>
      )}
    </div>
  );
}
export default function PlayerPanel({
  revision,
  onStopped,
  onSnapshot,
  onFullscreenChange,
  onStop,
  dock = false,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  theater = false,
  item,
  api,
  sourceId,
  onSourceChange,
  onRestart,
  onTheater,
  onReturn,
  overlayOpen = false,
  routes,
  onRouteSelect,
  queuePresentation,
  onQueueSelect,
  onQueueRemove,
  onAutoChange,
  introSeconds = 90,
  outroSeconds = 60,
  settings,
  routeHint,
  onRouteDismiss,
  onRouteProbe,
}: {
  revision: number;
  onStopped: () => void;
  onSnapshot?: (s: PlayerSnapshot) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  onStop?: () => Promise<void>;
  dock?: boolean;
  onPrevious?: () => Promise<void>;
  onNext?: () => Promise<void>;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  theater?: boolean;
  item?: Item;
  api?: EmbyClient | null;
  sourceId?: string;
  onSourceChange?: (id: string) => Promise<void>;
  onRestart?: () => Promise<void>;
  onTheater?: () => void;
  onReturn?: () => Promise<void>;
  overlayOpen?: boolean;
  routes?: PlayerUiModel["routes"];
  onRouteSelect?: (index: number) => Promise<void>;
  queuePresentation?: PlayerUiModel["queue"];
  onQueueSelect?: (index: number) => Promise<void>;
  onQueueRemove?: (index: number) => void;
  onAutoChange?: (value: boolean) => void;
  introSeconds?: number;
  outroSeconds?: number;
  settings?: Settings;
  routeHint?: PlayerUiModel["routeHint"];
  onRouteDismiss?: (session?: boolean) => void;
  onRouteProbe?: (index: number, media: boolean) => Promise<void>;
}) {
  const [state, setState] = useState<PlayerSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const fitOwner = useRef({ mounted: true, revision, state });
  fitOwner.current = { mounted: true, revision, state };
  const fitPending = useRef(false);
  useEffect(() => {
    fitOwner.current.mounted = true;
    return () => {
      fitOwner.current.mounted = false;
    };
  }, []);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState("");
  const danmaku = useDanmaku(
    api || null,
    item,
    !!(state?.active && state.loaded),
    state?.playSessionId,
  );
  const danmakuClock = useDanmakuClock(
    !!(
      danmaku.document &&
      danmaku.metadata.settings.enabled &&
      theater &&
      state?.active &&
      state.embedded &&
      state.loaded &&
      !overlayOpen
    ),
    revision,
  );
  const [preview, setPreview] = useState<PreviewFrame | null>(null);
  const previewLoader = useRef<PreviewLoader | null>(null);
  useEffect(() => {
    setPreview(null);
    const loader =
      api && item ? new PreviewLoader(api, item, sourceId, setPreview) : null;
    previewLoader.current = loader;
    return () => {
      loader?.dispose();
      previewLoader.current = null;
    };
  }, [api, item?.Id, sourceId, revision]);
  useEffect(() => {
    if (!state?.error || !api) return;
    const detail = [state.error, ...(state.networkDetails || [])].join(" → ");
    const status = /HTTP(?: error|\/\S+)?\s+(\d{3})/i.exec(detail);
    recordNetwork({
      stage: "native-playback",
      method: "GET",
      url: diagnosticUrl(new URL(api.account.server), "/Videos/{id}/stream"),
      backend: "mpv / libcurl",
      elapsedMs: state.loadElapsedMs || 0,
      category: status ? "http" : networkCategory(detail),
      status: status ? Number(status[1]) : undefined,
      underlying: redactNetworkDetail(detail, [
        api.account.token,
        new URL(api.account.server).hostname,
      ]),
    });
    setDiagnosticFeedback("");
  }, [state?.error, api]);
  async function copyPlaybackDiagnostics() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          { version: APP_VERSION, requests: readNetworkDiagnostics() },
          null,
          2,
        ),
      );
      setDiagnosticFeedback("匿名播放诊断已复制。");
    } catch {
      setDiagnosticFeedback("诊断复制失败，请检查剪贴板权限。");
    }
  }
  const previous = useRef(false),
    stopCallback = useRef(onStopped);
  const canHide = !!(
    theater &&
    state?.embedded &&
    state.active &&
    state.loaded
  );
  stopCallback.current = onStopped;
  const snapshotCallback = useRef(onSnapshot);
  snapshotCallback.current = onSnapshot;
  const fullscreenCallback = useRef(onFullscreenChange);
  fullscreenCallback.current = onFullscreenChange;
  useEffect(() => {
    fullscreenCallback.current?.(Boolean(state?.embedded && state.fullscreen));
  }, [state?.embedded, state?.fullscreen]);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let remove: (() => void) | undefined;
    void listen<boolean>("player-fullscreen", (event) => {
      if (active)
        setState((s) => (s ? { ...s, fullscreen: event.payload } : s));
    })
      .then((unlisten) => {
        if (active) remove = unlisten;
        else unlisten();
      })
      .catch(() => {});
    return () => {
      active = false;
      remove?.();
    };
  }, []);
  useEffect(() => {
    if (state?.embedded && state.fullscreen && !state.active) {
      void invoke("player_control", { action: "fullscreen", value: 0 })
        .then(() => setState((s) => (s ? { ...s, fullscreen: false } : s)))
        .catch((e) => setError(String(e)));
    }
  }, [state?.embedded, state?.fullscreen, state?.active]);
  useEffect(() => {
    setDismissed(false);
  }, [revision]);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let delay = document.hidden ? 2500 : 1000;
      try {
        const next = await invoke<PlayerSnapshot>("player_status");
        if (!active) return;
        setState(next);
        snapshotCallback.current?.(next);
        if (previous.current && !next.active && next.syncComplete) {
          stopCallback.current();
          previous.current = false;
        }
        if (next.active) previous.current = true;
        if (!next.active && next.syncComplete !== false) delay = 8000;
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) timer = setTimeout(poll, delay);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [revision]);
  async function control(
    action: string,
    value?: number,
    persist = true,
    playSessionId?: string,
  ) {
    if (
      [
        "subtitlePosition",
        "subtitleScale",
        "secondarySubtitlePosition",
        "secondarySubtitleScale",
      ].includes(action) &&
      value !== undefined
    ) {
      await invoke("player_control", {
        action,
        value,
        ...(playSessionId ? { expectedSessionId: playSessionId } : {}),
      });
      if (persist) saveSettings({ ...readSettings(), [action]: value });
      return;
    }
    if (busy) return;
    const fullscreenTarget =
      value === undefined ? !state?.fullscreen : value === 1;
    setBusy(true);
    setError("");
    try {
      if (action === "stop" && onStop) {
        await onStop();
      } else {
        await invoke(
          action === "stop" ? "player_stop" : "player_control",
          action === "stop"
            ? {}
            : {
                action,
                value:
                  action === "fullscreen" && state?.embedded
                    ? fullscreenTarget
                      ? 1
                      : 0
                    : value,
              },
        );
      }
      if (action === "fullscreen") {
        setState((s) =>
          s?.embedded ? { ...s, fullscreen: fullscreenTarget } : s,
        );
      }
      if (action === "stop") {
        setState((s) => (s ? { ...s, active: false } : s));
      }
      const property = (
        {
          volume: "volume",
          speed: "speed",
          subtitleDelay: "subtitleDelay",
          audioDelay: "audioDelay",
          subtitleScale: "subtitleScale",
          subtitlePosition: "subtitlePosition",
          secondarySubtitle: "secondarySubtitle",
          loopA: "loopA",
          loopB: "loopB",
          seek: "position",
        } as Record<string, string>
      )[action];
      if (property && value !== undefined)
        setState((s) => (s ? { ...s, [property]: value } : s));
      if (action === "pause")
        setState((s) => (s ? { ...s, paused: !s.paused } : s));
      if (action === "clearLoop")
        setState((s) => (s ? { ...s, loopA: undefined, loopB: undefined } : s));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeEpisode(callback?: () => Promise<void>) {
    if (!callback || busy) return;
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function returnToBrowse() {
    if (!theater) {
      onTheater?.();
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (onReturn) await onReturn();
      else {
        if (onStop) await onStop();
        else await invoke("player_stop", {});
        setState((s) => (s ? { ...s, active: false, fullscreen: false } : s));
        setDismissed(true);
        onTheater?.();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const nativeUi = !!(
    theater &&
    state?.embedded &&
    state.active &&
    state.loaded &&
    !overlayOpen &&
    "__TAURI_INTERNALS__" in window
  );
  const uiModel: PlayerUiModel | null = state
    ? {
        state,
        revision,
        theater,
        canHide,
        busy,
        error,
        diagnosticFeedback,
        item,
        sourceId,
        introSeconds,
        outroSeconds,
        shortcuts: state.shortcuts || settings?.shortcuts,
        inputConfig: settings?.quality?.inputConfig,
        shortcutsBlocked: overlayOpen,
        preview,
        danmaku: danmaku.metadata,
        routeHint,
        previousDisabled,
        nextDisabled,
        capabilities: {
          return: !!(onTheater || onReturn),
          previous: !!onPrevious && (!item || item.Type === "Episode"),
          next: !!onNext && (!item || item.Type === "Episode"),
          restart: !!onRestart,
          versions: !!onSourceChange && (item?.MediaSources?.length || 0) > 1,
        },
        routes: routes || [],
        queue: queuePresentation,
      }
    : null;
  async function dispatchUi(action: PlayerAction) {
    switch (action.kind) {
      case "video-fit": {
        if (
          busy ||
          fitPending.current ||
          !state?.active ||
          !state.loaded ||
          state.playSessionId !== action.playSessionId
        )
          return;
        const ownerRevision = revision;
        const current = () =>
          fitOwner.current.mounted &&
          fitOwner.current.revision === ownerRevision &&
          fitOwner.current.state?.active &&
          fitOwner.current.state.playSessionId === action.playSessionId;
        fitPending.current = true;
        setBusy(true);
        setError("");
        try {
          const mode = await invoke<VideoFit>("player_video_fit", {
            mode: action.mode,
            playSessionId: action.playSessionId,
          });
          if (!current()) return;
          setState((s) =>
            s?.playSessionId === action.playSessionId
              ? { ...s, videoFit: mode }
              : s,
          );
          saveSettings({ ...readSettings(), videoFit: mode });
        } catch (e) {
          if (current()) setError(String(e));
        } finally {
          fitPending.current = false;
          if (fitOwner.current.mounted) setBusy(false);
        }
        break;
      }
      case "danmaku":
        await danmaku.action(
          action.command,
          action.patch,
          action.query,
          action.matchId,
        );
        break;
      case "route-dismiss":
        onRouteDismiss?.();
        break;
      case "route-suppress":
        onRouteDismiss?.(true);
        break;
      case "route-probe":
        await changeEpisode(
          () => onRouteProbe?.(action.index, action.media) || Promise.resolve(),
        );
        break;
      case "preview":
        previewLoader.current?.request(action.time);
        break;
      case "mpv-key":
        await invoke("player_key", { code: action.code });
        break;
      case "control":
        await control(
          action.action,
          action.value,
          action.persist,
          action.playSessionId,
        );
        break;
      case "return":
        await returnToBrowse();
        break;
      case "next":
        await changeEpisode(onNext);
        break;
      case "previous":
        await changeEpisode(onPrevious);
        break;
      case "restart":
        await changeEpisode(onRestart);
        break;
      case "source":
        await changeEpisode(
          () => onSourceChange?.(action.id) || Promise.resolve(),
        );
        break;
      case "route":
        await changeEpisode(
          () => onRouteSelect?.(action.index) || Promise.resolve(),
        );
        break;
      case "queue-select":
        await changeEpisode(
          () => onQueueSelect?.(action.index) || Promise.resolve(),
        );
        break;
      case "queue-remove":
        onQueueRemove?.(action.index);
        break;
      case "auto-next":
        onAutoChange?.(action.value);
        break;
      case "diagnostics":
        await copyPlaybackDiagnostics();
        break;
    }
  }
  const overlayReady = usePlayerOverlay(nativeUi, uiModel, dispatchUi, {
    document: danmaku.document,
    clock: danmakuClock,
  });
  if (
    !state?.title ||
    (dismissed && !theater) ||
    (dock && !theater && !state.active)
  )
    return null;
  return (
    <section
      className={`player-panel${theater ? " player-theater" : dock ? " player-dock" : ""}${state.embedded && state.fullscreen ? " player-fullscreen" : ""}`}
      aria-label="播放器控制"
    >
      {theater && (
        <div className="playback-stage">
          {state.embedded && state.active && (!nativeUi || !overlayReady) && (
            <DanmakuLayer
              document={danmaku.document}
              clock={danmakuClock}
              settings={{
                ...danmaku.metadata.settings,
                offset: danmaku.metadata.offset,
              }}
            />
          )}
          {item &&
            (!state.embedded || !state.active) &&
            api?.image(item, true) && (
              <img
                className="playback-backdrop"
                src={api.image(item, true)}
                alt=""
              />
            )}
          {state.embedded && state.active && (
            <VideoViewport visible={!overlayOpen} controls={nativeUi} />
          )}
          {(!state.embedded || !state.active || !state.loaded) && (
            <div className="playback-stage-content">
              <MonitorPlay size={38} />
              <h1>{privateText(state.title)}</h1>
              <p>
                {state.active
                  ? state.loaded
                    ? "视频在独立窗口播放"
                    : "正在准备视频"
                  : state.finished
                    ? "已播放完毕"
                    : "播放已停止"}
              </p>
              <div>
                {state.active && !state.embedded ? (
                  <button
                    className="primary"
                    disabled={busy || !state.loaded}
                    onClick={() => void control("show")}
                  >
                    <MonitorPlay size={17} />
                    恢复视频窗口
                  </button>
                ) : !state.active && onRestart ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void changeEpisode(onRestart)}
                  >
                    重新播放
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
      {uiModel && (!nativeUi || !overlayReady) && (
        <PlayerChrome model={uiModel} dispatch={dispatchUi} />
      )}
      {!state.active && !theater && (
        <button
          className="player-close"
          aria-label="关闭播放器面板"
          onClick={() => setDismissed(true)}
        >
          <X size={18} />
        </button>
      )}
    </section>
  );
}
