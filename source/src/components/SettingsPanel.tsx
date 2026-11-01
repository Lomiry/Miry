import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import useDialogFocus from "./useDialogFocus";
import Select from "./Select";
import DanmakuSettings from "./DanmakuSettings";
import DanmakuSourceSettings from "./DanmakuSourceSettings";
import { normalizeDanmaku } from "../danmaku/types";
import { normalizeSources } from "../danmaku/sources";
import type { SettingsUpdate } from "../stores/settings";
import { useRef, useState } from "react";
import {
  X,
  Play,
  Monitor,
  Volume2,
  Subtitles,
  Library,
  Keyboard,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import type { Settings } from "../stores/settings";
import type { EmbyClient } from "../api/client";
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
import QualitySettings from "./QualitySettings";
import ShortcutSettings from "./ShortcutSettings";
import AppearanceSettings from "./AppearanceSettings";
import DesktopSettings from "./DesktopSettings";
import type { PlayerSnapshot } from "../player/playback";
export type SettingsSection =
  | "appearance"
  | "playback"
  | "libraries"
  | "video"
  | "audio"
  | "advanced"
  | "shortcuts"
  | "subtitles"
  | "about";
const sections: { id: SettingsSection; name: string }[] = [
  {
    id: "appearance",
    get name() {
      return t("settings.appearance");
    },
  },
  {
    id: "playback",
    get name() {
      return t("library.play");
    },
  },
  {
    id: "video",
    get name() {
      return t("library.video");
    },
  },
  {
    id: "audio",
    get name() {
      return t("settings.audio");
    },
  },
  {
    id: "subtitles",
    get name() {
      return t("settings.subtitles_danmaku");
    },
  },
  {
    id: "libraries",
    get name() {
      return t("library.libraries");
    },
  },
  {
    id: "shortcuts",
    get name() {
      return t("settings.shortcuts");
    },
  },
  {
    id: "advanced",
    get name() {
      return t("player.advanced");
    },
  },
  {
    id: "about",
    get name() {
      return t("settings.about");
    },
  },
];
const sectionIcons = {
  appearance: Monitor,
  playback: Play,
  video: Monitor,
  audio: Volume2,
  subtitles: Subtitles,
  libraries: Library,
  shortcuts: Keyboard,
  advanced: SlidersHorizontal,
  about: Info,
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
}: {
  settings: Settings;
  onChange: (update: SettingsUpdate) => void;
  onClose: () => void;
  api: EmbyClient | null;
  initialSection?: SettingsSection;
  views?: Item[];
  libraries?: LibraryPreferences;
  onLibrariesChange?: (prefs: LibraryPreferences) => void;
  snapshot?: PlayerSnapshot;
}) {
  useI18n();

  const [section, setSection] = useState(initialSection);
  const [result, setResult] = useState("");
  const panel = useRef<HTMLElement | null>(null);
  const onClose = useDialogFocus(panel, finishClose);
  const set = (
    patch: Partial<Settings> | ((current: Settings) => Partial<Settings>),
  ) =>
    onChange((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
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
          <h2 id="settings-title">{t("library.settings")}</h2>
          <button aria-label={t("settings.close_settings")} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="settings-layout">
          <nav
            className="settings-category-nav"
            role="tablist"
            aria-label={t("settings.settings_categories")}
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
                <h3>{t("settings.playback_preferences")}</h3>
                <label className="source-preference-setting">
                  {t("detail.best_source_policy")}
                  <Select
                    aria-label={t("detail.best_source_policy")}
                    value={settings.sourcePreference || "resolution"}
                    onChange={(e) =>
                      set({
                        sourcePreference: e.target
                          .value as Settings["sourcePreference"],
                      })
                    }
                  >
                    <option value="resolution">
                      {t("detail.highest_resolution")}
                    </option>
                    <option value="bitrate">
                      {t("detail.highest_bitrate")}
                    </option>
                  </Select>
                  <small>{t("detail.auto_source_hint")}</small>
                </label>
                <SwitchField
                  title={t("settings.play_within_the_app")}
                  description={t(
                    "settings.when_off_use_a_separate_video_window",
                  )}
                  checked={settings.embedded}
                  onChange={(value) => set({ embedded: value })}
                />
                <NumberField
                  title={t("settings.intro_skip_duration_seconds")}
                  value={settings.introSeconds}
                  min={0}
                  max={600}
                  onChange={(value) => set({ introSeconds: value })}
                />
                <NumberField
                  title={t("settings.credits_skip_duration_seconds")}
                  value={settings.outroSeconds}
                  min={0}
                  max={600}
                  onChange={(value) => set({ outroSeconds: value })}
                />
                <SwitchField
                  title={t("settings.auto_play_next_episode")}
                  description={t(
                    "settings.continue_after_this_episode_finishes_and_progress",
                  )}
                  checked={settings.autoNext}
                  onChange={(value) => set({ autoNext: value })}
                />
                <SettingRow
                  title={t("settings.playback_compatibility_mode")}
                  description={t(
                    "settings.prefer_direct_play_by_default_negotiate_transcoding",
                  )}
                >
                  <Select
                    aria-label={t("settings.playback_compatibility_mode")}
                    value={settings.compatibility || "prefer-direct"}
                    onChange={(e) =>
                      set({
                        compatibility: e.target
                          .value as Settings["compatibility"],
                      })
                    }
                  >
                    <option value="prefer-direct">
                      {t("settings.prefer_direct_play")}
                    </option>
                    <option value="auto">
                      {t("settings.auto_server_source_order")}
                    </option>
                    <option value="direct-only">
                      {t("settings.direct_play_only")}
                    </option>
                  </Select>
                </SettingRow>
              </>
            )}
            {section === "audio" && (
              <>
                <SettingRow title={t("settings.preferred_audio_language")}>
                  <Select
                    aria-label={t("settings.preferred_audio_language")}
                    value={settings.audioLanguage}
                    onChange={(e) => set({ audioLanguage: e.target.value })}
                  >
                    <option value="auto">{t("settings.server_default")}</option>
                    <option value="zh">{t("settings.chinese")}</option>
                    <option value="en">{t("settings.english")}</option>
                    <option value="ja">{t("settings.japanese")}</option>
                  </Select>
                </SettingRow>
              </>
            )}
            {section === "subtitles" && (
              <>
                <SettingRow title={t("settings.preferred_subtitle_language")}>
                  <Select
                    aria-label={t("settings.preferred_subtitle_language")}
                    value={settings.subtitleLanguage}
                    onChange={(e) => set({ subtitleLanguage: e.target.value })}
                  >
                    <option value="auto">{t("settings.server_default")}</option>
                    <option value="off">{t("settings.off_by_default")}</option>
                    <option value="zh">{t("settings.chinese")}</option>
                    <option value="en">{t("settings.english")}</option>
                    <option value="ja">{t("settings.japanese")}</option>
                  </Select>
                </SettingRow>
                <p className="setting-note">
                  {" "}
                  {t(
                    "settings.adjust_subtitle_size_delay_and_dual_subtitles",
                  )}{" "}
                </p>
              </>
            )}
            {section === "playback" && (
              <>
                <SliderField
                  title={t("settings.initial_volume")}
                  description={settings.volume + "%"}
                  value={settings.volume}
                  min={0}
                  max={100}
                  onChange={(value) => set({ volume: value })}
                />
                <SwitchField
                  title={t("settings.start_playback_in_fullscreen")}
                  checked={settings.fullscreen}
                  onChange={(value) => set({ fullscreen: value })}
                />
                <p className="setting-note">
                  {t(
                    "settings.preferences_are_saved_automatically_and_apply_to",
                  )}
                </p>
                <ActionRow>
                  <button
                    className="secondary"
                    onClick={() => {
                      api?.cache.clear();
                      setResult(t("settings.memory_cache_cleared"));
                    }}
                  >
                    {" "}
                    {t("settings.clear_memory_cache")}{" "}
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
                <h3>{t("settings.local_danmaku")}</h3>
                <p className="setting-note">
                  {" "}
                  {t("settings.choose_a_bilibili_xml_or_ass_file")}{" "}
                </p>
                <DanmakuSourceSettings
                  value={settings.danmaku?.sources}
                  onChange={(update) =>
                    set((current) => ({
                      danmaku: normalizeDanmaku({
                        ...current.danmaku,
                        sources: update(
                          normalizeSources(current.danmaku?.sources),
                        ),
                      }),
                    }))
                  }
                />
                <DanmakuSettings
                  value={normalizeDanmaku(settings.danmaku)}
                  onChange={(patch) =>
                    set((current) => ({
                      danmaku: normalizeDanmaku({
                        ...current.danmaku,
                        ...patch,
                      }),
                    }))
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
            {result && (
              <p role="status" className="connection-result">
                {localizeMessage(result)}
              </p>
            )}
            <small>Miry v{APP_VERSION}</small>
          </div>
        </div>
      </section>
    </div>
  );
}
