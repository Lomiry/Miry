import { useEffect, useRef } from "react";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";

export default function InfiniteLoad({
  root,
  loading,
  error,
  hasMore,
  onLoad,
  count,
}: {
  root: HTMLElement | null;
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  onLoad: () => void;
  count: number;
}) {
  useI18n();
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !root ||
      loading ||
      error ||
      !hasMore ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    let active = true;
    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          active &&
          !triggered &&
          entries.some((entry) => entry.isIntersecting)
        ) {
          triggered = true;
          onLoad();
        }
      },
      { root, rootMargin: "0px 0px 600px 0px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [root, loading, error, hasMore, onLoad, count]);
  return (
    <div ref={sentinel} className="library-pagination" aria-live="polite">
      <span>{t("library.loaded_count", { count })}</span>
      {loading ? (
        t("library.loading")
      ) : error || hasMore ? (
        <button type="button" onClick={onLoad}>
          {t(error ? "library.retry_batch" : "library.load_more")}
        </button>
      ) : (
        t("library.end_of_list")
      )}
    </div>
  );
}
