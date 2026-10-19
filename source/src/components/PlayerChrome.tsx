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
  Volume2,
  VolumeX,
  X,
  Network,
  Layers,
  BookOpen,
  Pin,
} from "lucide-react";
import { usePlayerChrome } from "../player/usePlayerChrome";
import { usePlayerPopover } from "../player/usePlayerPopover";
import { playerMotionStyle } from "../player/motion";
import { formatTime } from "../player/formatTime";
import type {
  PlayerAction,
  PlayerMenu,
  PlayerUiModel,
} from "../player/uiModel";
import { privateText } from "../privacy";
import { isEditableTarget, isComposingKey } from "../player/shortcuts";
import Tooltip from "./Tooltip";
import PlayerSlider from "./PlayerSlider";
import SubtitleSlider from "./SubtitleSlider";
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
  danmaku: "弹幕",
  subtitle: "字幕",
  audio: "音轨",
  volume: "音量",
  more: "更多",
  speed: "播放速度",
  chapters: "章节",
  loop: "A–B 循环",
  routes: "播放线路",
  versions: "播放版本",
  settings: "播放设置",
  queue: "播放队列",
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
}: {
  model: PlayerUiModel;
  dispatch: (action: PlayerAction) => Promise<void>;
  owned?: boolean;
}) {
  const { state } = model,
    popover = usePlayerPopover();
  const mediaQuality =
    state.playMethod === "Transcode" || state.videoParams?.gamma
      ? identifyQuality(undefined, state.videoParams)
      : state.mediaQuality;
  const [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [localError, setLocalError] = useState("");
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
  const busy = model.busy || pending;
  const [notice, setNotice] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  useEffect(() => {
    const status = model.danmaku?.status;
    if (!status || model.danmaku?.loading) return;
    setNotice({
      message: status,
      tone: status.startsWith("弹幕已加载")
        ? "success"
        : status.startsWith("已解除")
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
  useEffect(() => {
    popover.reset();
    clearTimeout(clickTimer.current);
    singleCommitted.current = false;
    setEditing(false);
    setHover(null);
  }, [model.revision, popover.reset]);
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
      popover.menu ||
      model.routeHint
    ),
    model.revision,
    !!popover.menu || editing,
    owned ? "player-ui" : "main",
  );
  const run = async (action: PlayerAction, close = false) => {
    if (busy || actionPending.current) return;
    const requestMenu = popover.menu;
    actionPending.current = true;
    setPending(true);
    setLocalError("");
    try {
      await dispatch(action);
      if (close) popover.closeFor(requestMenu);
    } catch {
      setLocalError("操作未完成，请重试。");
    } finally {
      actionPending.current = false;
      setPending(false);
    }
  };
  const control = (action: string, value?: number, close = false) =>
    void run({ kind: "control", action, value }, close);
  const full = () =>
    control(
      "fullscreen",
      state.embedded ? (state.fullscreen ? 0 : 1) : undefined,
    );
  useEffect(() => {
    if (!state.active || !state.loaded) return;
    const keyboard = (e: KeyboardEvent) => {
      if (isComposingKey(e)) return;
      if (
        e.defaultPrevented ||
        (e.target instanceof Element && e.target.closest("[data-ui-overlay]"))
      )
        return;
      if (model.shortcutsBlocked) return;
      if (e.key === "Escape" && popover.menu) {
        e.preventDefault();
        dismissActiveOverlay();
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
      if (action) {
        e.preventDefault();
        if (action === "pause") control("pause");
        else if (action === "fullscreen") full();
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
              `button[aria-label="${action === "subtitle" ? "字幕" : "音轨"}"]`,
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
  }, [popover.menu, contextPoint]);
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
        aria-expanded={popover.menu === menu && popover.phase !== "closing"}
        aria-controls="player-popover"
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
      disabled={busy || !state.loaded}
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
  const trackLabel = (t: (typeof state.tracks)[number]) =>
    privateText(
      t.title || t.lang || `${t.type === "audio" ? "音轨" : "字幕"} ${t.id}`,
    );
  const settings = (
    <div className="player-setting-fields">
      <label>
        画面模式
        <Select
          aria-label="画面模式"
          value={state.videoFit || "fit"}
          disabled={busy || !state.loaded || !state.playSessionId}
          onChange={(e) =>
            dispatch({
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
      </label>
      <p className="player-menu-note">
        自动适应保留完整画面；填充屏幕可能裁切；拉伸铺满可能变形。
      </p>
      <label className="player-check">
        <input
          type="checkbox"
          checked={!chrome.pinned}
          onChange={(e) => chrome.pin(!e.target.checked)}
        />
        自动隐藏控制栏
      </label>
      <button
        aria-label="视频窗口置顶"
        aria-pressed={!!state.ontop}
        disabled={busy || !state.loaded}
        onClick={() => control("ontop")}
      >
        <Pin size={16} />
        {state.ontop ? "取消置顶" : "窗口置顶"}
      </button>
      <label>
        次字幕
        <Select
          aria-label="次字幕"
          value={state.secondarySubtitle ?? -1}
          disabled={busy || !state.loaded}
          onChange={(e) => control("secondarySubtitle", Number(e.target.value))}
        >
          <option value={-1}>关闭</option>
          {tracks("sub")
            .filter((t) => t.id !== selectedTrack("sub"))
            .map((t) => (
              <option value={t.id} key={t.id}>
                {trackLabel(t)}
              </option>
            ))}
        </Select>
      </label>
      <SubtitleSlider
        key={`scale-${model.revision}`}
        label="字幕大小"
        min={0.6}
        max={1.8}
        step={0.01}
        value={state.subtitleScale || 1}
        disabled={!state.loaded || model.busy}
        send={(value, persist) =>
          dispatch({ kind: "control", action: "subtitleScale", value, persist })
        }
      />
      {(
        [
          ["字幕延迟", "subtitleDelay", state.subtitleDelay || 0, -30, 30, 0.5],
          ["音频延迟", "audioDelay", state.audioDelay || 0, -10, 10, 0.1],
        ] as const
      ).map(([label, action, value, min, max, step]) => (
        <label key={action}>
          {label}（秒）
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
        label="字幕垂直位置"
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
        <RotateCcw size={16} />
        恢复默认字幕位置
      </button>
      <p className="player-menu-note">
        大小与位置适用于文本字幕；ASS/SSA 保留自身样式和定位。
      </p>
      {state.bufferSeconds !== undefined && (
        <small>已缓冲 {Math.round(state.bufferSeconds)} 秒</small>
      )}
      {mediaQuality && (
        <div className="player-menu-note">
          <p>
            播放方式：
            {state.playMethod === "DirectStream"
              ? "直接串流"
              : state.playMethod === "Transcode"
                ? "转码"
                : state.playMethod === "DirectPlay"
                  ? "直接播放"
                  : "Unknown"}
          </p>
          <p>
            媒体：{mediaQuality.hdr} ·{" "}
            {mediaQuality.bitDepth
              ? `${mediaQuality.bitDepth}bit`
              : "位深 Unknown"}{" "}
            · {mediaQuality.primaries}
          </p>
          <p>
            Windows HDR：
            {state.windowsHdr?.hdr === true
              ? "开启"
              : state.windowsHdr?.hdr === false
                ? "关闭"
                : "Unknown"}
          </p>
          <p>
            输出策略：
            {state.outputPolicy === "source"
              ? "原样输出"
              : state.outputPolicy === "sdr"
                ? "HDR → SDR"
                : "自动"}{" "}
            · {state.renderer || "Unknown"}
          </p>
          {!!state.videoOutput?.gamma && (
            <p>
              实际输出：{String(state.videoOutput.gamma)} ·{" "}
              {String(state.videoOutput.primaries || "Unknown")}
            </p>
          )}
          {state.requestedOutputPolicy === "source" &&
            state.outputPolicy === "auto" && (
              <p>原样输出需系统 HDR 开启；当前回退为自动。</p>
            )}
          {state.audioFallback && <p>已尝试自动音频设备与 PCM 回退</p>}
          {mediaQuality.hdr === "Dolby Vision" && (
            <p>DV 信息可识别；不保证所有 Profile 的完整 DV 输出。</p>
          )}
        </div>
      )}
    </div>
  );
  const content: Record<PlayerMenu, ReactNode> = {
    danmaku: model.danmaku ? (
      <>
        <OnlineDanmakuMenu value={model.danmaku} dispatch={run} />
        <small>
          本地文件
          {model.danmaku.source === "online" ? " · 当前使用在线弹幕" : ""}
        </small>
        <div className="player-menu-note">
          <strong>{model.danmaku.name || "尚未选择弹幕来源"}</strong>
          <p role="status">
            {model.danmaku.status ||
              "选择本地 Bilibili XML 或 ASS；当前媒体单独绑定。"}
          </p>
          {!state.embedded && (
            <p>外挂弹幕在内嵌播放器显示。请在设置中开启“在客户端内播放”。</p>
          )}
        </div>
        <div className="danmaku-file-actions">
          <button
            disabled={busy || model.danmaku.loading || !state.embedded}
            onClick={() => void run({ kind: "danmaku", command: "choose" })}
          >
            {model.danmaku.bound ? "重新选择文件" : "选择本地文件"}
          </button>
          {model.danmaku.bound && (
            <button
              disabled={busy || model.danmaku.loading}
              onClick={() => void run({ kind: "danmaku", command: "unbind" })}
            >
              解除绑定
            </button>
          )}
        </div>
        <fieldset disabled={busy || model.danmaku.loading}>
          <small>时间校准 / 弹幕设置</small>
          <DanmakuSettings
            value={{ ...model.danmaku.settings, offset: model.danmaku.offset }}
            onChange={(patch) =>
              void run({ kind: "danmaku", command: "settings", patch })
            }
          />
        </fieldset>
      </>
    ) : (
      <p className="player-menu-note">本地弹幕仅在原生播放器中可用。</p>
    ),
    subtitle: (
      <>
        {option("关闭字幕", selectedTrack("sub") === -1, () =>
          control("subtitle", -1, true),
        )}
        {tracks("sub").map((t) => (
          <div key={t.id}>
            {option(trackLabel(t), !!t.selected, () =>
              control("subtitle", t.id, true),
            )}
          </div>
        ))}
        {!tracks("sub").length && (
          <p className="player-menu-note">此视频没有可用字幕</p>
        )}
        <button className="player-menu-footer" onClick={() => open("settings")}>
          字幕大小、位置与延迟
          <ChevronRight size={15} />
        </button>
      </>
    ),
    audio: (
      <>
        {option("关闭音频", selectedTrack("audio") === -1, () =>
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
          <p className="player-menu-note">此视频没有可用音轨</p>
        )}
      </>
    ),
    volume: (
      <div className="player-volume-content">
        <Volume2 size={18} />
        <PlayerSlider
          label="音量"
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
          <small>播放</small>
          {entry("倍速", <Gauge size={17} />, "speed", `${state.speed || 1}×`)}
          {model.danmaku &&
            entry(
              "弹幕",
              <Subtitles size={17} />,
              "danmaku",
              model.danmaku.settings.enabled ? "显示" : "关闭",
            )}
          {!!model.item?.Chapters?.length &&
            entry("章节", <BookOpen size={17} />, "chapters")}
          {entry("A–B 循环", <Repeat2 size={17} />, "loop")}
          {!!model.queue?.items.length &&
            entry("播放队列", <ListVideo size={17} />, "queue")}
        </div>
        {(model.routes.length > 0 || model.capabilities.versions) && (
          <div className="player-menu-group">
            <small>播放源</small>
            {model.routes.length > 0 &&
              entry(
                "线路",
                <Network size={17} />,
                "routes",
                model.routes.find((r) => r.selected)?.name,
              )}
            {model.capabilities.versions &&
              entry("播放版本", <Layers size={17} />, "versions")}
          </div>
        )}
        <div className="player-menu-group">
          <small>高级</small>
          {entry("播放设置", <SlidersHorizontal size={17} />, "settings")}
        </div>
        <div className="player-menu-group">
          <button
            role="menuitem"
            className="player-danger"
            disabled={busy}
            onClick={() => control("stop", undefined, true)}
          >
            <Square size={16} />
            <span>停止播放</span>
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
            <span>{privateText(c.Name || `章节 ${i + 1}`)}</span>
            <small>{formatTime(c.StartPositionTicks / 10000000)}</small>
          </button>
        ))}
      </>
    ),
    loop: (
      <div className="player-loop-popover">
        <p>在当前播放位置设置循环范围</p>
        <button
          disabled={busy || !state.loaded}
          onClick={() => control("loopA", state.position)}
        >
          标记 A
          {state.loopA !== undefined ? ` · ${formatTime(state.loopA)}` : ""}
        </button>
        <button
          disabled={busy || state.loopA === undefined || !state.loaded}
          onClick={() => control("loopB", state.position)}
        >
          标记 B
          {state.loopB !== undefined ? ` · ${formatTime(state.loopB)}` : ""}
        </button>
        <button disabled={busy} onClick={() => control("clearLoop")}>
          取消循环
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
                评估 API
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run({ kind: "route-probe", index: i, media: true })
                }
              >
                小样本吞吐
              </button>
            </div>
          </div>
        ))}
        <p className="player-menu-note">
          换线后从当前播放位置继续。吞吐测试只取最多 256KiB；每条线路至少间隔 60
          秒。播放中不会自动换线。
        </p>
      </>
    ),
    versions: (
      <>
        {model.item?.MediaSources?.map((s) => (
          <div key={s.Id}>
            {option(
              privateText(s.Name || s.Container || "视频版本"),
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
          />
          自动下一集
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
                    aria-label={`移除 ${privateText(item.Name)}`}
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
          <p role="alert">{privateText(model.queue.error)}</p>
        )}
      </>
    ),
  };
  return (
    <div
      ref={root}
      className={`player-chrome ${model.theater ? "player-chrome-theater" : "player-chrome-dock"} chrome-${chrome.phase}${owned ? " player-owned-ui" : ""}${chrome.suspended ? " chrome-suspended" : ""}`}
      style={playerMotionStyle as CSSProperties}
      onPointerMove={chrome.pointer}
      onPointerDownCapture={(e) => {
        chrome.pointer();
        if (!popover.menu) suppressClick.current = false;
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
      {notice && (
        <Toast
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      )}
      <div
        className="player-heading"
        aria-hidden={chrome.phase === "hidden"}
        inert={chrome.phase === "hidden"}
        onTransitionEnd={chrome.onTransitionEnd}
      >
        {model.capabilities.return &&
          icon(
            model.theater ? "退出播放" : "打开播放页面",
            <ArrowLeft size={22} />,
            () => void run({ kind: "return" }),
            busy,
          )}
        <strong title={privateText(state.title)}>
          {privateText(state.title)}
        </strong>
        {state.buffering && (
          <span className="player-state-note">正在缓冲…</span>
        )}
      </div>
      {state.active && (
        <div
          className="player-console"
          ref={chrome.console}
          aria-hidden={chrome.phase === "hidden"}
          inert={chrome.phase === "hidden"}
          onTransitionEnd={chrome.onTransitionEnd}
        >
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
            <PlayerSlider
              className="seek"
              label="播放位置"
              max={Math.max(1, state.duration)}
              value={state.position}
              disabled={busy || !state.loaded || !state.duration}
              onEditing={setEditing}
              commit={(n) => control("seek", n)}
            />
            {hover && state.duration > 0 && (
              <span className="timeline-preview" style={{ left: hover.left }}>
                {model.preview?.dataUrl &&
                  Math.abs(model.preview.time - hover.time) < 0.5 && (
                    <img src={model.preview.dataUrl} alt="进度预览" />
                  )}
                {formatTime(hover.time)}
              </span>
            )}
          </div>
          <div className="player-buttons">
            <div className="transport-primary">
              {icon(
                state.paused ? "继续播放" : "暂停",
                state.paused ? <Play size={24} /> : <Pause size={24} />,
                () => control("pause"),
                busy || !state.loaded,
                { className: "transport-play" },
              )}
              {model.capabilities.previous &&
                icon(
                  "上一集",
                  <SkipBack size={21} />,
                  () => void run({ kind: "previous" }),
                  busy || model.previousDisabled,
                )}
              {model.capabilities.next &&
                icon(
                  "下一集",
                  <SkipForward size={21} />,
                  () => void run({ kind: "next" }),
                  busy || model.nextDisabled,
                )}
              {icon(
                "快退 10 秒",
                <RotateCcw size={19} />,
                () => control("seek", Math.max(0, state.position - 10)),
                busy || !state.loaded,
                { className: "player-seek-step" },
              )}
              {icon(
                "快进 10 秒",
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
                <span className="player-resolution" aria-label="当前播放清晰度">
                  {playbackResolution(state.videoParams)}
                </span>
              )}
              {state.inputRateBps && state.inputRateBps > 0 && (
                <span className="player-network-rate" aria-label="实时网速">
                  {(state.inputRateBps / 1_000_000).toFixed(1)} MB/s
                </span>
              )}
            </div>
            <div className="transport-tools">
              {menuButton(
                "音量",
                state.muted || state.volume === 0 ? (
                  <VolumeX size={21} />
                ) : (
                  <Volume2 size={21} />
                ),
                "volume",
              )}
              {menuButton("字幕", <Subtitles size={21} />, "subtitle")}
              {menuButton("音轨", <Headphones size={21} />, "audio")}
              {menuButton("更多播放操作", <MoreHorizontal size={22} />, "more")}
              {icon(
                state.fullscreen ? "退出全屏" : "全屏",
                state.fullscreen ? (
                  <Minimize size={21} />
                ) : (
                  <Maximize size={21} />
                ),
                full,
                busy || !state.loaded,
              )}
            </div>
          </div>
        </div>
      )}
      {skipVisible && segment && !popover.menu && (
        <div className="player-skip-overlay">
          <button
            disabled={busy}
            onClick={() => {
              setDismissedSkip(skipKey);
              control("seek", segment.end);
            }}
          >
            {segment.kind === "intro" ? "跳过片头" : "跳过片尾"}
          </button>
          <button
            aria-label="忽略跳过提示"
            onClick={() => setDismissedSkip(skipKey)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {model.routeHint &&
        model.routes.length > 1 &&
        !state.syncError &&
        !popover.menu && (
          <div className="player-route-hint" role="status">
            <p>当前线路可能不稳定 · {model.routeHint.reason}</p>
            <button onClick={() => open("routes")}>查看线路</button>
            <button
              disabled={busy}
              onClick={() => void run({ kind: "route-suppress" })}
            >
              本次不再提醒
            </button>
            <button
              aria-label="关闭线路提示"
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
            ["settings", "danmaku"].includes(popover.menu) ? "dialog" : "menu"
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
            {popover.menu !== "more" &&
              popover.menu !== "audio" &&
              popover.menu !== "subtitle" &&
              popover.menu !== "volume" && (
                <button aria-label="返回更多菜单" onClick={() => open("more")}>
                  <ArrowLeft size={17} />
                </button>
              )}
            <h2>{titles[popover.menu]}</h2>
            <button
              aria-label={
                popover.menu === "settings"
                  ? "关闭播放设置"
                  : `关闭${titles[popover.menu]}`
              }
              onClick={() => popover.close()}
            >
              <X size={17} />
            </button>
          </header>
          <div className="player-popover-scroll">{content[popover.menu]}</div>
        </div>
      )}
      {(model.error || state.error || state.syncError || localError) && (
        <div className="player-ui-error" role="alert">
          {privateText(
            model.error || state.error || state.syncError || localError,
          )}
          {(model.error || state.error) && (
            <button onClick={() => void run({ kind: "diagnostics" })}>
              复制播放诊断
            </button>
          )}
          {model.diagnosticFeedback && (
            <span role="status">{model.diagnosticFeedback}</span>
          )}
        </div>
      )}
    </div>
  );
}
