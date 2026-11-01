import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
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
  historyTermAllowed,
} from "../stores/searchHistory";

export default function SearchBar({
  scope,
  onSearch,
  disabled = false,
  value,
  onChange,
  onClear,
  sensitiveValues = [],
}: {
  scope: string;
  onSearch: (query: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (query: string) => void;
  onClear?: () => void;
  sensitiveValues?: string[];
}) {
  useI18n();

  const [localQuery, setLocalQuery] = useState("");
  const query = value ?? localQuery;
  const setQuery = (next: string) => {
    setLocalQuery(next);
    onChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(() =>
    readSearchHistory(scope).filter((term) =>
      historyTermAllowed(term, sensitiveValues),
    ),
  );
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
  const sensitiveKey = JSON.stringify(sensitiveValues);
  useEffect(() => {
    const stored = readSearchHistory(scope);
    const safe = stored.filter((term) =>
      historyTermAllowed(term, sensitiveValues),
    );
    // Rewrite once per account/credential change to remove legacy unsafe entries
    // from storage as well as from the visible suggestions.
    setHistory(saveSearchHistory(scope, safe));
  }, [scope, sensitiveKey]);
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
    setHistory(recordSearch(scope, term, sensitiveValues));
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
        aria-label={t("library.submit_media_search")}
        disabled={disabled || !searchTerm(query)}
      >
        <Search size={17} />
      </button>
      <input
        ref={input}
        aria-label={t("library.search_media")}
        placeholder={t("library.search_movies_and_tv_shows")}
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
          aria-label={t("library.clear_search_terms")}
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
          aria-label={t("library.recent_searches")}
        >
          <div className="search-history-heading">
            <span>{t("library.recent_searches")}</span>
            <button
              type="button"
              onClick={() => {
                setHistory(saveSearchHistory(scope, []));
                setOpen(false);
                input.current?.focus();
              }}
            >
              {" "}
              {t("library.clear_history")}{" "}
            </button>
          </div>
          {suggestions.map((term) => (
            <div className="search-history-row" key={term}>
              <button
                type="button"
                data-search-term
                aria-label={t("library.search_for", { p0: term })}
                onClick={() => submit(term)}
              >
                <History size={15} />
                <span>{term}</span>
                <ArrowUpRight size={14} />
              </button>
              <button
                type="button"
                className="search-history-remove"
                aria-label={t("library.remove_search_history_for", {
                  p0: term,
                })}
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
