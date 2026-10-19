import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Settings } from "../stores/settings";
import type { EmbyClient } from "../api/client";
import type { PlayerSnapshot } from "../player/playback";
import { SwitchField } from "./SettingField";
import { APP_VERSION } from "../version";
import { diagnostics } from "../player/desktop";
import { privateError } from "../privacy";
import { RELEASE_PAGE_URL, type ReleaseInfo } from "../release";
import AppIcon from "./AppIcon";
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
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [release, setRelease] = useState<ReleaseInfo>();
  async function check() {
    setBusy(true);
    setStatus("");
    setRelease(undefined);
    try {
      const r = await invoke<ReleaseInfo>("check_release");
      setRelease(r);
      setStatus(r.newer ? `发现新版本 v${r.version}` : "当前已是最新版本");
    } catch (e) {
      setStatus(`暂时无法检查更新。${privateError(e)}`);
    } finally {
      setBusy(false);
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
      setStatus(`匿名诊断已保存：${path}`);
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
        在线弹幕由弹弹play开放弹幕网络提供 ·
        www.dandanplay.com。发布版已内置接入，作品覆盖以服务实际结果为准。
      </p>
      <p className="setting-note">
        Emby + mpv Windows
        客户端。更新仅检查版本、说明和发布页面，安装由你决定。
      </p>
      <SwitchField
        title="Windows 系统媒体控制"
        description="同步播放状态与系统媒体键；不可用时保留客户端控制"
        checked={settings.systemMedia !== false}
        onChange={(v) => onChange({ ...settings, systemMedia: v })}
      />
      <div className="about-actions">
        <button
          className="secondary"
          disabled={busy || !isTauri()}
          onClick={() => void check()}
        >
          检查新版本
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
          GitHub 发布记录
        </button>
        <button
          className="secondary"
          disabled={busy || !isTauri()}
          onClick={() => void exportReport()}
        >
          导出匿名诊断
        </button>
        {release?.newer && (
          <button
            className="secondary"
            onClick={() =>
              void invoke("open_release", { url: release.url }).catch((e) =>
                setStatus(privateError(e)),
              )
            }
          >
            查看发布页面
          </button>
        )}
      </div>
      {release?.newer && (
        <>
          <p>{release.name || `Miry v${release.version}`}</p>
          <pre className="release-notes">{release.notes}</pre>
        </>
      )}
      {status && (
        <p role="status" className="connection-result">
          {status}
        </p>
      )}
    </>
  );
}
