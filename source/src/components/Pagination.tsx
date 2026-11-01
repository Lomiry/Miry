import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { isComposingKey } from "../player/shortcuts";
export default function Pagination({
  page,
  pages,
  hasMore,
  busy = false,
  label = t("library.content_pagination"),
  contextKey,
  onChange,
}: {
  page: number;
  pages?: number;
  hasMore: boolean;
  busy?: boolean;
  label?: string;
  contextKey?: string;
  onChange: (page: number) => void;
}) {
  useI18n();

  const totalPages = pages === undefined ? undefined : Math.max(1, pages);
  const current = Math.min(page + 1, totalPages ?? Infinity);
  const [draft, setDraft] = useState(String(current));
  const [invalid, setInvalid] = useState(false);
  const composing = useRef(false);
  const hintId = useId();
  useEffect(() => {
    setDraft(String(current));
    setInvalid(false);
  }, [page, pages, contextKey]);
  const goToPage = (next: number) => {
    if (
      busy ||
      !Number.isSafeInteger(next) ||
      next < 0 ||
      (totalPages !== undefined && next >= totalPages) ||
      next === page
    )
      return;
    onChange(next);
  };
  const submit = () => {
    if (composing.current || busy || totalPages === undefined) return;
    const value = Number(draft);
    if (
      !/^\d+$/.test(draft) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > totalPages
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(String(value));
    goToPage(value - 1);
  };
  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        disabled={busy || page === 0}
        onClick={() => goToPage(page - 1)}
      >
        <ArrowLeft size={15} /> {t("library.previous")}{" "}
      </button>
      <span>
        {t("library.page_number", { page: page + 1 })}
        {totalPages !== undefined && ` / ${totalPages}`}
      </span>
      {totalPages !== undefined && (
        <form
          className="pagination-jump"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            aria-label={t("library.go_to_page_number")}
            aria-describedby={hintId}
            aria-invalid={invalid || undefined}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={busy}
            style={{
              width: `calc(${Math.max(3, Math.min(5, String(totalPages).length))}ch + 2 * var(--space-3))`,
            }}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && isComposingKey(event.nativeEvent))
                event.preventDefault();
            }}
          />
          <span id={hintId} className="visually-hidden" aria-live="polite">
            {invalid
              ? t("library.enter_a_whole_page_number_from_1", {
                  p0: totalPages,
                })
              : t("library.page_range_1_press_enter_or_select", {
                  p0: totalPages,
                })}
          </span>
          <button type="submit" disabled={busy}>
            {" "}
            {t("library.go")}{" "}
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy || !hasMore}
        onClick={() => goToPage(page + 1)}
      >
        {" "}
        {t("library.next")} <ArrowRight size={15} />
      </button>
    </nav>
  );
}
