import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import Select from "./Select";
import {
  NumberField,
  SettingRow,
  SliderField,
  SwitchField,
} from "./SettingField";
import type { DanmakuSettings as Preferences } from "../danmaku/types";
export default function DanmakuSettings({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
}) {
  useI18n();

  return (
    <div className="danmaku-settings">
      <SwitchField
        title={t("danmaku.online_danmaku")}
        checked={value.onlineEnabled !== false}
        onChange={(onlineEnabled) => onChange({ onlineEnabled })}
      />
      <SwitchField
        title={t("danmaku.automatically_match_online_danmaku")}
        checked={value.autoMatch !== false}
        onChange={(autoMatch) => onChange({ autoMatch })}
      />
      <SwitchField
        title={t("danmaku.show_danmaku")}
        checked={value.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      <NumberField
        title={t("danmaku.danmaku_font_size")}
        value={value.fontSize}
        min={16}
        max={60}
        onChange={(fontSize) => onChange({ fontSize })}
      />
      <SliderField
        title={t("danmaku.danmaku_opacity")}
        valueLabel={Math.round(value.opacity * 100) + "%"}
        value={value.opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(opacity) => onChange({ opacity })}
      />
      <SettingRow title={t("danmaku.danmaku_scroll_speed")}>
        <Select
          aria-label={t("danmaku.danmaku_scroll_speed")}
          value={value.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
          {value.speed > 2 && (
            <option value={value.speed}>
              {value.speed}
              {t("danmaku.original_speed_retained")}
            </option>
          )}
        </Select>
      </SettingRow>
      <SettingRow
        title={t("danmaku.danmaku_display_area")}
        description={t("danmaku.the_bottom_area_is_reserved_for_subtitles")}
      >
        <Select
          aria-label={t("danmaku.danmaku_display_area")}
          value={value.area}
          onChange={(e) => onChange({ area: Number(e.target.value) })}
        >
          <option value={0.5}>{t("danmaku.top_50")}</option>
          <option value={0.75}>{t("danmaku.top_75")}</option>
          <option value={1}>{t("danmaku.fullscreen")}</option>
        </Select>
      </SettingRow>
      <SettingRow title={t("danmaku.danmaku_density")}>
        <Select
          aria-label={t("danmaku.danmaku_density")}
          value={value.density}
          onChange={(e) => onChange({ density: Number(e.target.value) })}
        >
          <option value={24}>{t("danmaku.low_up_to_24_comments")}</option>
          <option value={48}>{t("danmaku.standard_up_to_48_comments")}</option>
          <option value={96}>{t("danmaku.high_up_to_96_comments")}</option>
        </Select>
      </SettingRow>
      <NumberField
        title={t("danmaku.danmaku_time_offset_seconds")}
        description={t(
          "danmaku.positive_values_delay_comments_negative_values_advance",
        )}
        value={value.offset}
        min={-600}
        max={600}
        step={0.1}
        onChange={(offset) => onChange({ offset })}
      />
      <SwitchField
        title={t("danmaku.hide_duplicate_comments")}
        checked={value.deduplicate}
        onChange={(deduplicate) => onChange({ deduplicate })}
      />
      <SwitchField
        title={t("danmaku.hide_colored_comments")}
        checked={value.blockColor}
        onChange={(blockColor) => onChange({ blockColor })}
      />
      <SwitchField
        title={t("danmaku.hide_top_comments")}
        checked={value.blockTop}
        onChange={(blockTop) => onChange({ blockTop })}
      />
      <SwitchField
        title={t("danmaku.hide_bottom_comments")}
        checked={value.blockBottom}
        onChange={(blockBottom) => onChange({ blockBottom })}
      />
      <SwitchField
        title={t("danmaku.hide_very_long_comments")}
        checked={value.blockLong}
        onChange={(blockLong) => onChange({ blockLong })}
      />
    </div>
  );
}
