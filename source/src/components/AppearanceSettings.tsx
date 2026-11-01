import { t } from "../i18n/core";
import LanguageSelect from "./LanguageSelect";
import { useI18n } from "../i18n/react";
import { useEffect, useState } from "react";
import Select from "./Select";
import { SettingRow } from "./SettingField";
import {
  appearanceEvent,
  readAppearance,
  saveAppearance,
  type Theme,
  type UiSize,
} from "../stores/appearance";
export default function AppearanceSettings() {
  useI18n();

  const [prefs, setPrefs] = useState(readAppearance);
  useEffect(() => {
    const update = () => setPrefs(readAppearance());
    window.addEventListener(appearanceEvent, update);
    return () => window.removeEventListener(appearanceEvent, update);
  }, []);
  return (
    <>
      <h3>{t("settings.appearance")}</h3>
      <SettingRow
        title={t("settings.language")}
        description={t("settings.language_hint")}
      >
        <LanguageSelect />
      </SettingRow>
      <SettingRow title={t("settings.appearance")}>
        <Select
          aria-label={t("settings.appearance")}
          value={prefs.theme}
          onChange={(e) => saveAppearance({ theme: e.target.value as Theme })}
        >
          <option value="system">{t("settings.system")}</option>
          <option value="light">{t("settings.light")}</option>
          <option value="dark">{t("settings.dark")}</option>
        </Select>
      </SettingRow>
      <SettingRow title={t("settings.interface_text_size")}>
        <Select
          aria-label={t("settings.interface_text_size")}
          value={prefs.uiSize}
          onChange={(e) => saveAppearance({ uiSize: e.target.value as UiSize })}
        >
          <option value="standard">{t("settings.standard")}</option>
          <option value="larger">{t("settings.larger")}</option>
          <option value="large">{t("settings.large")}</option>
        </Select>
      </SettingRow>
    </>
  );
}
