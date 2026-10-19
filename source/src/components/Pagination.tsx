import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { isComposingKey } from "../player/shortcuts";
export default function Pagination({
  page,
  pages,
  hasMore,
  busy = false,
  label = "内容翻页",
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
        <ArrowLeft size={15} />
        上一页
      </button>
      <span>
        第 {page + 1} 页{totalPages !== undefined && ` / ${totalPages}`}
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
            aria-label="跳转到页码"
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
              ? `请输入 1–${totalPages} 的整数页码`
              : `页码范围 1–${totalPages}，按 Enter 或跳转按钮确认`}
          </span>
          <button type="submit" disabled={busy}>
            跳转
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy || !hasMore}
        onClick={() => goToPage(page + 1)}
      >
        下一页
        <ArrowRight size={15} />
      </button>
    </nav>
  );
}
