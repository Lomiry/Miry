import useDialogFocus from "./useDialogFocus";
import Select from "./Select";
import DanmakuSettings from "./DanmakuSettings";
import { normalizeDanmaku } from "../danmaku/types";
import { useEffect, useRef, useState } from "react";
import {
  X,
  RefreshCw,
  Play,
  Monitor,
  Volume2,
  Subtitles,
  Library,
  Network,
  Keyboard,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import type { Settings } from "../stores/settings";
import type { EmbyClient } from "../api/client";
import { privateError } from "../privacy";
import LibraryManager from "./LibraryManager";
import {
  SettingRow,
  SwitchField,
  NumberField,
  SliderField,
  ActionRow,
} from "./SettingField";
import {
  defaultLibraries,
  type LibraryPreferences,
} from "../stores/libraryPreferences";
import type { Item } from "../types/emby";
import { APP_VERSION } from "../version";
import { invoke, isTauri } from "@tauri-apps/api/core";
import QualitySettings from "./QualitySettings";
import ShortcutSettings from "./ShortcutSettings";
import AppearanceSettings from "./AppearanceSettings";
import DesktopSettings from "./DesktopSettings";
import type { PlayerSnapshot } from "../player/playback";
import {
  readNetworkDiagnostics,
  recordNetwork,
  type NetworkCategory,
} from "../api/diagnostics";
export type SettingsSection =
  | "appearance"
  | "playback"
  | "libraries"
  | "connection"
  | "video"
  | "audio"
  | "advanced"
  | "shortcuts"
  | "subtitles"
  | "about";
const sections: { id: SettingsSection; name: string }[] = [
  { id: "appearance", name: "外观" },
  { id: "playback", name: "播放" },
  { id: "video", name: "视频" },
  { id: "audio", name: "音频" },
  { id: "subtitles", name: "字幕 / 弹幕" },
  { id: "libraries", name: "媒体库" },
  { id: "connection", name: "网络 / 线路" },
  { id: "shortcuts", name: "快捷键" },
  { id: "advanced", name: "高级" },
  { id: "about", name: "关于" },
];
const sectionIcons = {
  appearance: Monitor,
  playback: Play,
  video: Monitor,
  audio: Volume2,
  subtitles: Subtitles,
  libraries: Library,
  connection: Network,
  shortcuts: Keyboard,
  advanced: SlidersHorizontal,
  about: Info,
};
const networkLabels: Record<string, string> = {
  permission: "客户端权限拒绝",
  dns: "域名解析失败",
  tcp: "无法建立连接",
  tls: "TLS 或证书校验失败",
  timeout: "请求超时",
  http: "服务器返回错误",
  format: "Emby 数据格式异常",
  network: "网络请求失败",
};
export default function SettingsPanel({
  settings,
  onChange,
  onClose: finishClose,
  api,
  initialSection = "playback",
  views = [],
  libraries = defaultLibraries(),
  onLibrariesChange = () => {},
  snapshot,
  onEndpoints,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  api: EmbyClient | null;
  initialSection?: SettingsSection;
  views?: Item[];
  libraries?: LibraryPreferences;
  onLibrariesChange?: (prefs: LibraryPreferences) => void;
  snapshot?: PlayerSnapshot;
  onEndpoints?: () => void;
}) {
  const [section, setSection] = useState(initialSection);
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  const pending = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const onClose = useDialogFocus(panel, finishClose);
  useEffect(() => () => pending.current?.abort(), []);
  async function check() {
    if (!api) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setResult("");
    const began = performance.now();
    try {
      const info = await api.serverInfo(controller.signal);
      if (!controller.signal.aborted)
        setResult(
          `连接正常${/^\d+(?:\.\d+){1,3}$/.test(info.Version) ? ` · Emby ${info.Version}` : ""} · ${Math.round(performance.now() - began)} ms`,
        );
    } catch (e) {
      if (!controller.signal.aborted) setResult(privateError(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      pending.current = null;
    }
  }
  async function diagnose() {
    if (!api || !isTauri()) return;
    setBusy(true);
    setResult("");
    try {
      const report = await invoke<{
        stage: string;
        backend: string;
        url: string;
        status?: number;
        redirectStatuses: number[];
        contentType?: string;
        elapsedMs: number;
        category: string;
        errors: string[];
        validServerInfo: boolean;
        bodyPreview: string;
      }>("diagnose_server", { server: api.account.server });
      recordNetwork({
        stage: report.stage,
        method: "GET",
        url: report.url,
        backend: report.backend,
        status: report.status,
        redirected: report.redirectStatuses.length > 0,
        redirectStatuses: report.redirectStatuses,
        contentType: report.contentType,
        bodyPreview: report.bodyPreview,
        elapsedMs: report.elapsedMs,
        category:
          report.category === "ok"
            ? undefined
            : (report.category as NetworkCategory),
        underlying: report.errors.join(" → "),
      });
      setResult(
        report.validServerInfo && report.status === 200
          ? `底层连接正常 · HTTP 200 · ${report.elapsedMs} ms`
          : `${networkLabels[report.category] || "连接诊断未通过"}${report.status ? ` · HTTP ${report.status}` : ""}。可复制诊断查看详细原因。`,
      );
    } catch {
      setResult("底层诊断未完成，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }
  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          { version: APP_VERSION, requests: readNetworkDiagnostics() },
          null,
          2,
        ),
      );
      setResult("匿名诊断已复制，未包含服务器地址、密码或令牌。");
    } catch {
      setResult("无法复制诊断，请检查剪贴板权限。");
    }
  }
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className="settings-panel settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header>
          <h2 id="settings-title">设置</h2>
          <button aria-label="关闭设置" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="settings-layout">
          <nav
            className="settings-category-nav"
            role="tablist"
            aria-label="设置分类"
            aria-orientation="vertical"
          >
            {sections.map((tab, index) => {
              const Icon = sectionIcons[tab.id];
              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  role="tab"
                  aria-selected={section === tab.id}
                  aria-controls={`settings-section-${tab.id}`}
                  tabIndex={section === tab.id ? 0 : -1}
                  onClick={() => setSection(tab.id)}
                  onKeyDown={(event) => {
                    if (
                      ![
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                        "Home",
                        "End",
                      ].includes(event.key)
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? sections.length - 1
                          : (index +
                              (["ArrowRight", "ArrowDown"].includes(event.key)
                                ? 1
                                : -1) +
                              sections.length) %
                            sections.length;
                    setSection(sections[next].id);
                    panel.current
                      ?.querySelector<HTMLButtonElement>(
                        `#settings-tab-${sections[next].id}`,
                      )
                      ?.focus();
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
          <div
            className="settings-body"
            role="tabpanel"
            id={`settings-section-${section}`}
            aria-labelledby={`settings-tab-${section}`}
          >
            {section === "appearance" && <AppearanceSettings />}
            {section === "playback" && (
              <>
                <h3>播放偏好</h3>
                <SwitchField
                  title="在客户端内播放"
                  description="关闭后使用独立视频窗口，下次开播生效"
                  checked={settings.embedded}
                  onChange={(value) => set({ embedded: value })}
                />
                <NumberField
                  title="片头跳过秒数"
                  value={settings.introSeconds}
                  min={0}
                  max={600}
                  onChange={(value) => set({ introSeconds: value })}
                />
                <NumberField
                  title="片尾预留秒数"
                  value={settings.outroSeconds}
                  min={0}
                  max={600}
                  onChange={(value) => set({ outroSeconds: value })}
                />
                <SwitchField
                  title="自动播放下一集"
                  description="当前集完成并同步进度后继续播放"
                  checked={settings.autoNext}
                  onChange={(value) => set({ autoNext: value })}
                />
                <SettingRow
                  title="播放兼容模式"
                  description="默认优先直接播放；服务器无直接播放源时协商转码"
                >
                  <Select
                    aria-label="播放兼容模式"
                    value={settings.compatibility || "prefer-direct"}
                    onChange={(e) =>
                      set({
                        compatibility: e.target
                          .value as Settings["compatibility"],
                      })
                    }
                  >
                    <option value="prefer-direct">优先直接播放</option>
                    <option value="auto">自动（按服务器源顺序）</option>
                    <option value="direct-only">仅直接播放</option>
                  </Select>
                </SettingRow>
              </>
            )}
            {section === "audio" && (
              <>
                <SettingRow title="首选音轨">
                  <Select
                    aria-label="首选音轨"
                    value={settings.audioLanguage}
                    onChange={(e) => set({ audioLanguage: e.target.value })}
                  >
                    <option value="auto">跟随服务器</option>
                    <option value="zh">中文</option>
                    <option value="en">英语</option>
                    <option value="ja">日语</option>
                  </Select>
                </SettingRow>
              </>
            )}
            {section === "subtitles" && (
              <>
                <SettingRow title="首选字幕">
                  <Select
                    aria-label="首选字幕"
                    value={settings.subtitleLanguage}
                    onChange={(e) => set({ subtitleLanguage: e.target.value })}
                  >
                    <option value="auto">跟随服务器</option>
                    <option value="off">默认关闭</option>
                    <option value="zh">中文</option>
                    <option value="en">英语</option>
                    <option value="ja">日语</option>
                  </Select>
                </SettingRow>
                <p className="setting-note">
                  字幕大小、延迟与双字幕在播放器的字幕和播放设置浮层中调整。
                </p>
              </>
            )}
            {section === "playback" && (
              <>
                <SliderField
                  title="启动音量"
                  description={settings.volume + "%"}
                  value={settings.volume}
                  min={0}
                  max={100}
                  onChange={(value) => set({ volume: value })}
                />
                <SwitchField
                  title="播放时全屏"
                  checked={settings.fullscreen}
                  onChange={(value) => set({ fullscreen: value })}
                />
                <p className="setting-note">偏好自动保存，下次开播生效。</p>
                <ActionRow>
                  <button
                    className="secondary"
                    onClick={() => {
                      api?.cache.clear();
                      setResult("内存缓存已清空。");
                    }}
                  >
                    清空内存缓存
                  </button>
                </ActionRow>
              </>
            )}
            {section === "libraries" && (
              <LibraryManager
                views={views}
                value={libraries}
                onChange={onLibrariesChange}
              />
            )}
            {section === "subtitles" && (
              <>
                <h3>本地外挂弹幕</h3>
                <p className="setting-note">
                  在内嵌播放器的“更多 → 弹幕”中选择 Bilibili XML 或 ASS
                  文件。每部媒体、每一集分别绑定。
                </p>
                <DanmakuSettings
                  value={normalizeDanmaku(settings.danmaku)}
                  onChange={(patch) =>
                    set({
                      danmaku: normalizeDanmaku({
                        ...settings.danmaku,
                        ...patch,
                      }),
                    })
                  }
                />
              </>
            )}
            {section === "shortcuts" && (
              <ShortcutSettings settings={settings} onChange={onChange} />
            )}
            {section === "about" && (
              <DesktopSettings
                settings={settings}
                onChange={onChange}
                api={api}
                snapshot={snapshot}
              />
            )}
            {["video", "audio", "advanced"].includes(section) && (
              <QualitySettings
                section={section as "video" | "audio" | "advanced"}
                settings={settings}
                onChange={onChange}
              />
            )}
            {section === "connection" && (
              <>
                <h3>服务器连接</h3>
                {api?.account.remark && (
                  <p className="connection-address">{api.account.remark}</p>
                )}
                <p className="server-address">
                  {api?.account.server || "演示模式 · 未连接服务器"}
                </p>
                {onEndpoints && (
                  <SettingRow
                    title="多线路管理"
                    description="管理当前服务器的连接线路，可自动选择或手动固定。"
                  >
                    <button
                      className="secondary"
                      disabled={!api}
                      onClick={onEndpoints}
                    >
                      <Network size={15} aria-hidden="true" />
                      多线路管理
                    </button>
                  </SettingRow>
                )}
                <ActionRow>
                  <button
                    className="secondary"
                    disabled={!api || busy}
                    onClick={check}
                  >
                    <RefreshCw size={15} className={busy ? "spin" : ""} />
                    {busy ? "正在检查…" : "检查连接"}
                  </button>
                  {isTauri() && (
                    <button
                      className="secondary"
                      disabled={!api || busy}
                      onClick={diagnose}
                    >
                      获取底层诊断
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={copyDiagnostics}
                  >
                    复制连接诊断
                  </button>
                </ActionRow>
              </>
            )}
            {result && (
              <p role="status" className="connection-result">
                {result}
              </p>
            )}
            <small>Miry v{APP_VERSION}</small>
          </div>
        </div>
      </section>
    </div>
  );
}
