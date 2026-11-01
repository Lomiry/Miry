import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import Select from "./Select";
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Settings } from "../stores/settings";
import {
  normalizeQuality,
  bitstreamCodecs,
  type QualitySettings as Quality,
} from "../player/quality";
import { SettingRow, SwitchField, ActionRow } from "./SettingField";
import { ArrowUp, ArrowDown } from "lucide-react";
import Tooltip from "./Tooltip";

export default function QualitySettings({
  section,
  settings,
  onChange,
}: {
  section: "video" | "audio" | "advanced";
  settings: Settings;
  onChange: (value: Settings) => void;
}) {
  useI18n();

  const q = normalizeQuality(settings.quality, settings.hardwareDecode);
  const [devices, setDevices] = useState<
    { name: string; description: string }[]
  >([{ name: "auto", description: t("player.auto") }]);
  const [files, setFiles] = useState<{
    directory: string;
    mpvConfig: boolean;
    inputConfig: boolean;
    shaders: string[];
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const set = (patch: Partial<Quality>) =>
    onChange({ ...settings, quality: { ...q, ...patch } });
  async function scan() {
    if (!isTauri()) return;
    try {
      if (section === "audio") setDevices(await invoke("audio_devices"));
      else if (section === "advanced")
        setFiles(await invoke("mpv_config_files"));
      setFeedback("");
    } catch {
      setFeedback(t("player.could_not_read_local_resources_try_again"));
    }
  }
  useEffect(() => {
    let active = true;
    if (isTauri()) {
      const command =
        section === "audio"
          ? "audio_devices"
          : section === "advanced"
            ? "mpv_config_files"
            : null;
      if (command)
        void invoke(command)
          .then((value) => {
            if (active) {
              if (section === "audio") setDevices(value as typeof devices);
              else setFiles(value as typeof files);
            }
          })
          .catch(() => {
            if (active)
              setFeedback(t("player.could_not_read_local_resources_try_again"));
          });
    }
    return () => {
      active = false;
    };
  }, [section]);
  const move = (index: number, direction: number) => {
    const order = [...q.shaders],
      target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    set({ shaders: order });
  };
  return (
    <section className="setting-section">
      {section === "video" && (
        <>
          <h3>{t("player.video_output")}</h3>
          <SettingRow
            title={t("player.hdr_processing")}
            description={t(
              "player.mpv_negotiates_with_the_current_display_automatically",
            )}
          >
            <Select
              aria-label={t("player.hdr_processing")}
              value={q.hdr}
              onChange={(e) => set({ hdr: e.target.value as Quality["hdr"] })}
            >
              <option value="auto">{t("player.auto")}</option>
              <option value="source">{t("player.unmodified_output")}</option>
              <option value="sdr">HDR → SDR</option>
            </Select>
          </SettingRow>
          <p className="setting-note">
            {" "}
            {t(
              "player.unmodified_output_requires_system_and_display_support",
            )}{" "}
          </p>
          <SettingRow title={t("player.hardware_decoding")} separator={false}>
            <Select
              aria-label={t("player.hardware_decoding_mode")}
              value={q.hwdec}
              onChange={(e) =>
                set({ hwdec: e.target.value as Quality["hwdec"] })
              }
            >
              <option value="auto">{t("player.auto")}</option>
              <option value="auto-safe">{t("player.auto_safe")}</option>
              <option value="no">{t("player.off")}</option>
            </Select>
          </SettingRow>
        </>
      )}
      {section === "audio" && (
        <>
          <h3>{t("player.audio_output")}</h3>
          <SettingRow
            title={t("player.audio_passthrough")}
            description={t("player.auto_uses_pcm_when_device_capabilities_are")}
          >
            <Select
              aria-label={t("player.audio_passthrough")}
              value={q.passthrough}
              onChange={(e) =>
                set({ passthrough: e.target.value as Quality["passthrough"] })
              }
            >
              <option value="auto">{t("player.auto")}</option>
              <option value="on">{t("player.on")}</option>
              <option value="off">{t("player.off")}</option>
            </Select>
          </SettingRow>
          <fieldset>
            <legend>{t("player.allowed_passthrough_formats")}</legend>
            {bitstreamCodecs.map((codec) => (
              <SwitchField
                key={codec}
                title={codec.toUpperCase()}
                checked={q.codecs.includes(codec)}
                onChange={(checked) =>
                  set({
                    codecs: checked
                      ? [...q.codecs, codec]
                      : q.codecs.filter((c) => c !== codec),
                  })
                }
              />
            ))}
          </fieldset>
          <SettingRow
            title={t("player.audio_device")}
            description={t("player.if_the_device_is_unavailable_try_the")}
          >
            <Select
              aria-label={t("player.audio_device")}
              value={
                devices.some((d) => d.name === q.audioDevice)
                  ? q.audioDevice
                  : "auto"
              }
              onChange={(e) => set({ audioDevice: e.target.value })}
            >
              {devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name === "auto" ? t("player.auto") : d.description}
                </option>
              ))}
            </Select>
          </SettingRow>
          {q.audioDevice !== "auto" &&
            !devices.some((d) => d.name === q.audioDevice) && (
              <p role="status">
                {" "}
                {t("player.the_saved_device_is_unavailable_the_next")}{" "}
              </p>
            )}
          <ActionRow>
            <button className="secondary" onClick={scan}>
              {" "}
              {t("player.refresh_audio_devices")}{" "}
            </button>
          </ActionRow>
        </>
      )}
      {section === "advanced" && (
        <>
          <h3>{t("player.mpv_extensions")}</h3>
          <p className="setting-note">
            {" "}
            {t(
              "player.external_configuration_is_disabled_by_default_when",
            )}{" "}
          </p>
          <ActionRow>
            <button
              className="secondary"
              disabled={!isTauri()}
              onClick={() =>
                void invoke("open_mpv_directory").catch(() =>
                  setFeedback(
                    t("player.could_not_open_the_configuration_folder"),
                  ),
                )
              }
            >
              {" "}
              {t("player.open_mpv_configuration_folder")}{" "}
            </button>
            <button className="secondary" onClick={scan}>
              {" "}
              {t("player.refresh_configuration_files")}{" "}
            </button>
          </ActionRow>
          {files && <p className="setting-note">{files.directory}</p>}
          <SwitchField
            title={t("player.use_custom_mpv_conf")}
            description={
              files?.mpvConfig
                ? t("player.file_found")
                : t("player.place_mpv_conf_in_the_configuration_folder")
            }
            checked={q.mpvConfig}
            onChange={(value) => set({ mpvConfig: value })}
          />
          <SwitchField
            title={t("player.use_custom_input_conf")}
            description={
              files?.inputConfig
                ? t("player.file_found")
                : t("player.place_input_conf_in_the_configuration_folder")
            }
            checked={q.inputConfig}
            onChange={(value) => set({ inputConfig: value })}
          />
          <SettingRow
            title={t("player.extra_mpv_arguments")}
            description={t("player.one_name_value_per_line_only_video")}
          >
            <textarea
              aria-label={t("player.extra_mpv_arguments")}
              value={q.extraArgs.join("\n")}
              rows={4}
              onChange={(e) =>
                set({
                  extraArgs: e.target.value
                    .split("\n")
                    .filter(Boolean)
                    .slice(0, 32),
                })
              }
            />
          </SettingRow>
          <SwitchField
            title={t("player.enable_custom_shaders")}
            checked={q.shadersEnabled}
            onChange={(value) => set({ shadersEnabled: value })}
          />
          <p className="setting-note">
            {" "}
            {t("player.place_valid_glsl_files_in_the_shaders")}{" "}
          </p>
          {files?.shaders.map((name) => (
            <SwitchField
              key={name}
              title={name}
              checked={q.shaders.includes(name)}
              onChange={(checked) =>
                set({
                  shaders: checked
                    ? [...q.shaders, name]
                    : q.shaders.filter((s) => s !== name),
                })
              }
            />
          ))}
          {q.shaders.map((name, index) => (
            <SettingRow key={name} title={`${index + 1}. ${name}`}>
              <Tooltip text={t("player.move_up", { p0: name })}>
                <button
                  aria-label={t("player.move_up", { p0: name })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
              </Tooltip>
              <Tooltip text={t("player.move_down", { p0: name })}>
                <button
                  aria-label={t("player.move_down", { p0: name })}
                  disabled={index === q.shaders.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
              </Tooltip>
            </SettingRow>
          ))}
        </>
      )}
      {feedback && <p role="status">{localizeMessage(feedback)}</p>}
      <p className="setting-note">
        {t("player.changes_apply_the_next_time_you_play")}
      </p>
    </section>
  );
}
