import { t, localizeMessage } from "../i18n/core";
import DanmakuHeatmap from "./DanmakuHeatmap";
import ControlLayoutSettings from "./ControlLayoutSettings";
import {
  normalizeControlLayout,
  visibleControls,
  type OptionalControl,
} from "../player/controlLayout";
import { useI18n } from "../i18n/react";
import Select from "./Select";
import {
  normalizeVideoFit,
  videoFitLabels,
  videoFitModes,
} from "../player/videoFit";
import DanmakuSettings from "./DanmakuSettings";
import OnlineDanmakuMenu from "./OnlineDanmakuMenu";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Gauge,
  Headphones,
  ListVideo,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Subtitles,
  MessageSquareText,
  Volume2,
  VolumeX,
  X,
  Network,
  Layers,
  BookOpen,
  Pin,
  PictureInPicture2,
} from "lucide-react";
import { usePlayerChrome } from "../player/usePlayerChrome";
import { usePlayerCursor } from "../player/usePlayerCursor";
import { usePlayerPopover } from "../player/usePlayerPopover";
import { playerMotionStyle } from "../player/motion";
import { formatTime } from "../player/formatTime";
import type {
  PlayerAction,
  PlayerMenu,
  PlayerUiModel,
} from "../player/uiModel";
import { privateText, displayError } from "../privacy";
import { isEditableTarget, isComposingKey } from "../player/shortcuts";
import Tooltip from "./Tooltip";
import PlayerSlider from "./PlayerSlider";
import SubtitleSlider from "./SubtitleSlider";
import SecondarySubtitlePosition from "./SecondarySubtitlePosition";
import { playbackResolution } from "../player/resolution";
import Toast, { type ToastTone } from "./Toast";
import { identifyQuality } from "../player/quality";
import {
  blockedShortcut,
  keyCode,
  shortcutAction,
  validKey,
} from "../player/shortcuts";
import { activeSegment, skipSegments } from "../player/segments";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const titles: Record<PlayerMenu, string> = {
  get layout() {
    return t("player.control_layout");
  },
  get danmaku() {
    return t("player.danmaku");
  },
  get subtitle() {
    return t("player.subtitles");
  },
  get "subtitle-settings"() {
    return t("player.subtitle_size_position_and_delay");
  },
  get audio() {
    return t("player.audio_tracks");
  },
  get volume() {
    return t("player.volume");
  },
  get more() {
    return t("player.more");
  },
  get speed() {
    return t("player.playback_speed");
  },
  get chapters() {
    return t("player.chapters");
  },
  get loop() {
    return t("player.a_b_loop");
  },
  get routes() {
    return t("player.playback_routes");
  },
  get versions() {
    return t("player.media_version");
  },
  get settings() {
    return t("player.playback_settings");
  },
  get queue() {
    return t("player.play_queue");
  },
};

export function contextPlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const margin = 10;
  return {
    left: Math.max(margin, Math.min(x, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(y, viewportHeight - height - margin)),
  };
}

