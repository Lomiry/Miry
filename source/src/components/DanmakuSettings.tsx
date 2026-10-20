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
  return (
    <div className="danmaku-settings">
      <SwitchField
        title="在线弹幕"
        checked={value.onlineEnabled !== false}
        onChange={(onlineEnabled) => onChange({ onlineEnabled })}
      />
      <SwitchField
        title="自动匹配在线弹幕"
        checked={value.autoMatch !== false}
        onChange={(autoMatch) => onChange({ autoMatch })}
      />
      <SwitchField
        title="显示弹幕"
        checked={value.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      <NumberField
        title="弹幕字体大小"
        value={value.fontSize}
        min={16}
        max={60}
        onChange={(fontSize) => onChange({ fontSize })}
      />
      <SliderField
        title="弹幕透明度"
        valueLabel={Math.round(value.opacity * 100) + "%"}
        value={value.opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(opacity) => onChange({ opacity })}
      />
      <SettingRow title="弹幕滚动速度">
        <Select
          aria-label="弹幕滚动速度"
          value={value.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
          {value.speed > 2 && (
            <option value={value.speed}>{value.speed}× · 已保留原速度</option>
          )}
        </Select>
      </SettingRow>
      <SettingRow
        title="弹幕显示区域"
        description="默认预留底部区域，便于同时观看字幕"
      >
        <Select
          aria-label="弹幕显示区域"
          value={value.area}
          onChange={(e) => onChange({ area: Number(e.target.value) })}
        >
          <option value={0.5}>上 50%</option>
          <option value={0.75}>上 75%</option>
          <option value={1}>全屏</option>
        </Select>
      </SettingRow>
      <SettingRow title="同屏弹幕密度">
        <Select
          aria-label="同屏弹幕密度"
          value={value.density}
          onChange={(e) => onChange({ density: Number(e.target.value) })}
        >
          <option value={24}>低 · 最多 24 条</option>
          <option value={48}>标准 · 最多 48 条</option>
          <option value={96}>高 · 最多 96 条</option>
        </Select>
      </SettingRow>
      <NumberField
        title="弹幕时间偏移（秒）"
        description="正数延后，负数提前；播放菜单中的偏移保存到当前匹配或文件绑定"
        value={value.offset}
        min={-600}
        max={600}
        step={0.1}
        onChange={(offset) => onChange({ offset })}
      />
      <SwitchField
        title="相同弹幕去重"
        checked={value.deduplicate}
        onChange={(deduplicate) => onChange({ deduplicate })}
      />
      <SwitchField
        title="屏蔽彩色弹幕"
        checked={value.blockColor}
        onChange={(blockColor) => onChange({ blockColor })}
      />
      <SwitchField
        title="屏蔽顶部弹幕"
        checked={value.blockTop}
        onChange={(blockTop) => onChange({ blockTop })}
      />
      <SwitchField
        title="屏蔽底部弹幕"
        checked={value.blockBottom}
        onChange={(blockBottom) => onChange({ blockBottom })}
      />
      <SwitchField
        title="屏蔽超长弹幕"
        checked={value.blockLong}
        onChange={(blockLong) => onChange({ blockLong })}
      />
    </div>
  );
}
