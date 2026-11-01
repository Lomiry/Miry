import { t } from "../i18n/core";
import Select from "./Select";
import {
  controlPresets,
  optionalControls,
  visibleControls,
  type ControlLayout,
  type ControlPreset,
  type OptionalControl,
} from "../player/controlLayout";

export function controlLabels(): Record<OptionalControl, string> {
  return {
    volume: t("player.volume"),
    subtitle: t("player.subtitles"),
    audio: t("player.audio_tracks"),
    speed: t("player.speed"),
    danmaku: t("player.danmaku"),
    mini: t("player.mini_window"),
    fullscreen: t("danmaku.fullscreen"),
  };
}
export default function ControlLayoutSettings({
  value,
  change,
  disabled,
}: {
  value: ControlLayout;
  change: (value: ControlLayout) => void;
  disabled: boolean;
}) {
  const labels = controlLabels();
  const visible = visibleControls(value);
  const order = [
    ...visible,
    ...optionalControls.filter((id) => !visible.includes(id)),
  ];
  function edit(buttons: OptionalControl[]) {
    change({ preset: "custom", buttons });
  }
  function move(id: OptionalControl, step: number) {
    const buttons = [...visible];
    const index = buttons.indexOf(id),
      next = index + step;
    if (index < 0 || next < 0 || next >= buttons.length) return;
    [buttons[index], buttons[next]] = [buttons[next], buttons[index]];
    edit(buttons);
  }
  return (
    <div className="player-layout-settings">
      <label>
        {t("player.control_layout")}
        <Select
          aria-label={t("player.control_layout")}
          value={value.preset}
          disabled={disabled}
          onChange={(e) => {
            const preset = e.target.value as ControlPreset;
            change({
              preset,
              buttons:
                preset === "custom"
                  ? [...visible]
                  : [...controlPresets[preset]],
            });
          }}
        >
          <option value="minimal">{t("player.layout_minimal")}</option>
          <option value="standard">{t("player.layout_standard")}</option>
          <option value="full">{t("player.layout_full")}</option>
          <option value="custom">{t("player.layout_custom")}</option>
        </Select>
      </label>
      <p className="player-menu-note">{t("player.layout_help")}</p>
      {order.map((id) => (
        <div className="player-layout-row" key={id}>
          <label>
            <input
              type="checkbox"
              disabled={disabled}
              checked={visible.includes(id)}
              onChange={(e) =>
                edit(
                  e.target.checked
                    ? [...visible, id]
                    : visible.filter((other) => other !== id),
                )
              }
            />
            {labels[id]}
          </label>
          <button
            disabled={disabled || visible.indexOf(id) <= 0}
            aria-label={t("player.move_control_up", { name: labels[id] })}
            onClick={() => move(id, -1)}
          >
            ↑
          </button>
          <button
            disabled={
              disabled ||
              !visible.includes(id) ||
              visible.indexOf(id) === visible.length - 1
            }
            aria-label={t("player.move_control_down", { name: labels[id] })}
            onClick={() => move(id, 1)}
          >
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}
