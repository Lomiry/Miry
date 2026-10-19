import { useMemo, useRef, useState, useEffect } from "react";
import { Search, History, X, ArrowUpRight } from "lucide-react";
import { isComposingKey } from "../player/shortcuts";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  readSearchHistory,
  recordSearch,
  saveSearchHistory,
  searchSuggestions,
  searchTerm,
} from "../stores/searchHistory";

export default function SearchBar({
  scope,
  onSearch,
  disabled = false,
  value,
  onChange,
  onClear,
}: {
  scope: string;
  onSearch: (query: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (query: string) => void;
  onClear?: () => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const query = value ?? localQuery;
  const setQuery = (next: string) => {
    setLocalQuery(next);
    onChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(() => readSearchHistory(scope));
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const focusInput = () => {
    if (disabled) return;
    input.current?.focus({ preventScroll: true });
    // DOM focus alone doesn't transfer the native keyboard owner from the
    // video/owned overlay back to the main WebView.
    if (isTauri())
      void getCurrentWebview()
        .setFocus()
        .catch(() => {});
  };
  const suggestions = useMemo(
    () => searchSuggestions(history, query),
    [history, query],
  );
  const expanded = open && !disabled && suggestions.length > 0;
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        !disabled &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        focusInput();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [disabled]);
  function submit(value: string) {
    const term = searchTerm(value);
    if (!term || disabled) return;
    setQuery(term);
    setHistory(recordSearch(scope, term));
    setOpen(false);
    onSearch(term);
  }
  function remove(term: string) {
    setHistory(
      saveSearchHistory(
        scope,
        history.filter((entry) => entry !== term),
      ),
    );
    input.current?.focus();
  }
  return (
    <form
      ref={form}
      className="search search-with-history"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) focusInput();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (composing.current) return;
        submit(query);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (composing.current || isComposingKey(event.nativeEvent)) {
          if (event.key === "Enter") event.preventDefault();
          return;
        }
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          input.current?.focus();
        }
        if (!expanded || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [
          ...(form.current?.querySelectorAll<HTMLButtonElement>(
            "[data-search-term]",
          ) || []),
        ];
        const current = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "ArrowDown"
            ? (current + 1) % buttons.length
            : current < 0
              ? buttons.length - 1
              : (current - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}
    >
      <button
        type="submit"
        className="search-submit"
        aria-label="提交媒体搜索"
        disabled={disabled || !searchTerm(query)}
      >
        <Search size={17} />
      </button>
      <input
        ref={input}
        aria-label="搜索媒体"
        placeholder="搜索电影、剧集…"
        autoComplete="off"
        maxLength={80}
        value={query}
        disabled={disabled}
        onPointerDown={focusInput}
        aria-expanded={expanded}
        aria-controls={expanded ? "search-history" : undefined}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          aria-label="清空搜索关键词"
          onClick={() => {
            setQuery("");
            onClear?.();
            setOpen(true);
            input.current?.focus();
          }}
        >
          <X size={15} />
        </button>
      ) : (
        <kbd className="search-shortcut">Ctrl K</kbd>
      )}
      {expanded && (
        <div
          id="search-history"
          className="search-history"
          role="region"
          aria-label="最近搜索"
        >
          <div className="search-history-heading">
            <span>最近搜索</span>
            <button
              type="button"
              onClick={() => {
                setHistory(saveSearchHistory(scope, []));
                setOpen(false);
                input.current?.focus();
              }}
            >
              清空历史
            </button>
          </div>
          {suggestions.map((term) => (
            <div className="search-history-row" key={term}>
              <button
                type="button"
                data-search-term
                aria-label={`搜索 ${term}`}
                onClick={() => submit(term)}
              >
                <History size={15} />
                <span>{term}</span>
                <ArrowUpRight size={14} />
              </button>
              <button
                type="button"
                className="search-history-remove"
                aria-label={`删除搜索记录 ${term}`}
                onClick={() => remove(term)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
