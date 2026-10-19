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
  const q = normalizeQuality(settings.quality, settings.hardwareDecode);
  const [devices, setDevices] = useState<
    { name: string; description: string }[]
  >([{ name: "auto", description: "自动" }]);
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
      setFeedback("无法读取本机资源，请稍后重试。");
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
            if (active) setFeedback("无法读取本机资源，请稍后重试。");
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
          <h3>视频输出</h3>
          <SettingRow
            title="HDR 处理"
            description="自动交给 mpv 与当前显示器协商；不会启用 SDR 反向 HDR。"
          >
            <Select
              aria-label="HDR 处理"
              value={q.hdr}
              onChange={(e) => set({ hdr: e.target.value as Quality["hdr"] })}
            >
              <option value="auto">自动</option>
              <option value="source">原样输出</option>
              <option value="sdr">HDR → SDR</option>
            </Select>
          </SettingRow>
          <p className="setting-note">
            原样输出需要系统与显示器支持。Dolby Vision 识别不代表完整输出所有
            Profile；实际输出以 mpv 协商为准。
          </p>
          <SettingRow title="硬件解码" separator={false}>
            <Select
              aria-label="硬件解码模式"
              value={q.hwdec}
              onChange={(e) =>
                set({ hwdec: e.target.value as Quality["hwdec"] })
              }
            >
              <option value="auto">自动</option>
              <option value="auto-safe">安全自动</option>
              <option value="no">关闭</option>
            </Select>
          </SettingRow>
        </>
      )}
      {section === "audio" && (
        <>
          <h3>音频输出</h3>
          <SettingRow
            title="音频直通"
            description="自动在未验证设备能力时使用 PCM；开启后只请求勾选格式。"
          >
            <Select
              aria-label="音频直通"
              value={q.passthrough}
              onChange={(e) =>
                set({ passthrough: e.target.value as Quality["passthrough"] })
              }
            >
              <option value="auto">自动</option>
              <option value="on">开启</option>
              <option value="off">关闭</option>
            </Select>
          </SettingRow>
          <fieldset>
            <legend>允许直通的格式</legend>
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
            title="音频设备"
            description="设备不可用时尝试自动设备与 PCM 回退。"
          >
            <Select
              aria-label="音频设备"
              value={
                devices.some((d) => d.name === q.audioDevice)
                  ? q.audioDevice
                  : "auto"
              }
              onChange={(e) => set({ audioDevice: e.target.value })}
            >
              {devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.description}
                </option>
              ))}
            </Select>
          </SettingRow>
          {q.audioDevice !== "auto" &&
            !devices.some((d) => d.name === q.audioDevice) && (
              <p role="status">
                已保存设备当前不可用，下次播放将尝试自动回退。
              </p>
            )}
          <ActionRow>
            <button className="secondary" onClick={scan}>
              刷新音频设备
            </button>
          </ActionRow>
        </>
      )}
      {section === "advanced" && (
        <>
          <h3>mpv 扩展</h3>
          <p className="setting-note">
            Miry 默认关闭外部配置。显式启用后，顺序为品质设置 → mpv.conf →
            额外参数；会话、认证与窗口仍由 Miry 管理。
          </p>
          <ActionRow>
            <button
              className="secondary"
              disabled={!isTauri()}
              onClick={() =>
                void invoke("open_mpv_directory").catch(() =>
                  setFeedback("无法打开配置目录。"),
                )
              }
            >
              打开 mpv 配置目录
            </button>
            <button className="secondary" onClick={scan}>
              刷新配置文件
            </button>
          </ActionRow>
          {files && <p className="setting-note">{files.directory}</p>}
          <SwitchField
            title="使用自定义 mpv.conf"
            description={
              files?.mpvConfig
                ? "已找到文件"
                : "把 mpv.conf 放入配置目录；未找到时忽略"
            }
            checked={q.mpvConfig}
            onChange={(value) => set({ mpvConfig: value })}
          />
          <SwitchField
            title="使用自定义 input.conf"
            description={
              files?.inputConfig
                ? "已找到文件"
                : "把 input.conf 放入配置目录；Miry 已声明快捷键优先"
            }
            checked={q.inputConfig}
            onChange={(value) => set({ inputConfig: value })}
          />
          <SettingRow
            title="额外 mpv 参数"
            description="每行一个 --名称=值；仅支持画质、音频和字幕调节，不能覆盖播放会话、认证、窗口或写出媒体。"
          >
            <textarea
              aria-label="额外 mpv 参数"
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
            title="启用自定义 Shader"
            checked={q.shadersEnabled}
            onChange={(value) => set({ shadersEnabled: value })}
          />
          <p className="setting-note">
            将合法 .glsl 文件放入 shaders
            子目录，按下面顺序应用；不内置第三方算法。
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
              <Tooltip text={`上移 ${name}`}>
                <button
                  aria-label={`上移 ${name}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
              </Tooltip>
              <Tooltip text={`下移 ${name}`}>
                <button
                  aria-label={`下移 ${name}`}
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
      {feedback && <p role="status">{feedback}</p>}
      <p className="setting-note">更改在下次播放生效。</p>
    </section>
  );
}
