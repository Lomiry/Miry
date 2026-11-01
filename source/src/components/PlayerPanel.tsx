import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import Select from "./Select";
import type { VideoFit } from "../player/videoFit";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { useMiniWindow } from "../player/useMiniWindow";
import { normalizeControlLayout } from "../player/controlLayout";
import PlaybackChoices from "./PlaybackChoices";
import {
  rankSources,
  type PlaybackSelection,
} from "../player/sourcePreference";
export function PlayButton({
  api,
  item,
  onStarted,
  onPlay,
  concise = false,
  showSelections = false,
}: {
  api: EmbyClient | null;
  item: Item;
  onStarted: () => void;
  concise?: boolean;
  showSelections?: boolean;
  onPlay?: (
    item: Item,
    fromStart: boolean,
    sourceId?: string,
    signal?: AbortSignal,
    selection?: PlaybackSelection,
  ) => Promise<void>;
}) {
  useI18n();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [audio, setAudio] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const preferences = readSettings();
  const sources = item.MediaSources || [];
  const effectiveSourceId = sources.some((s) => s.Id === sourceId)
    ? sourceId
    : "";
  const preview =
    sources.find((s) => s.Id === effectiveSourceId) ||
    rankSources(sources, preferences.sourcePreference)[0];
  useEffect(() => {
    setAudio("");
    setSubtitle("");
  }, [preview?.Id]);
  useEffect(() => {
    setSourceId("");
    setAudio("");
    setSubtitle("");
    setError("");
    setBusy(false);
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [item.Id, api?.account.server, api?.account.userId]);
  async function start(fromStart: boolean) {
    if (controller.current) return;
    setError("");
    if (!api) {
      setError(t("player.demo_titles_have_no_video_files_connect"));
      return;
    }
    if (!isTauri()) {
      setError(t("player.mpv_playback_requires_the_desktop_app_open"));
      return;
    }
    setBusy(true);
    const pending = new AbortController();
    controller.current = pending;
    try {
      const selection: PlaybackSelection | undefined =
        preview && (audio !== "" || subtitle !== "")
          ? {
              sourceId: preview.Id,
              ...(audio !== "" ? { audioIndex: Number(audio) } : {}),
              ...(subtitle !== "" ? { subtitleIndex: Number(subtitle) } : {}),
            }
          : undefined;
      const selectedId = effectiveSourceId || selection?.sourceId;
      if (onPlay) {
        if (selection)
          await onPlay(item, fromStart, selectedId, pending.signal, selection);
        else await onPlay(item, fromStart, selectedId, pending.signal);
        if (!pending.signal.aborted) onStarted();
      } else {
        const launch = await preparePlayback(
          api,
          item,
          fromStart,
          pending.signal,
          selectedId,
          preferences,
          selection,
        );
        if (pending.signal.aborted) return;
        await invoke("player_start", { launch });
        if (pending.signal.aborted) {
          await invoke("player_stop");
          setError(t("player.playback_cancelled"));
        } else {
          onStarted();
        }
      }
    } catch (e) {
      if (pending.signal.aborted) return;
      setError(
        (e as Error).name === "AbortError"
          ? t("player.playback_preparation_cancelled")
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      if (controller.current === pending) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  const position = item.UserData?.PlaybackPositionTicks || 0;
  return (
    <div className="play-actions">
      {showSelections && (
        <PlaybackChoices
          sources={sources}
          source={preview}
          sourceId={effectiveSourceId}
          audio={audio}
          subtitle={subtitle}
          busy={busy}
          onSource={(id) => {
            setSourceId(id);
            setAudio("");
            setSubtitle("");
          }}
          onAudio={setAudio}
          onSubtitle={setSubtitle}
        />
      )}
      {!showSelections && (item.MediaSources?.length || 0) > 1 && (
        <label className="version-picker">
          {" "}
          {t("player.media_version")}{" "}
          <Select
            aria-label={t("player.media_version")}
            disabled={busy}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">{t("detail.auto_source")}</option>
            {item.MediaSources!.map((s) => (
              <option value={s.Id} key={s.Id}>
                {privateText(s.Name || t("player.video_version"))} ·{" "}
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
          concise
            ? `${position ? t("player.resume") : t("library.play")} ${item.Name}`
            : undefined
        }
        onClick={() => start(false)}
      >
        <Play size={17} />
        {busy
          ? t("player.preparing_playback")
          : position
            ? concise
              ? t("player.resume")
              : t("player.resume_2", { p0: formatTime(position / 10000000) })
            : t("library.play")}
      </button>
      {position > 0 && (
        <button
          disabled={busy}
          className="secondary compact"
          onClick={() => start(true)}
        >
          {" "}
          {t("player.play_from_beginning")}{" "}
        </button>
      )}
      {busy && (
        <button
          aria-label={t("player.cancel_playback_preparation")}
          onClick={() => controller.current?.abort()}
        >
          <X size={16} />
        </button>
      )}
      {error && (
        <p role="alert" className="play-error">
          {displayError(error)}
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
  onMiniChange,
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
  onMiniChange?: (active: boolean) => void;
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
  useI18n();

  const [state, setState] = useState<PlayerSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const fitOwner = useRef({ mounted: true, revision, state });
  fitOwner.current = { mounted: true, revision, state };
  const fitPending = useRef(false);
  const trackRevision = useRef({ subtitle: 0, audio: 0 });
  useEffect(() => {
    fitOwner.current.mounted = true;
    return () => {
      fitOwner.current.mounted = false;
    };
  }, []);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState("");
  const miniWindow = useMiniWindow(
    state?.playSessionId,
    state?.miniPresentation,
  );
  const presentation = useRef({ theater, mini: miniWindow.active });
  presentation.current = { theater, mini: miniWindow.active };
  const miniCallback = useRef(onMiniChange);
  miniCallback.current = onMiniChange;
  const previousMini = useRef(false);
  useEffect(() => {
    if (previousMini.current === miniWindow.active) return;
    previousMini.current = miniWindow.active;
    miniCallback.current?.(miniWindow.active);
  }, [miniWindow.active]);
  const presenting = theater || miniWindow.active;
  const [controlLayout, setControlLayout] = useState(() =>
    normalizeControlLayout(
      settings?.controlLayout ?? readSettings().controlLayout,
    ),
  );
  const danmaku = useDanmaku(
    api || null,
    item,
    !!(state?.active && state.loaded),
    state?.playSessionId,
    state?.duration,
  );
  const danmakuClock = useDanmakuClock(
    !!(
      danmaku.document &&
      !miniWindow.active &&
      danmaku.metadata.settings.enabled &&
      theater &&
      state?.active &&
      state.embedded &&
      state.loaded &&
      (!overlayOpen || miniWindow.active)
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
      setDiagnosticFeedback(t("player.anonymous_playback_diagnostics_copied"));
    } catch {
      setDiagnosticFeedback(
        t("library.could_not_copy_diagnostics_check_clipboard_permissions"),
      );
    }
  }
  const previous = useRef(false),
    stopCallback = useRef(onStopped);
  const canHide = !!(
    presenting &&
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
        setState((previous) =>
          !next.playSessionId &&
          previous?.embedded &&
          (presentation.current.theater || presentation.current.mini)
            ? { ...previous, active: false, loaded: false }
            : next,
        );
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
    if (action === "fullscreen") {
      const target = value === undefined ? !state?.fullscreen : value === 1;
      await invoke("player_control", {
        action,
        value: target ? 1 : 0,
        windowOnly: !!state?.embedded,
      });
      return;
    }
    const expected = playSessionId || state?.playSessionId;
    const ownerRevision = revision;
    const current = () =>
      fitOwner.current.mounted &&
      fitOwner.current.revision === ownerRevision &&
      fitOwner.current.state?.playSessionId === expected;
    if (action === "subtitle" || action === "audio") {
      const operation = ++trackRevision.current[action];
      if (!expected) throw Error("Playback session unavailable");
      setError("");
      try {
        await invoke("player_control", {
          action,
          value,
          expectedSessionId: expected,
        });
        if (!current() || operation !== trackRevision.current[action]) return;
        setState((s) =>
          s?.playSessionId === expected
            ? {
                ...s,
                secondarySubtitle:
                  action === "subtitle" && s.secondarySubtitle === value
                    ? undefined
                    : s.secondarySubtitle,
                tracks: s.tracks.map((track) =>
                  track.type === (action === "audio" ? "audio" : "sub")
                    ? {
                        ...track,
                        selected:
                          track.id === value ||
                          (action === "subtitle" &&
                            track.id === s.secondarySubtitle &&
                            value !== s.secondarySubtitle),
                        "main-selection": track.id === value ? 0 : undefined,
                      }
                    : track,
                ),
              }
            : s,
        );
      } catch (e) {
        if (current() && operation === trackRevision.current[action])
          setError(String(e));
        throw e;
      }
      return;
    }
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
                value,
              },
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
    presenting &&
    state?.embedded &&
    (state.active || miniWindow.active || queuePresentation?.busy) &&
    (!overlayOpen || miniWindow.active) &&
    "__TAURI_INTERNALS__" in window
  );
  // The 200 ms danmaku clock has its own Overlay channel. Only presentation
  // changes should publish a full control model to the owned WebView.
  const uiModel = useMemo<PlayerUiModel | null>(
    () =>
      state
        ? {
            state,
            mini: miniWindow.active,
            controlLayout,
            revision,
            theater: presenting,
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
            shortcutsBlocked: overlayOpen && !miniWindow.active,
            preview,
            danmaku: miniWindow.active ? undefined : danmaku.metadata,
            routeHint,
            previousDisabled,
            nextDisabled,
            capabilities: {
              return: !!(onTheater || onReturn),
              previous: !!onPrevious && (!item || item.Type === "Episode"),
              next: !!onNext && (!item || item.Type === "Episode"),
              restart: !!onRestart,
              versions:
                !!onSourceChange && (item?.MediaSources?.length || 0) > 1,
            },
            routes: routes || [],
            queue: queuePresentation,
          }
        : null,
    [
      state,
      miniWindow.active,
      controlLayout,
      revision,
      presenting,
      canHide,
      busy,
      error,
      diagnosticFeedback,
      item,
      sourceId,
      introSeconds,
      outroSeconds,
      settings?.shortcuts,
      settings?.quality?.inputConfig,
      overlayOpen,
      preview,
      danmaku.metadata,
      routeHint,
      previousDisabled,
      nextDisabled,
      onTheater,
      onReturn,
      onPrevious,
      onNext,
      onRestart,
      onSourceChange,
      routes,
      queuePresentation,
    ],
  );
  async function dispatchUi(action: PlayerAction) {
    switch (action.kind) {
      case "layout": {
        const layout = normalizeControlLayout(action.layout);
        saveSettings({ ...readSettings(), controlLayout: layout });
        setControlLayout(layout);
        break;
      }
      case "mini":
        await miniWindow.action(action.command, action.playSessionId);
        break;
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
      case "danmaku": {
        if (miniWindow.active) break;
        await danmaku.action(
          action.command,
          action.patch,
          action.query,
          action.matchId,
          action.matchScope,
        );
        break;
      }
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
  const overlayReady = usePlayerOverlay(
    nativeUi,
    uiModel,
    dispatchUi,
    {
      document: miniWindow.active ? null : danmaku.document,
      clock: miniWindow.active ? null : danmakuClock,
    },
    !miniWindow.active,
  );
  if (
    !state?.title ||
    (dismissed && !theater) ||
    (dock && !theater && !state.active && !miniWindow.active)
  )
    return null;
  return (
    <section
      hidden={miniWindow.active && !theater}
      className={
        miniWindow.active && !theater
          ? "player-native-owner"
          : `player-panel${theater ? " player-theater" : dock ? " player-dock" : ""}${state.embedded && state.fullscreen ? " player-fullscreen" : ""}`
      }
      aria-label={t("player.player_controls")}
    >
      {presenting && (
        <div className={theater ? "playback-stage" : undefined}>
          {!miniWindow.active &&
            state.embedded &&
            state.active &&
            (!nativeUi || !overlayReady) && (
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
          {state.embedded && (
            // Viewport owns the presentation, not an individual media session.
            <VideoViewport
              visible={
                !!(state.active || queuePresentation?.busy) && !overlayOpen
              }
              controls={nativeUi}
              detached={miniWindow.active}
            />
          )}
        </div>
      )}
      {uiModel && !miniWindow.active && (!nativeUi || !overlayReady) && (
        <PlayerChrome model={uiModel} dispatch={dispatchUi}>
          {theater && (!state.embedded || !state.active || !state.loaded) && (
            <div className="playback-stage-content">
              <MonitorPlay size={38} />
              <h1>{privateText(state.title)}</h1>
              <p>
                {state.active
                  ? state.loaded
                    ? t("player.video_is_playing_in_a_separate_window")
                    : t("player.preparing_video")
                  : state.finished
                    ? t("player.playback_finished")
                    : t("library.playback_stopped")}
              </p>
              <div>
                {state.active && !state.embedded ? (
                  <button
                    className="primary"
                    disabled={busy || !state.loaded}
                    onClick={() => void control("show")}
                  >
                    <MonitorPlay size={17} />{" "}
                    {t("player.show_video_window")}{" "}
                  </button>
                ) : !state.active && onRestart ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void changeEpisode(onRestart)}
                  >
                    {" "}
                    {t("player.play_again")}{" "}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </PlayerChrome>
      )}
      {!state.active && !theater && (
        <button
          className="player-close"
          aria-label={t("player.close_player_panel")}
          onClick={() => setDismissed(true)}
        >
          <X size={18} />
        </button>
      )}
    </section>
  );
}
