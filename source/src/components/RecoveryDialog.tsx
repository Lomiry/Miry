import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import useDialogFocus from "./useDialogFocus";
import { useRef } from "react";
import type { RecoveryRecord } from "../player/recovery";
import { formatTime } from "../player/formatTime";
import { privateText } from "../privacy";
export default function RecoveryDialog({
  record,
  busy,
  error,
  onContinue,
  onIgnore: finishIgnore,
}: {
  record: RecoveryRecord;
  busy: boolean;
  error: string;
  onContinue: () => void;
  onIgnore: () => void;
}) {
  useI18n();

  const ref = useRef<HTMLElement>(null);
  const onIgnore = useDialogFocus(ref, finishIgnore, busy);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onIgnore();
      }}
    >
      <section
        ref={ref}
        className="settings-panel recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
      >
        <header>
          <h2 id="recovery-title">
            {t("library.your_last_playback_was_interrupted")}
          </h2>
        </header>
        <div className="settings-body">
          <h3>{privateText(record.title)}</h3>
          <p>{formatTime(record.position)}</p>
          <p className="setting-note">
            {" "}
            {t("library.this_is_a_local_interrupted_playback_record")}{" "}
          </p>
          <button className="primary" disabled={busy} onClick={onContinue}>
            {" "}
            {t("library.resume_interrupted_playback")}{" "}
          </button>
          <button className="secondary" disabled={busy} onClick={onIgnore}>
            {" "}
            {t("library.dismiss_record")}{" "}
          </button>
          {error && <p role="alert">{displayError(error)}</p>}
        </div>
      </section>
    </div>
  );
}