export default function PlayerChrome({
  model,
  dispatch,
  owned = false,
  children,
}: {
  model: PlayerUiModel;
  dispatch: (action: PlayerAction) => Promise<void>;
  owned?: boolean;
  children?: ReactNode;
}) {
  useI18n();

  const { state } = model,
    popover = usePlayerPopover();
  const layout = normalizeControlLayout(model.controlLayout);
  const tools: readonly OptionalControl[] = model.mini
    ? []
    : visibleControls(layout);
  const hasTool = (id: OptionalControl) => tools.includes(id);
  const mediaQuality =
    state.playMethod === "Transcode" || state.videoParams?.gamma
      ? identifyQuality(undefined, state.videoParams)
      : state.mediaQuality;
  const [editing, setEditing] = useState(false),
    [pendingOperation, setPendingOperation] = useState<{
      action: PlayerAction;
      menu: PlayerMenu | null;
    } | null>(null),
    [localError, setLocalError] = useState("");
  const [subtitlePositionEdit, setSubtitlePositionEdit] = useState<{
    value: number;
    revision: number;
    session?: string;
  } | null>(null);
  const settledSubtitlePosition = useRef<typeof subtitlePositionEdit>(null);
  useEffect(() => {
    const settled = settledSubtitlePosition.current;
    if (
      settled &&
      (settled.revision !== model.revision ||
        settled.session !== state.playSessionId ||
        settled.value === state.secondarySubtitlePosition)
    )
      settledSubtitlePosition.current = null;
  });
  const positioning =
    !!subtitlePositionEdit &&
    state.active &&
    subtitlePositionEdit.revision === model.revision &&
    subtitlePositionEdit.session === state.playSessionId;
  const [hover, setHover] = useState<{ time: number; left: number } | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  const singleCommitted = useRef(false),
    suppressClick = useRef(false);
  const [placement, setPlacement] = useState<CSSProperties>({
    right: 16,
    bottom: 92,
  });
  const [contextPoint, setContextPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dismissActiveOverlay = (restoreFocus = true) => {
    clearTimeout(clickTimer.current);
    popover.close(restoreFocus);
  };
  useEffect(() => {
    if (!popover.menu) return;
    const outside = (event: PointerEvent) => {
      if (
        event.button === 2 ||
        !(event.target instanceof Element) ||
        event.target.closest(".player-popover,[data-ui-overlay]") ||
        popover.anchor.current?.contains(event.target)
      )
        return;
      suppressClick.current = !event.target.closest(
        "button,input,select,a,[role=button]",
      );
      dismissActiveOverlay(false);
    };
    document.addEventListener("pointerdown", outside, true);
    const dismissFromMain = () => dismissActiveOverlay(false);
    document.addEventListener("player-overlay-dismiss", dismissFromMain);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("player-overlay-dismiss", dismissFromMain);
    };
  }, [popover.menu, popover.close]);
  const pending = !!pendingOperation;
  const pendingAction = pendingOperation?.action;
  const pendingMenu =
    pendingAction?.kind === "control"
      ? (
          {
            volume: "volume",
            mute: "volume",
            speed: "speed",
            subtitle: "subtitle",
            audio: "audio",
          } as Record<string, PlayerMenu>
        )[pendingAction.action]
      : pendingAction?.kind === "danmaku"
        ? "danmaku"
        : pendingOperation?.menu;
  const trackPending =
    pendingAction?.kind === "control" &&
    ["subtitle", "audio"].includes(pendingAction.action);
  const busy = model.busy || (pending && !trackPending);
  const [notice, setNotice] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  useEffect(() => {
    const status = model.danmaku?.status;
    if (!status || model.danmaku?.loading) return;
    setNotice({
      message: status,
      tone:
        status.startsWith(
          t(
            "danmaku.danmaku_loaded_comments",
            { p0: "", p1: "" },
            "zh-CN",
          ).split(" · ")[0],
        ) || status.startsWith("Danmaku loaded")
          ? "success"
          : status === t("danmaku.danmaku_file_unlinked", undefined, "zh-CN") ||
              status === t("danmaku.danmaku_file_unlinked", undefined, "en-US")
            ? "info"
            : "warning",
    });
  }, [model.danmaku?.status, model.danmaku?.loading]);
  const segment = activeSegment(
    skipSegments(
      model.item,
      state.duration,
      model.introSeconds,
      model.outroSeconds,
    ),
    state.position,
  );
  const [dismissedSkip, setDismissedSkip] = useState("");
  const skipKey = segment
    ? `${model.revision}:${segment.kind}:${segment.start}:${segment.end}`
    : "";
  const skipVisible =
    !!segment && dismissedSkip !== skipKey && state.active && state.loaded;
  useEffect(() => {
    if (!segment) return;
    const timer = setTimeout(() => setDismissedSkip(skipKey), 10000);
    return () => clearTimeout(timer);
  }, [skipKey]);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const hadHover = useRef(false);
  useEffect(() => {
    if (!hover && !hadHover.current) return;
    hadHover.current = !!hover;
    const timer = setTimeout(
      () =>
        void dispatchRef
          .current({ kind: "preview", time: hover?.time ?? null })
          .catch(() => {}),
      hover ? 80 : 0,
    );
    return () => clearTimeout(timer);
  }, [hover?.time, model.revision]);
  useEffect(() => {
    if (owned || !isTauri()) return;
    let active = true,
      remove: (() => void) | undefined;
    void listen<{ key: string; code: string; shiftKey?: boolean }>(
      "player-ui-key",
      ({ payload }) => {
        if (active)
          document.body.dispatchEvent(
            new KeyboardEvent("keydown", {
              ...payload,
              bubbles: true,
              cancelable: true,
            }),
          );
      },
      { target: "main" },
    )
      .then((fn) => (active ? (remove = fn) : fn()))
      .catch(() => {});
    return () => {
      active = false;
      remove?.();
    };
  }, [owned]);
  const actionPending = useRef(false);
  const miniExitPending = useRef(false);
  const [leavingMini, setLeavingMini] = useState(false);
  const miniExitOwner = useRef(0);
  const trackOperation = useRef(0);
  const trackOwner = useRef({
    revision: model.revision,
    session: state.playSessionId,
  });
  trackOwner.current = {
    revision: model.revision,
    session: state.playSessionId,
  };
  useEffect(() => {
    trackOperation.current++;
    setPendingOperation((p) =>
      p?.action.kind === "control" &&
      ["subtitle", "audio"].includes(p.action.action)
        ? null
        : p,
    );
    return () => {
      trackOperation.current++;
    };
  }, [model.revision, state.playSessionId]);
  useEffect(() => {
    miniExitOwner.current++;
    miniExitPending.current = false;
    setLeavingMini(false);
    return () => {
      miniExitOwner.current++;
    };
  }, [model.revision, model.mini, state.playSessionId]);
  useEffect(() => {
    popover.reset();
    clearTimeout(clickTimer.current);
    singleCommitted.current = false;
    setEditing(false);
    setHover(null);
  }, [model.revision, model.mini, popover.reset]);
  const chrome = usePlayerChrome(
    model.canHide,
    !!(
      state.paused ||
      state.buffering ||
      state.error ||
      state.syncError ||
      model.error ||
      busy ||
      editing ||
      positioning ||
      popover.menu ||
      model.routeHint
    ),
    model.revision,
    !!popover.menu || editing || positioning,
    owned ? "player-ui" : "main",
    !!model.mini,
  );
  usePlayerCursor(owned, chrome.cursorHidden);
  const run = async (action: PlayerAction, close = false) => {
    if (action.kind === "control" && action.action === "fullscreen") {
      try {
        await dispatch(action);
      } catch {
        setLocalError(t("player.the_action_could_not_be_completed_try"));
      }
      return;
    }
    if (
      action.kind === "control" &&
      (action.action === "subtitle" || action.action === "audio")
    ) {
      const operation = ++trackOperation.current,
        session = state.playSessionId,
        revision = model.revision,
        menu = popover.menu;
      const current = () =>
        operation === trackOperation.current &&
        revision === trackOwner.current.revision &&
        session === trackOwner.current.session;
      const request = { ...action, playSessionId: session };
      setPendingOperation({ action: request, menu });
      setLocalError("");
      try {
        await dispatch(request);
        if (current() && close) popover.closeFor(menu);
      } catch {
        if (current())
          setLocalError(t("player.the_action_could_not_be_completed_try"));
      } finally {
        if (current())
          setPendingOperation((p) => (p?.action === request ? null : p));
      }
      return;
    }
    // Leaving the presentation never waits for a control or network operation.
    if (action.kind === "mini" && action.command === "leave") {
      if (miniExitPending.current) return;
      miniExitPending.current = true;
      const owner = miniExitOwner.current;
      setLeavingMini(true);
      setLocalError("");
      try {
        await dispatch(action);
      } catch {
        if (owner === miniExitOwner.current)
          setLocalError(t("player.the_action_could_not_be_completed_try"));
      } finally {
        if (owner === miniExitOwner.current) {
          miniExitPending.current = false;
          setLeavingMini(false);
        }
      }
      return;
    }
    if (busy || actionPending.current) return;
    const requestMenu = popover.menu;
    actionPending.current = true;
    const operation = { action, menu: popover.menu };
    setPendingOperation(operation);
    setLocalError("");
    try {
      await dispatch(action);
      if (close) popover.closeFor(requestMenu);
    } catch {
      setLocalError(t("player.the_action_could_not_be_completed_try"));
    } finally {
      actionPending.current = false;
      setPendingOperation((p) => (p === operation ? null : p));
    }
  };
  const control = (action: string, value?: number, close = false) =>
    void run({ kind: "control", action, value }, close);
  const full = () =>
    control(
      "fullscreen",
      state.embedded ? (state.fullscreen ? 0 : 1) : undefined,
    );
  const mini = (command: "enter" | "leave" | "pin") => {
    if (state.playSessionId)
      void run({ kind: "mini", command, playSessionId: state.playSessionId });
  };
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (isComposingKey(e)) return;
      if (
        e.defaultPrevented ||
        (e.target instanceof Element && e.target.closest("[data-ui-overlay]"))
      )
        return;
      if (model.shortcutsBlocked) return;
      if (positioning) return;
      if (e.key === "Escape" && popover.menu) {
        e.preventDefault();
        dismissActiveOverlay();
        return;
      }
      if (e.key === "Escape" && model.mini && !blockedShortcut(e)) {
        e.preventDefault();
        mini("leave");
        return;
      }
      if (
        e.key === "Escape" &&
        state.embedded &&
        state.fullscreen &&
        !blockedShortcut(e)
      ) {
        e.preventDefault();
        control("fullscreen", 0);
        return;
      }
      if (popover.menu || blockedShortcut(e)) return;
      const action = shortcutAction(e, model.shortcuts);
      if (action === "fullscreen") {
        e.preventDefault();
        full();
        return;
      }
      if (!state.active || !state.loaded) return;
      if (action) {
        e.preventDefault();
        if (action === "pause") control("pause");
        else if (action === "mute") control("mute");
        else if (action === "backward" || action === "forward")
          control(
            "seek",
            Math.max(
              0,
              Math.min(
                state.duration,
                state.position + (action === "forward" ? 10 : -10),
              ),
            ),
          );
        else if (action === "subtitle" || action === "audio")
          open(
            action,
            root.current?.querySelector<HTMLButtonElement>(
              `button[aria-label="${action === "subtitle" ? t("player.subtitles") : t("player.audio_tracks")}"]`,
            ) || undefined,
          );
        else if (
          action === "next" &&
          model.capabilities.next &&
          !model.nextDisabled
        )
          void run({ kind: "next" });
        else if (
          action === "previous" &&
          model.capabilities.previous &&
          !model.previousDisabled
        )
          void run({ kind: "previous" });
      } else if (model.inputConfig && validKey(keyCode(e))) {
        e.preventDefault();
        void run({ kind: "mpv-key", code: keyCode(e) });
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [
    state,
    model.busy,
    pending,
    model.shortcuts,
    model.inputConfig,
    model.shortcutsBlocked,
    model.mini,
    positioning,
    popover.menu,
    popover.close,
  ]);
  useLayoutEffect(() => {
    if (!popover.menu || !root.current) return;
    const place = () => {
      const r = root.current!.getBoundingClientRect(),
        a = popover.anchor.current?.getBoundingClientRect();
      const width = Math.min(
        popover.menu === "volume"
          ? 220
          : popover.menu === "danmaku"
            ? 520
            : 300,
        r.width - 24,
      );
      if (model.mini) {
        // Reserve the bottom action row, including Exit Mini, even for a
        // context menu in the minimum 320×180 client area.
        const bottom = 48;
        setPlacement({
          width,
          left: Math.max(
            12,
            Math.min(
              r.width - width - 12,
              a ? a.right - r.left - width : contextPoint?.x || 12,
            ),
          ),
          bottom,
          maxHeight: Math.max(0, r.height - bottom - 8),
        });
        return;
      }
      if (contextPoint) {
        const height = Math.min(
          panel.current?.offsetHeight || 440,
          r.height - 20,
        );
        setPlacement({
          width,
          maxHeight: Math.max(0, r.height - 20),
          ...contextPlacement(
            contextPoint.x,
            contextPoint.y,
            width,
            height,
            r.width,
            r.height,
          ),
        });
        return;
      }
      if (!a) return;
      setPlacement({
        width,
        left: Math.max(
          12,
          Math.min(r.width - width - 12, a.right - r.left - width),
        ),
        bottom: Math.max(88, r.bottom - a.top + 12),
      });
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(root.current);
    if (panel.current) observer?.observe(panel.current);
    return () => observer?.disconnect();
  }, [popover.menu, contextPoint, model.mini]);
  useEffect(() => {
    if (!popover.menu || popover.phase === "closing") return;
    const frame = requestAnimationFrame(() =>
      (
        panel.current?.querySelector<HTMLElement>('[aria-checked="true"]') ||
        panel.current?.querySelector<HTMLElement>(
          ".player-popover-scroll button:not(:disabled), .player-popover-scroll input:not(:disabled)",
        ) ||
        panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      )?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [popover.menu]);
  const open = (menu: PlayerMenu, anchor?: HTMLButtonElement) => {
    if (model.mini && menu !== "speed") return;
    if (anchor) setContextPoint(null);
    chrome.reveal();
    popover.open(menu, anchor);
  };
  const icon = (
    label: string,
    art: ReactNode,
    onClick: () => void,
    disabled = false,
    extra: Record<string, unknown> = {},
  ) => (
    <Tooltip text={label}>
      <button
        aria-label={label}
        title={label}
        disabled={disabled}
        aria-busy={false}
        onClick={onClick}
        {...extra}
      >
        {art}
      </button>
    </Tooltip>
  );
  const menuButton = (label: string, art: ReactNode, menu: PlayerMenu) => (
    <Tooltip text={label}>
      <button
        aria-label={label}
        title={label}
        aria-expanded={
          (popover.menu === menu ||
            (menu === "subtitle" && popover.menu === "subtitle-settings")) &&
          popover.phase !== "closing"
        }
        aria-controls="player-popover"
        disabled={model.busy || !state.loaded}
        aria-busy={pending && pendingMenu === menu}
        onClick={(e) => open(menu, e.currentTarget)}
      >
        {art}
      </button>
    </Tooltip>
  );
  const option = (label: string, selected: boolean, onClick: () => void) => (
    <button
      className="player-choice"
      role="menuitemradio"
      aria-checked={selected}
      disabled={
        model.busy ||
        (!(popover.menu === "subtitle" || popover.menu === "audio") &&
          pending) ||
        !state.loaded
      }
      onClick={onClick}
    >
      <span className="choice-mark">{selected && <Check size={16} />}</span>
      <span>{label}</span>
    </button>
  );
  const entry = (
    label: string,
    art: ReactNode,
    menu: PlayerMenu,
    detail?: string,
  ) => (
    <button role="menuitem" onClick={() => open(menu)}>
      <span className="menu-entry-icon">{art}</span>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
      <ChevronRight size={15} />
    </button>
  );
  const tracks = (type: string) => state.tracks.filter((t) => t.type === type);
  const selectedTrack = (type: string) =>
    tracks(type).find(
      (t) =>
        t["main-selection"] === 0 ||
        (t.selected && t.id !== state.secondarySubtitle),
    )?.id ?? -1;
  const trackLabel = (track: (typeof state.tracks)[number]) =>
    privateText(
      track.title ||
        track.lang ||
        `${track.type === "audio" ? t("player.audio_tracks") : t("player.subtitles")} ${track.id}`,
    );
  const subtitleSettings = (
    <div className="player-setting-fields">
      <div className="player-setting-row">
        <span>{t("player.secondary_subtitles")}</span>
        <Select
          aria-label={t("player.secondary_subtitles")}
          value={state.secondarySubtitle ?? -1}
          disabled={busy || !state.loaded}
          onChange={(e) => control("secondarySubtitle", Number(e.target.value))}
        >
          <option value={-1}>{t("player.off")}</option>
          {tracks("sub")
            .filter((t) => t.id !== selectedTrack("sub"))
            .map((t) => (
              <option value={t.id} key={t.id}>
                {trackLabel(t)}
              </option>
            ))}
        </Select>
      </div>
      <SubtitleSlider
        key={`scale-${model.revision}`}
        label={t("player.subtitle_size")}
        min={0.6}
        max={1.8}
        step={0.01}
        value={state.subtitleScale || 1}
        disabled={!state.loaded || model.busy}
        send={(value, persist) =>
          dispatch({ kind: "control", action: "subtitleScale", value, persist })
        }
      />
      <SubtitleSlider
        key={`secondary-scale-${model.revision}`}
        label={t("player.secondary_subtitle_scale")}
        min={0.5}
        max={2}
        step={0.01}
        value={state.secondarySubtitleScale ?? 1}
        disabled={!state.loaded || model.busy}
        send={(value, persist) =>
          dispatch({
            kind: "control",
            action: "secondarySubtitleScale",
            value,
            persist,
            playSessionId: state.playSessionId,
          })
        }
      />
      <button
        disabled={busy || !state.loaded || !state.embedded}
        onClick={() => {
          setSubtitlePositionEdit({
            // IPC acknowledgements can arrive before the next native snapshot.
            value:
              settledSubtitlePosition.current?.value ??
              state.secondarySubtitlePosition ??
              0,
            revision: model.revision,
            session: state.playSessionId,
          });
          popover.reset();
        }}
      >
        {t("player.secondary_subtitle_position")}
      </button>
      <p className="player-menu-note">{t("player.secondary_subtitle_help")}</p>
      {(
        [
          [
            t("player.subtitle_delay"),
            "subtitleDelay",
            state.subtitleDelay || 0,
            -30,
            30,
            0.5,
          ],
        ] as const
      ).map(([label, action, value, min, max, step]) => (
        <label key={action}>
          {label}
          {t("player.seconds")}{" "}
          <input
            aria-label={label}
            type="number"
            key={value}
            defaultValue={value}
            min={min}
            max={max}
            step={step}
            disabled={busy || !state.loaded}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= min && n <= max)
                control(action, n);
            }}
          />
        </label>
      ))}
      <SubtitleSlider
        key={`position-${model.revision}`}
        label={t("player.subtitle_vertical_position")}
        min={0}
        max={100}
        value={state.subtitlePosition ?? 100}
        disabled={!state.loaded || model.busy}
        send={(value, persist) =>
          dispatch({
            kind: "control",
            action: "subtitlePosition",
            value,
            persist,
          })
        }
      />
      <button disabled={busy} onClick={() => control("subtitlePosition", 100)}>
        <RotateCcw size={16} /> {t("player.reset_subtitle_position")}{" "}
      </button>
      <p className="player-menu-note">
        {" "}
        {t("player.size_and_position_apply_to_text_subtitles")}{" "}
      </p>
    </div>
  );
  const settings = (
    <div className="player-setting-fields">
      <div className="player-setting-row">
        <span>{t("player.video_fit")}</span>
        <Select
          aria-label={t("player.video_fit")}
          value={state.videoFit || "fit"}
          disabled={busy || !state.loaded || !state.playSessionId}
          onChange={(e) =>
            void run({
              kind: "video-fit",
              mode: normalizeVideoFit(e.target.value),
              playSessionId: state.playSessionId!,
            })
          }
        >
          {videoFitModes.map((mode) => (
            <option key={mode} value={mode}>
              {videoFitLabels[mode]}
            </option>
          ))}
        </Select>
      </div>
      <p className="player-menu-note">{t("player.video_fit_help")}</p>
      <label className="player-check">
        <input
          type="checkbox"
          checked={!chrome.pinned}
          onChange={(e) => chrome.pin(!e.target.checked)}
        />{" "}
        {t("player.auto_hide_controls")}{" "}
      </label>
      <button
        aria-label={t("player.keep_video_window_on_top")}
        aria-pressed={!!state.ontop}
        disabled={busy || !state.loaded}
        onClick={() => control("ontop")}
      >
        <Pin size={16} />
        {state.ontop
          ? t("player.disable_always_on_top")
          : t("player.always_on_top")}
      </button>
      <label>
        {t("player.audio_delay")} {t("player.seconds")}
        <input
          aria-label={t("player.audio_delay")}
          type="number"
          key={state.audioDelay || 0}
          defaultValue={state.audioDelay || 0}
          min={-10}
          max={10}
          step={0.1}
          disabled={busy || !state.loaded}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= -10 && n <= 10)
              control("audioDelay", n);
          }}
        />
      </label>
      {state.bufferSeconds !== undefined && (
        <small>
          {t("player.buffered_seconds", {
            seconds: Math.round(state.bufferSeconds),
          })}
        </small>
      )}
      {mediaQuality && (
        <div className="player-menu-note">
          <p>
            {t("player.playback_method")}
            {state.playMethod === "DirectStream"
              ? t("player.direct_stream")
              : state.playMethod === "Transcode"
                ? t("player.transcoding")
                : state.playMethod === "DirectPlay"
                  ? t("player.direct_play")
                  : "Unknown"}
          </p>
          <p>
            {" "}
            {t("player.media")}
            {mediaQuality.hdr} ·{" "}
            {mediaQuality.bitDepth
              ? `${mediaQuality.bitDepth}bit`
              : t("player.bit_depth_unknown")}{" "}
            · {mediaQuality.primaries}
          </p>
          <p>
            Windows HDR：
            {state.windowsHdr?.hdr === true
              ? t("player.on")
              : state.windowsHdr?.hdr === false
                ? t("player.off")
                : "Unknown"}
          </p>
          <p>
            {" "}
            {t("player.output_policy")}{" "}
            {state.outputPolicy === "source"
              ? t("player.unmodified_output")
              : state.outputPolicy === "sdr"
                ? "HDR → SDR"
                : t("player.auto")}{" "}
            · {state.renderer || "Unknown"}
          </p>
          {!!state.videoOutput?.gamma && (
            <p>
              {" "}
              {t("player.actual_output")}
              {String(state.videoOutput.gamma)} ·{" "}
              {String(state.videoOutput.primaries || "Unknown")}
            </p>
          )}
          {state.requestedOutputPolicy === "source" &&
            state.outputPolicy === "auto" && (
              <p>
                {t(
                  "player.unmodified_output_requires_system_hdr_currently_falling",
                )}
              </p>
            )}
          {state.audioFallback && (
            <p>{t("player.tried_the_default_audio_device_and_pcm")}</p>
          )}
          {mediaQuality.hdr === "Dolby Vision" && (
            <p>{t("player.dolby_vision_information_is_recognized_full_dv")}</p>
          )}
        </div>
      )}
    </div>
  );
  const content: Record<PlayerMenu, ReactNode> = {
    layout: (
      <ControlLayoutSettings
        value={layout}
        disabled={busy}
        change={(layout) => void run({ kind: "layout", layout })}
      />
    ),
    danmaku: model.danmaku ? (
      <>
        <OnlineDanmakuMenu value={model.danmaku} dispatch={run} />
        <small>
          {" "}
          {t("player.local_file")}{" "}
          {model.danmaku.source === "online"
            ? t("player.using_online_danmaku")
            : ""}
        </small>
        <div className="player-menu-note">
          <strong>
            {model.danmaku.name || t("player.no_danmaku_source_selected")}
          </strong>
          <p role="status">
            {localizeMessage(
              model.danmaku.status ||
                t("player.select_a_local_bilibili_xml_or_ass"),
            )}
          </p>
          {!state.embedded && (
            <p>{t("player.local_danmaku_appears_in_the_embedded_player")}</p>
          )}
        </div>
        <div className="danmaku-file-actions">
          <button
            disabled={busy || model.danmaku.loading || !state.embedded}
            onClick={() => void run({ kind: "danmaku", command: "choose" })}
          >
            {model.danmaku.bound
              ? t("player.choose_another_file")
              : t("player.choose_local_file")}
          </button>
          {model.danmaku.bound && (
            <button
              disabled={busy || model.danmaku.loading}
              onClick={() => void run({ kind: "danmaku", command: "unbind" })}
            >
              {" "}
              {t("player.unlink_file")}{" "}
            </button>
          )}
        </div>
        <fieldset disabled={busy || model.danmaku.loading}>
          <small>{t("player.timing_danmaku_settings")}</small>
          <DanmakuSettings
            value={{ ...model.danmaku.settings, offset: model.danmaku.offset }}
            onChange={(patch) =>
              patch.opacity !== undefined
                ? void dispatch({
                    kind: "danmaku",
                    command: "settings",
                    patch,
                  }).catch(() => setLocalError(t("danmaku.opacity_failed")))
                : void run({ kind: "danmaku", command: "settings", patch })
            }
          />
        </fieldset>
      </>
    ) : (
      <p className="player-menu-note">
        {t("player.local_danmaku_is_available_only_in_the")}
      </p>
    ),
    subtitle: (
      <>
        {option(t("player.subtitles_off"), selectedTrack("sub") === -1, () =>
          control("subtitle", -1, true),
        )}
        {[false, true].map((external) => (
          <div className="player-menu-group" key={String(external)}>
            <small>
              {t(
                external
                  ? "player.external_subtitles"
                  : "player.embedded_subtitles",
              )}
            </small>
            {tracks("sub")
              .filter((track) => !!track.external === external)
              .map((track) => (
                <div key={track.id}>
                  {option(
                    trackLabel(track),
                    selectedTrack("sub") === track.id,
                    () => control("subtitle", track.id, true),
                  )}
                </div>
              ))}
            {external && !tracks("sub").some((track) => track.external) && (
              <p className="player-menu-note">
                {t("player.external_subtitles_help")}
              </p>
            )}
          </div>
        ))}
        {!tracks("sub").length && (
          <p className="player-menu-note">
            {t("player.no_subtitles_available_for_this_video")}
          </p>
        )}
        <button
          className="player-menu-footer"
          onClick={() => open("subtitle-settings")}
        >
          {" "}
          {t("player.subtitle_size_position_and_delay")}{" "}
          <ChevronRight size={15} />
        </button>
      </>
    ),
    "subtitle-settings": subtitleSettings,
    audio: (
      <>
        {option(t("player.audio_off"), selectedTrack("audio") === -1, () =>
          control("audio", -1, true),
        )}
        {tracks("audio").map((t) => (
          <div key={t.id}>
            {option(trackLabel(t), !!t.selected, () =>
              control("audio", t.id, true),
            )}
          </div>
        ))}
        {!tracks("audio").length && (
          <p className="player-menu-note">
            {t("player.no_audio_tracks_available_for_this_video")}
          </p>
        )}
      </>
    ),
    volume: (
      <div className="player-volume-content">
        {icon(
          t("player.mute"),
          state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />,
          () => control("mute"),
          busy,
          { "aria-pressed": state.muted },
        )}
        <PlayerSlider
          label={t("player.volume")}
          max={100}
          value={state.volume}
          disabled={busy}
          onEditing={setEditing}
          commit={(n) => control("volume", n)}
        />
        <output>{Math.round(state.volume)}%</output>
      </div>
    ),
    more: (
      <>
        <div className="player-menu-group">
          <small>{t("library.play")}</small>
          {!hasTool("speed") &&
            entry(
              t("player.speed"),
              <Gauge size={17} />,
              "speed",
              `${state.speed || 1}×`,
            )}
          {!model.mini &&
            model.danmaku &&
            !hasTool("danmaku") &&
            entry(
              t("player.danmaku"),
              <MessageSquareText size={17} />,
              "danmaku",
              model.danmaku.settings.enabled
                ? t("player.show")
                : t("player.off"),
            )}
          {!!model.item?.Chapters?.length &&
            entry(t("player.chapters"), <BookOpen size={17} />, "chapters")}
          {entry(t("player.a_b_loop"), <Repeat2 size={17} />, "loop")}
          {!!model.queue?.items.length &&
            entry(t("player.play_queue"), <ListVideo size={17} />, "queue")}
        </div>
        {(["volume", "audio", "subtitle"] as const).some(
          (id) => !hasTool(id),
        ) && (
          <div className="player-menu-group">
            <small>{t("player.audio_and_subtitles")}</small>
            {!hasTool("volume") &&
              entry(t("player.volume"), <Volume2 size={17} />, "volume")}
            {!hasTool("audio") &&
              entry(
                t("player.audio_tracks"),
                <Headphones size={17} />,
                "audio",
              )}
            {!hasTool("subtitle") &&
              entry(t("player.subtitles"), <Subtitles size={17} />, "subtitle")}
          </div>
        )}
        {(!hasTool("mini") || !hasTool("fullscreen")) && (
          <div className="player-menu-group">
            <small>{t("player.picture_and_window")}</small>
            {!model.mini &&
              !hasTool("mini") &&
              state.embedded &&
              state.playSessionId &&
              isTauri() && (
                <button
                  role="menuitem"
                  disabled={busy || !state.loaded}
                  onClick={() => mini(model.mini ? "leave" : "enter")}
                >
                  <PictureInPicture2 size={17} />
                  <span>
                    {model.mini
                      ? t("player.restore_player")
                      : t("player.mini_window")}
                  </span>
                </button>
              )}
            {!hasTool("fullscreen") && (
              <button
                role="menuitem"
                disabled={busy || !state.loaded}
                onClick={full}
              >
                <Maximize size={17} />
                <span>
                  {state.fullscreen
                    ? t("player.exit_fullscreen")
                    : t("danmaku.fullscreen")}
                </span>
              </button>
            )}
          </div>
        )}
        {(model.routes.length > 0 || model.capabilities.versions) && (
          <div className="player-menu-group">
            <small>{t("player.source")}</small>
            {model.routes.length > 0 &&
              entry(
                t("player.routes"),
                <Network size={17} />,
                "routes",
                model.routes.find((r) => r.selected)?.name,
              )}
            {model.capabilities.versions &&
              entry(
                t("player.media_version"),
                <Layers size={17} />,
                "versions",
              )}
          </div>
        )}
        <div className="player-menu-group">
          <small>{t("player.advanced")}</small>
          {entry(
            t("player.control_layout"),
            <SlidersHorizontal size={17} />,
            "layout",
          )}
          {entry(
            t("player.playback_settings"),
            <SlidersHorizontal size={17} />,
            "settings",
          )}
        </div>
        <div className="player-menu-group">
          <button
            role="menuitem"
            className="player-danger"
            disabled={busy}
            onClick={() => control("stop", undefined, true)}
          >
            <Square size={16} />
            <span>{t("player.stop_playback")}</span>
          </button>
        </div>
      </>
    ),
    speed: (
      <>
        {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((n) => (
          <div key={n}>
            {option(`${n}×`, (state.speed || 1) === n, () =>
              control("speed", n, true),
            )}
          </div>
        ))}
      </>
    ),
    chapters: (
      <>
        {model.item?.Chapters?.map((c, i) => (
          <button
            key={i}
            role="menuitem"
            disabled={busy || !state.loaded}
            onClick={() =>
              control("seek", c.StartPositionTicks / 10000000, true)
            }
          >
            <span>
              {privateText(c.Name || t("player.chapter", { p0: i + 1 }))}
            </span>
            <small>{formatTime(c.StartPositionTicks / 10000000)}</small>
          </button>
        ))}
      </>
    ),
    loop: (
      <div className="player-loop-popover">
        <p>{t("player.set_loop_points_at_the_current_playback")}</p>
        <button
          disabled={busy || !state.loaded}
          onClick={() => control("loopA", state.position)}
        >
          {" "}
          {t("player.set_a")}{" "}
          {state.loopA !== undefined ? ` · ${formatTime(state.loopA)}` : ""}
        </button>
        <button
          disabled={busy || state.loopA === undefined || !state.loaded}
          onClick={() => control("loopB", state.position)}
        >
          {" "}
          {t("player.set_b")}{" "}
          {state.loopB !== undefined ? ` · ${formatTime(state.loopB)}` : ""}
        </button>
        <button disabled={busy} onClick={() => control("clearLoop")}>
          {" "}
          {t("player.clear_loop")}{" "}
        </button>
      </div>
    ),
    routes: (
      <>
        {model.routes.map((r, i) => (
          <div key={i} title={r.detail}>
            {option(
              r.name + (r.quality ? ` · ${r.quality}` : ""),
              r.selected,
              () => void run({ kind: "route", index: i }, true),
            )}
            <div className="route-probe-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run({ kind: "route-probe", index: i, media: false })
                }
              >
                {" "}
                {t("player.check_api")}{" "}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run({ kind: "route-probe", index: i, media: true })
                }
              >
                {" "}
                {t("player.sample_throughput")}{" "}
              </button>
            </div>
          </div>
        ))}
        <p className="player-menu-note">
          {" "}
          {t("player.playback_resumes_at_the_current_position_after")}{" "}
        </p>
      </>
    ),
    versions: (
      <>
        {model.item?.MediaSources?.map((s) => (
          <div key={s.Id}>
            {option(
              privateText(s.Name || s.Container || t("player.video_version")),
              s.Id === model.sourceId,
              () => void run({ kind: "source", id: s.Id }, true),
            )}
          </div>
        ))}
      </>
    ),
    settings,
    queue: (
      <>
        <label className="player-check">
          <input
            type="checkbox"
            checked={model.queue?.autoNext}
            onChange={(e) =>
              void run({ kind: "auto-next", value: e.target.checked })
            }
          />{" "}
          {t("player.auto_play_next_episode")}{" "}
        </label>
        {model.queue?.items
          .slice(Math.max(0, model.queue.index - 1), model.queue.index + 8)
          .map((item, n) => {
            const i = Math.max(0, model.queue!.index - 1) + n;
            return (
              <div className="player-queue-row" key={item.Id}>
                {option(
                  privateText(
                    `${item.ParentIndexNumber !== undefined ? `S${item.ParentIndexNumber} ` : ""}${item.IndexNumber !== undefined ? `E${item.IndexNumber} · ` : ""}${item.Name}`,
                  ),
                  i === model.queue!.index,
                  () => void run({ kind: "queue-select", index: i }, true),
                )}
                {i !== model.queue!.index && (
                  <button
                    aria-label={t("player.remove", {
                      p0: privateText(item.Name),
                    })}
                    disabled={busy || model.queue?.busy}
                    onClick={() => void run({ kind: "queue-remove", index: i })}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        {model.queue?.error && (
          <p role="alert">{displayError(model.queue.error)}</p>
        )}
      </>
    ),
  };
  const toolButtons: Record<OptionalControl, ReactNode> = {
    volume: menuButton(
      t("player.volume"),
      state.muted || state.volume === 0 ? (
        <VolumeX size={21} />
      ) : (
        <Volume2 size={21} />
      ),
      "volume",
    ),
    subtitle: menuButton(
      t("player.subtitles"),
      <Subtitles size={21} />,
      "subtitle",
    ),
    audio: menuButton(
      t("player.audio_tracks"),
      <Headphones size={21} />,
      "audio",
    ),
    speed: menuButton(t("player.speed"), <Gauge size={21} />, "speed"),
    danmaku:
      !model.mini && model.danmaku
        ? menuButton(
            t("player.danmaku"),
            <MessageSquareText size={21} />,
            "danmaku",
          )
        : null,
    mini:
      state.embedded && state.playSessionId && isTauri()
        ? icon(
            t("player.mini_window"),
            <PictureInPicture2 size={21} />,
            () => mini("enter"),
            busy || !state.loaded,
          )
        : null,
    fullscreen: icon(
      state.fullscreen ? t("player.exit_fullscreen") : t("danmaku.fullscreen"),
      state.fullscreen ? <Minimize size={21} /> : <Maximize size={21} />,
      full,
      !state.embedded && (busy || !state.loaded),
      { "aria-pressed": !!state.fullscreen },
    ),
  };
  return (
    <div
      ref={root}
      className={`player-chrome ${model.theater ? "player-chrome-theater" : "player-chrome-dock"} chrome-${chrome.phase}${owned ? " player-owned-ui" : ""}${chrome.suspended ? " chrome-suspended" : ""}${model.mini ? " player-mini-ui" : ""}`}
      style={playerMotionStyle as CSSProperties}
      aria-busy={busy || leavingMini}
      data-cursor-hidden={chrome.cursorHidden}
      onPointerEnter={chrome.pointer}
      onPointerLeave={chrome.leave}
      onPointerMove={chrome.pointer}
      onPointerDownCapture={(e) => {
        chrome.pointer();
        if (!popover.menu) suppressClick.current = false;
        if (
          model.mini &&
          e.button === 0 &&
          state.playSessionId &&
          e.target instanceof Element &&
          !e.target.closest("button,input,.player-popover,[data-ui-overlay]")
        ) {
          void dispatch({
            kind: "mini",
            command: "drag",
            playSessionId: state.playSessionId,
          }).catch(() => {});
        }
      }}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (
          e.target instanceof Element &&
          e.target.closest(
            "button,input,select,.player-popover,.player-console,.player-heading,[data-ui-overlay]",
          )
        )
          return;
        clearTimeout(clickTimer.current);
        if (e.detail >= 2) return;
        singleCommitted.current = false;
        clickTimer.current = setTimeout(() => {
          singleCommitted.current = true;
          control("pause");
        }, 160);
      }}
      onDoubleClick={(e) => {
        if (model.mini) return;
        if (
          e.target instanceof Element &&
          !e.target.closest(
            "button,input,select,.player-console,.player-heading,.player-popover,[data-ui-overlay]",
          )
        ) {
          clearTimeout(clickTimer.current);
          if (!singleCommitted.current) full();
          singleCommitted.current = false;
        }
      }}
      onContextMenuCapture={(e) => {
        if (model.mini) {
          e.preventDefault();
          return;
        }
        if (
          e.target instanceof Element &&
          e.target.closest("input,select,[data-ui-overlay]")
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(clickTimer.current);
        if (popover.menu) {
          dismissActiveOverlay();
          return;
        }
        suppressClick.current = false;
        const bounds = root.current!.getBoundingClientRect();
        setContextPoint({
          x: e.clientX - bounds.left,
          y: e.clientY - bounds.top,
        });
        popover.anchor.current = null;
        chrome.reveal();
        popover.open("more");
      }}
    >
      {children}
      {(busy || leavingMini) && (
        <div className="player-action-pending" role="status">
          {t("player.applying_action")}
        </div>
      )}
      {positioning && subtitlePositionEdit && (
        <SecondarySubtitlePosition
          key={`${subtitlePositionEdit.revision}-${subtitlePositionEdit.session}`}
          value={subtitlePositionEdit.value}
          send={(value, persist) =>
            dispatch({
              kind: "control",
              action: "secondarySubtitlePosition",
              value,
              persist,
              playSessionId: subtitlePositionEdit.session,
            })
          }
          onClose={(value) => {
            settledSubtitlePosition.current = {
              ...subtitlePositionEdit,
              value,
            };
            setSubtitlePositionEdit(null);
            open("subtitle-settings");
          }}
        />
      )}
      {notice && !model.mini && (
        <Toast
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      )}
      {model.mini && (
        <button
          className="mini-exit"
          aria-label={t("player.exit_mini")}
          data-tooltip={t("player.exit_mini")}
          aria-busy={leavingMini}
          aria-hidden={chrome.phase === "hidden"}
          inert={chrome.phase === "hidden"}
          onPointerEnter={() => chrome.hover(true)}
          onPointerLeave={() => chrome.hover(false)}
          disabled={leavingMini || !state.playSessionId}
          onClick={() => mini("leave")}
        >
          <X size={20} />
        </button>
      )}
      {!model.mini && (
        <div
          className="player-heading"
          aria-hidden={chrome.phase === "hidden"}
          inert={chrome.phase === "hidden" || positioning}
          onTransitionEnd={chrome.onTransitionEnd}
          onPointerEnter={() => chrome.hover(true)}
          onPointerLeave={() => chrome.hover(false)}
        >
          {!model.mini &&
            model.capabilities.return &&
            icon(
              model.mini
                ? t("player.restore_player")
                : model.theater
                  ? t("library.exit_playback")
                  : t("player.open_player"),
              <ArrowLeft size={22} />,
              () => (model.mini ? mini("leave") : void run({ kind: "return" })),
              busy,
            )}
          <strong title={privateText(state.title)}>
            {privateText(state.title)}
          </strong>
          {state.buffering && (
            <span className="player-state-note">{t("player.buffering")}</span>
          )}
        </div>
      )}
      {state.active && (
        <div
          className="player-console"
          ref={chrome.console}
          aria-hidden={chrome.phase === "hidden"}
          inert={chrome.phase === "hidden" || positioning}
          onTransitionEnd={chrome.onTransitionEnd}
          onPointerEnter={() => chrome.hover(true)}
          onPointerLeave={() => chrome.hover(false)}
        >
          {model.mini ? (
            <div className="player-mini-controls">
              {icon(
                state.paused ? t("player.resume") : t("player.pause"),
                state.paused ? <Play size={22} /> : <Pause size={22} />,
                () => control("pause"),
                busy || !state.loaded,
                {
                  className: "transport-play",
                  "aria-busy":
                    pendingAction?.kind === "control" &&
                    pendingAction.action === "pause",
                },
              )}
              {menuButton(
                t("player.speed"),
                <span className="mini-speed-value">
                  {Number.isInteger(state.speed || 1)
                    ? (state.speed || 1).toFixed(1)
                    : state.speed}
                  ×
                </span>,
                "speed",
              )}
            </div>
          ) : (
            <>
              <div
                className="player-timeline"
                onPointerMove={(e) => {
                  const input = e.currentTarget.querySelector("input")!,
                    b = input.getBoundingClientRect(),
                    p = Math.max(
                      0,
                      Math.min(1, (e.clientX - b.left) / Math.max(1, b.width)),
                    );
                  setHover({
                    time: state.duration * p,
                    left: Math.max(22, Math.min(b.width - 22, p * b.width)),
                  });
                }}
                onPointerLeave={() => setHover(null)}
              >
                {!model.mini && (
                  <DanmakuHeatmap
                    value={model.danmaku?.density}
                    duration={state.duration}
                  />
                )}
                <PlayerSlider
                  className="seek"
                  label={t("player.playback_position")}
                  max={Math.max(1, state.duration)}
                  value={state.position}
                  buffered={state.bufferSeconds}
                  disabled={busy || !state.loaded || !state.duration}
                  onEditing={setEditing}
                  commit={(n) => control("seek", n)}
                />
                {hover && state.duration > 0 && (
                  <span
                    className="timeline-preview"
                    style={{ left: hover.left }}
                  >
                    {model.preview?.dataUrl &&
                      Math.abs(model.preview.time - hover.time) < 0.5 && (
                        <img
                          src={model.preview.dataUrl}
                          alt={t("player.seek_preview")}
                        />
                      )}
                    {formatTime(hover.time)}
                  </span>
                )}
              </div>
              <div className="player-buttons">
                <div className="transport-primary">
                  {icon(
                    state.paused ? t("player.resume") : t("player.pause"),
                    state.paused ? <Play size={24} /> : <Pause size={24} />,
                    () => control("pause"),
                    busy || !state.loaded,
                    {
                      className: "transport-play",
                      "aria-busy":
                        pendingAction?.kind === "control" &&
                        pendingAction.action === "pause",
                    },
                  )}
                  {!model.mini &&
                    model.capabilities.previous &&
                    icon(
                      t("player.previous_episode"),
                      <SkipBack size={21} />,
                      () => void run({ kind: "previous" }),
                      busy || model.previousDisabled,
                    )}
                  {!model.mini &&
                    model.capabilities.next &&
                    icon(
                      t("library.next_episode"),
                      <SkipForward size={21} />,
                      () => void run({ kind: "next" }),
                      busy || model.nextDisabled,
                    )}
                  {!model.mini &&
                    icon(
                      t("player.rewind_10_seconds"),
                      <RotateCcw size={19} />,
                      () => control("seek", Math.max(0, state.position - 10)),
                      busy || !state.loaded,
                      { className: "player-seek-step" },
                    )}
                  {!model.mini &&
                    icon(
                      t("player.forward_10_seconds"),
                      <RotateCw size={19} />,
                      () =>
                        control(
                          "seek",
                          Math.min(state.duration, state.position + 10),
                        ),
                      busy || !state.loaded,
                      { className: "player-seek-step" },
                    )}
                  <time className="player-time">
                    {formatTime(state.position)}
                    <span> / {formatTime(state.duration)}</span>
                  </time>
                  {playbackResolution(state.videoParams) && (
                    <span
                      className="player-resolution"
                      aria-label={t("player.current_playback_resolution")}
                    >
                      {playbackResolution(state.videoParams)}
                    </span>
                  )}
                  {state.inputRateBps && state.inputRateBps > 0 && (
                    <span
                      className="player-network-rate"
                      aria-label={t("player.live_network_speed")}
                    >
                      {(state.inputRateBps / 1_000_000).toFixed(1)} MB/s
                    </span>
                  )}
                </div>
                <div className="transport-tools">
                  {tools.map((id) => (
                    <span key={id} className="player-tool">
                      {toolButtons[id]}
                    </span>
                  ))}
                  {menuButton(
                    t("player.more_playback_actions"),
                    <MoreHorizontal size={22} />,
                    "more",
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {!model.mini && skipVisible && segment && !popover.menu && (
        <div className="player-skip-overlay">
          <button
            disabled={busy}
            onClick={() => {
              setDismissedSkip(skipKey);
              control("seek", segment.end);
            }}
          >
            {segment.kind === "intro"
              ? t("player.skip_intro")
              : t("player.skip_credits")}
          </button>
          <button
            aria-label={t("player.dismiss_skip_prompt")}
            onClick={() => setDismissedSkip(skipKey)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {!model.mini &&
        model.routeHint &&
        model.routes.length > 1 &&
        !state.syncError &&
        !popover.menu && (
          <div className="player-route-hint" role="status">
            <p>
              {t("player.current_route_may_be_unstable")}{" "}
              {localizeMessage(model.routeHint.reason)}
            </p>
            <button onClick={() => open("routes")}>
              {t("player.view_routes")}
            </button>
            <button
              disabled={busy}
              onClick={() => void run({ kind: "route-suppress" })}
            >
              {" "}
              {t("player.don_t_remind_me_this_session")}{" "}
            </button>
            <button
              aria-label={t("player.dismiss_route_warning")}
              onClick={() => void run({ kind: "route-dismiss" })}
            >
              <X size={15} />
            </button>
          </div>
        )}
      {popover.menu && (
        <div
          key={popover.menu}
          ref={panel}
          id="player-popover"
          className={`player-popover player-${popover.menu}-popover popover-${popover.phase}`}
          style={placement}
          role={
            ["settings", "subtitle-settings", "danmaku", "layout"].includes(
              popover.menu,
            )
              ? "dialog"
              : "menu"
          }
          aria-label={titles[popover.menu]}
          aria-hidden={popover.phase === "closing"}
          inert={popover.phase === "closing"}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && e.propertyName === "opacity")
              popover.finish();
          }}
          onKeyDown={(e) => {
            if (e.defaultPrevented) return;
            if (isComposingKey(e.nativeEvent)) return;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              popover.close();
              return;
            }
            const options = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
              ].includes(e.key) &&
              !isEditableTarget(e.target)
            ) {
              e.preventDefault();
              e.stopPropagation();
              const i = options.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              options[
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i +
                        (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1) +
                        options.length) %
                      options.length
              ]?.focus();
            }
          }}
        >
          <header>
            {!model.mini &&
              popover.menu !== "more" &&
              popover.menu !== "audio" &&
              popover.menu !== "subtitle" &&
              popover.menu !== "volume" && (
                <button
                  aria-label={t(
                    popover.menu === "subtitle-settings"
                      ? "player.back_to_subtitles"
                      : "player.back_to_more",
                  )}
                  onClick={() =>
                    open(
                      popover.menu === "subtitle-settings"
                        ? "subtitle"
                        : "more",
                    )
                  }
                >
                  <ArrowLeft size={17} />
                </button>
              )}
            <h2>{titles[popover.menu]}</h2>
            <button
              aria-label={
                popover.menu === "settings"
                  ? t("player.close_playback_settings")
                  : t("player.close", { p0: titles[popover.menu] })
              }
              onClick={() => popover.close()}
            >
              <X size={17} />
            </button>
          </header>
          <div className="player-popover-scroll">{content[popover.menu]}</div>
        </div>
      )}
      {(model.error ||
        state.error ||
        state.syncError ||
        localError ||
        state.subtitleLoadFailed) && (
        <div className="player-ui-error" role="alert">
          {displayError(
            model.error ||
              state.error ||
              state.syncError ||
              localError ||
              t("player.external_subtitle_failed"),
          )}
          {!model.mini && (model.error || state.error) && (
            <button onClick={() => void run({ kind: "diagnostics" })}>
              {" "}
              {t("player.copy_playback_diagnostics")}{" "}
            </button>
          )}
          {model.diagnosticFeedback && (
            <span role="status">
              {localizeMessage(model.diagnosticFeedback)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
