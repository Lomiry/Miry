import { useState } from "react";
import type { Settings } from "../stores/settings";
import {
  defaultShortcuts,
  keyCode,
  normalizeShortcuts,
  shortcutLabels,
  validKey,
  type ShortcutAction,
} from "../player/shortcuts";
import { SettingRow } from "./SettingField";
export default function ShortcutSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const bindings = normalizeShortcuts(settings.shortcuts);
  return (
    <div className="shortcut-settings">
      <h3>播放器快捷键</h3>
      <p className="setting-note">
        点击按键框后按一个键。Miry 的这些绑定优先于 input.conf；其余按键交给
        input.conf / mpv。输入框、滑块、菜单和设置内暂停播放快捷键。
      </p>
      {(Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => (
        <SettingRow key={action} title={shortcutLabels[action]}>
          <input
            className="shortcut-capture"
            data-bound={!!bindings[action]}
            data-capturing={capturing === action}
            onFocus={() => setCapturing(action)}
            onBlur={() => setCapturing(null)}
            aria-label={`${shortcutLabels[action]}快捷键`}
            readOnly
            value={
              bindings[action].replace(/Key(?=[A-Z])|Digit(?=[0-9])/g, "") ||
              "未绑定"
            }
            onKeyDown={(e) => {
              if (
                e.metaKey ||
                (e.altKey && e.code === "F4") ||
                (e.ctrlKey && e.altKey && e.code === "Delete")
              ) {
                setError("该组合键由系统保留，不能绑定。");
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              if (
                e.repeat ||
                ["Alt", "Control", "Shift", "Meta"].includes(e.key)
              )
                return;
              const code =
                !e.ctrlKey &&
                !e.altKey &&
                !e.shiftKey &&
                ["Backspace", "Delete"].includes(e.code)
                  ? ""
                  : keyCode(e.nativeEvent);
              if (code && !validKey(code)) {
                setError("该按键不可绑定，请选择其它按键或组合键。");
                return;
              }
              if (
                code &&
                Object.entries(bindings).some(
                  ([a, k]) => a !== action && k === code,
                )
              ) {
                setError("该按键已用于另一项操作。");
                return;
              }
              setError("");
              onChange({
                ...settings,
                shortcuts: { ...bindings, [action]: code },
              });
            }}
          />
        </SettingRow>
      ))}
      {error && <p role="alert">{error}</p>}
      <p className="setting-note">
        Delete / Backspace 取消绑定；H 保留给控制层显隐。更改在下次播放生效。
      </p>
      <button
        className="secondary"
        onClick={() => {
          setError("");
          onChange({ ...settings, shortcuts: { ...defaultShortcuts } });
        }}
      >
        恢复默认快捷键
      </button>
    </div>
  );
}
