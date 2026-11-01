import { useI18n } from "../i18n/react";
import { t, localizeMessage } from "../i18n/core";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import useDialogFocus from "./useDialogFocus";
import { automaticUpdate, dismissUpdate } from "../stores/automaticUpdates";
import {
  clearUpdate,
  cancelDownload,
  downloadUpdate,
  installUpdate,
  minimizeUpdate,
  offerUpdate,
  subscribeUpdate,
  updateSnapshot,
} from "../stores/inAppUpdate";

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export default function AutomaticUpdateNotice({
  blocked,
  onPrepareInstall = async () => {},
}: {
  blocked: boolean;
  onPrepareInstall?: () => Promise<void>;
}) {
  useI18n();
  const labels = {
    available: t("updates.available"),
    downloading: t("updates.downloading"),
    verifying: t("updates.verifying"),
    ready: t("updates.ready"),
    installing: t("updates.installing"),
    error: t("updates.failed"),
    cancelling: t("updates.cancelling"),
    cancelled: t("updates.cancelled"),
  };
  const state = useSyncExternalStore(subscribeUpdate, updateSnapshot);
  const [restart, setRestart] = useState(true);
  const { release, phase, minimized } = state;
  const panel = useRef<HTMLElement>(null);
  const active =
    phase === "downloading" ||
    phase === "verifying" ||
    phase === "installing" ||
    phase === "cancelling";
  const visible = !!release && (!blocked || phase === "installing");
  const dismiss = () => {
    if (release) dismissUpdate(release.version);
    clearUpdate();
  };
  const close = useDialogFocus(
    panel,
    active || phase === "ready" ? () => minimizeUpdate(true) : dismiss,
    phase === "installing",
    visible && !minimized,
  );
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    void automaticUpdate().then((value) => {
      if (alive && value && !updateSnapshot().release) offerUpdate(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!visible || !release) return null;
  if (minimized)
    return (
      <button
        className="update-background secondary"
        onClick={() => minimizeUpdate(false)}
      >
        {t("updates.background")}
        {labels[phase]}
      </button>
    );
  const percent =
    state.total && state.total > 0
      ? Math.min(100, Math.floor((state.downloaded / state.total) * 100))
      : undefined;
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        className="settings-panel recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
      >
        <header>
          <h2 id="update-title">{labels[phase]}</h2>
        </header>
        <div className="settings-body">
          <p>Miry v{release.version}</p>
          {release.updateReady !== true && (
            <p role="status">{t("updates.signing_blocked")}</p>
          )}
          {phase === "available" && (
            <pre className="release-notes">
              {release.notes || t("updates.release_available")}
            </pre>
          )}
          {(phase === "downloading" || phase === "verifying") && (
            <>
              <progress
                className="update-progress"
                aria-label={t("updates.download_progress")}
                max={100}
                value={percent}
              />
              <p role="status">
                {phase === "verifying"
                  ? t("updates.verifying_signature")
                  : `${percent === undefined ? t("updates.unknown_size") : `${percent}%`} · ${size(state.downloaded)} / ${state.total ? size(state.total) : t("updates.unknown")} · ${size(state.bytesPerSecond)}/s`}
              </p>
            </>
          )}
          {phase === "ready" && (
            <>
              <p role="status">{t("updates.signature_verified")}</p>
              <label>
                <input
                  type="checkbox"
                  checked={restart}
                  onChange={(e) => setRestart(e.target.checked)}
                />{" "}
                {t("updates.restart")}
              </label>
            </>
          )}
          {phase === "installing" && (
            <p role="status">{t("updates.handoff")}</p>
          )}
          {(phase === "cancelling" || phase === "cancelled") && (
            <p role="status">{labels[phase]}</p>
          )}
          {(phase === "error" || (phase === "cancelling" && state.error)) && (
            <p role="alert">{localizeMessage(state.error || "")}</p>
          )}
          <div className="update-notice-actions">
            {(phase === "available" ||
              phase === "error" ||
              phase === "cancelled") && (
              <button
                className="primary"
                disabled={release.updateReady !== true}
                onClick={() => void downloadUpdate()}
              >
                {phase !== "available"
                  ? t("library.retry")
                  : t("updates.update_now")}
              </button>
            )}
            {(phase === "downloading" || phase === "verifying") && (
              <button
                className="secondary"
                onClick={() => void cancelDownload()}
              >
                {t("updates.cancel_download")}
              </button>
            )}
            {phase === "ready" && (
              <button
                className="primary"
                onClick={() => void installUpdate(onPrepareInstall, restart)}
              >
                {t("updates.confirm")}
              </button>
            )}
            <button
              className="secondary"
              disabled={phase === "installing"}
              onClick={close}
            >
              {active
                ? t("updates.download_background")
                : phase === "ready"
                  ? t("updates.install_later")
                  : t("updates.dismiss")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
