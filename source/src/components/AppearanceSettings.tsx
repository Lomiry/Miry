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
  const [prefs, setPrefs] = useState(readAppearance);
  useEffect(() => {
    const update = () => setPrefs(readAppearance());
    window.addEventListener(appearanceEvent, update);
    return () => window.removeEventListener(appearanceEvent, update);
  }, []);
  return (
    <>
      <h3>外观</h3>
      <SettingRow title="外观">
        <Select
          aria-label="外观"
          value={prefs.theme}
          onChange={(e) => saveAppearance({ theme: e.target.value as Theme })}
        >
          <option value="system">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </Select>
      </SettingRow>
      <SettingRow title="界面字号">
        <Select
          aria-label="界面字号"
          value={prefs.uiSize}
          onChange={(e) => saveAppearance({ uiSize: e.target.value as UiSize })}
        >
          <option value="standard">标准</option>
          <option value="larger">较大</option>
          <option value="large">大</option>
        </Select>
      </SettingRow>
    </>
  );
}
