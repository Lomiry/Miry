import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Settings } from "../stores/settings";
import type { EmbyClient } from "../api/client";
import type { PlayerSnapshot } from "../player/playback";
import { SettingRow, SwitchField } from "./SettingField";
import Select from "./Select";
import { APP_VERSION } from "../version";
import { diagnostics } from "../player/desktop";
import { privateError } from "../privacy";
import { checkRelease, RELEASE_PAGE_URL, type ReleaseInfo } from "../release";
import AppIcon from "./AppIcon";
import { offerUpdate } from "../stores/inAppUpdate";
export default function DesktopSettings({
  settings,
  onChange,
  api,
  snapshot,
}: {
  settings: Settings;
  onChange: (v: Settings) => void;
  api: EmbyClient | null;
  snapshot?: PlayerSnapshot;
}) {
  useI18n();
  const mounted = useRef(false);
  const checking = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [release, setRelease] = useState<ReleaseInfo>();
  async function check() {
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    setStatus("");
    setRelease(undefined);
    try {
      const r = await checkRelease();
      if (!mounted.current) return;
      setRelease(r);
      setStatus(
        r.newer
          ? t("settings.version_is_available", { p0: r.version })
          : t("settings.you_re_up_to_date"),
      );
    } catch (e) {
      if (!mounted.current) return;
      setStatus(
        t("settings.could_not_check_for_updates", { p0: privateError(e) }),
      );
    } finally {
      checking.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function exportReport() {
    setBusy(true);
    try {
      const path = await invoke<string>("export_diagnostics", {
        payload: diagnostics(api?.account, snapshot),
        secrets: api
          ? [
              api.account.token,
              api.account.server,
              api.account.userId,
              api.account.deviceId,
            ]
          : [],
      });
      setStatus(t("settings.anonymous_diagnostics_saved", { p0: path }));
    } catch (e) {
      setStatus(privateError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h3>
        <AppIcon decorative /> Miry v{APP_VERSION}
      </h3>
      <p className="setting-note">
        {" "}
        {t("settings.online_danmaku_is_provided_by_the_play")}{" "}
      </p>
      <p className="setting-note">{t("settings.signed_updates_description")}</p>
      <SwitchField
        title={t("settings.windows_media_controls")}
        description={t("settings.sync_playback_status_and_system_media_keys")}
        checked={settings.systemMedia !== false}
        onChange={(v) => onChange({ ...settings, systemMedia: v })}
      />
      <SettingRow
        title={t("tray.closeTitle")}
        description={t("tray.closeDescription")}
      >
        <Select
          aria-label={t("tray.closeTitle")}
          value={settings.closeToTray ? "tray" : "exit"}
          onChange={(event) =>
            onChange({
              ...settings,
              closeToTray: event.target.value === "tray",
            })
          }
        >
          <option value="exit">{t("tray.exit")}</option>
          <option value="tray">{t("tray.tray")}</option>
        </Select>
      </SettingRow>
      <SettingRow
        title={t("tray.minimizeTitle")}
        description={t("tray.minimizeDescription")}
      >
        <Select
          aria-label={t("tray.minimizeTitle")}
          value={settings.minimizeToTray ? "tray" : "minimize"}
          onChange={(event) =>
            onChange({
              ...settings,
              minimizeToTray: event.target.value === "tray",
            })
          }
        >
          <option value="minimize">{t("tray.minimize")}</option>
          <option value="tray">{t("tray.tray")}</option>
        </Select>
      </SettingRow>
      <p className="setting-note">{t("tray.hint")}</p>
      <div className="about-actions">
        <button
          className="secondary"
          disabled={!isTauri()}
          onClick={() =>
            void invoke("exit_app").catch((e) => setStatus(privateError(e)))
          }
        >
          {t("tray.exit")}
        </button>
        <button
          className="secondary"
          disabled={busy || !isTauri()}
          onClick={() => void check()}
        >
          {" "}
          {t("settings.check_for_updates")}{" "}
        </button>
        <button
          className="secondary"
          disabled={!isTauri()}
          onClick={() =>
            void invoke("open_release", { url: RELEASE_PAGE_URL }).catch((e) =>
              setStatus(privateError(e)),
            )
          }
        >
          {" "}
          {t("settings.github_releases")}{" "}
        </button>
        <button
          className="secondary"
          disabled={busy || !isTauri()}
          onClick={() => void exportReport()}
        >
          {" "}
          {t("settings.export_anonymous_diagnostics")}{" "}
        </button>
        {release?.newer && (
          <button
            className="secondary"
            onClick={() => {
              offerUpdate({
                version: release.version,
                url: release.url,
                notes: release.notes.trim().slice(0, 600),
                updateReady: release.update_ready === true,
              });
              setStatus(t("updates.offered"));
            }}
          >
            {t("updates.update_now")}
          </button>
        )}
      </div>
      {release?.newer && (
        <>
          <p>{release.name || `Miry v${release.version}`}</p>
          <pre className="release-notes">{release.notes}</pre>
        </>
      )}
      {release?.update_ready === false && (
        <p role="status" className="setting-note">
          {t("updates.signing_blocked")}
        </p>
      )}
      {status && (
        <p role="status" className="connection-result">
          {localizeMessage(status)}
        </p>
      )}
    </>
  );
}
