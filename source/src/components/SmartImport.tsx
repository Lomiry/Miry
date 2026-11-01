import { useId, useRef, useState } from "react";
import { ClipboardPaste, ChevronDown } from "lucide-react";
import { t } from "../i18n/core";
import { parseConnectionText, type ImportCandidate } from "../api/smartImport";

export default function SmartImport({
  onConfirm,
  disabled,
}: {
  onConfirm: (candidate: ImportCandidate, pending: string[]) => void;
  disabled: boolean;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [selected, setSelected] = useState(0);
  const clear = () => {
    setText("");
    setCandidates(null);
    setSelected(0);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="smart-import-control">
      <button
        ref={trigger}
        className="secondary smart-import-trigger"
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? clear() : setOpen(true))}
      >
        <ClipboardPaste size={18} aria-hidden="true" />
        {t("routeC.import")}
        <ChevronDown className="import-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <section
          id={panelId}
          className="smart-import"
          aria-label={t("routeC.import")}
        >
          <p className="setting-note">{t("routeC.import_note")}</p>
          <label>
            {t("routeC.paste")}
            <textarea
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={text}
              maxLength={32000}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value);
                setCandidates(null);
              }}
            />
          </label>
          <div className="import-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || !text.trim()}
              onClick={() => {
                setCandidates(parseConnectionText(text));
                setSelected(0);
                setText("");
              }}
            >
              {t("routeC.preview")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              onClick={clear}
            >
              {t("network.cancel")}
            </button>
          </div>
          {candidates !== null && (
            <div className="import-preview">
              <p className="setting-note" role="status">
                {t(
                  candidates.length
                    ? "routeC.preview_hint"
                    : "routeC.no_candidates",
                )}
              </p>
              {candidates.length > 0 && (
                <>
                  <div
                    className="import-candidates"
                    role="group"
                    aria-label={t("routeC.candidate")}
                  >
                    {candidates.map((candidate, index) => (
                      <label
                        key={candidate.address}
                        className="import-candidate"
                      >
                        <input
                          type="radio"
                          name={panelId + "-candidate"}
                          aria-label={
                            t("routeC.candidate") +
                            " " +
                            (index + 1) +
                            " " +
                            candidate.address
                          }
                          checked={selected === index}
                          disabled={disabled}
                          onChange={() => setSelected(index)}
                        />
                        <span>{candidate.address}</span>
                      </label>
                    ))}
                  </div>
                  <p className="import-credentials-note">
                    {t(
                      candidates[selected]?.username
                        ? "routeC.username_found"
                        : "routeC.username_manual",
                    )}
                    {" · "}
                    {t(
                      candidates[selected]?.password
                        ? "routeC.password_found"
                        : "routeC.password_manual",
                    )}
                  </p>
                  <button
                    className="secondary import-apply"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const candidate = candidates[selected];
                      if (!candidate) return;
                      onConfirm(
                        candidate,
                        candidates
                          .filter((_, i) => i !== selected)
                          .map((c) => c.address),
                      );
                      clear();
                    }}
                  >
                    {t("routeC.use_candidate")}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
