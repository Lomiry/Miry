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
          <h2 id="recovery-title">上次播放意外中断</h2>
        </header>
        <div className="settings-body">
          <h3>{privateText(record.title)}</h3>
          <p>{formatTime(record.position)}</p>
          <p className="setting-note">
            这是本机中断记录，与服务器“继续观看”独立。继续播放前需连接同一服务器。
          </p>
          <button className="primary" disabled={busy} onClick={onContinue}>
            从中断位置继续
          </button>
          <button className="secondary" disabled={busy} onClick={onIgnore}>
            忽略中断记录
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
