import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
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
  useI18n();

  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const bindings = normalizeShortcuts(settings.shortcuts);
  return (
    <div className="shortcut-settings">
      <h3>{t("player.player_shortcuts")}</h3>
      <p className="setting-note">
        {" "}
        {t("player.select_a_key_field_and_press_a")}{" "}
      </p>
      {(Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => (
        <SettingRow key={action} title={shortcutLabels[action]}>
          <input
            className="shortcut-capture"
            data-bound={!!bindings[action]}
            data-capturing={capturing === action}
            onFocus={() => setCapturing(action)}
            onBlur={() => setCapturing(null)}
            aria-label={t("player.shortcut", { p0: shortcutLabels[action] })}
            readOnly
            value={
              bindings[action].replace(/Key(?=[A-Z])|Digit(?=[0-9])/g, "") ||
              t("player.unassigned")
            }
            onKeyDown={(e) => {
              if (
                e.metaKey ||
                (e.altKey && e.code === "F4") ||
                (e.ctrlKey && e.altKey && e.code === "Delete")
              ) {
                setError(t("player.this_shortcut_is_reserved_by_the_system"));
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
                setError(
                  t("player.this_key_cannot_be_assigned_choose_another"),
                );
                return;
              }
              if (
                code &&
                Object.entries(bindings).some(
                  ([a, k]) => a !== action && k === code,
                )
              ) {
                setError(t("player.this_key_is_already_assigned_to_another"));
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
      {error && <p role="alert">{displayError(error)}</p>}
      <p className="setting-note">
        {" "}
        {t("player.delete_backspace_clears_a_binding_h_toggles")}{" "}
      </p>
      <button
        className="secondary"
        onClick={() => {
          setError("");
          onChange({ ...settings, shortcuts: { ...defaultShortcuts } });
        }}
      >
        {" "}
        {t("player.restore_default_shortcuts")}{" "}
      </button>
    </div>
  );
}
