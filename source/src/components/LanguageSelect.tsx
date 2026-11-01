import Select from "./Select";
import { setLanguage, t } from "../i18n/core";
import { useI18n } from "../i18n/react";

export default function LanguageSelect() {
  const language = useI18n();
  return (
    <Select
      aria-label={t("settings.language")}
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
    >
      <option value="zh-CN">简体中文</option>
      <option value="en-US">English</option>
    </Select>
  );
}
