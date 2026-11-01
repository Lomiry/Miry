import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import Pagination from "./Pagination";
import PageSizeControl from "./PageSizeControl";

export default function LibraryPagination({
  page,
  count,
  total,
  totalKnown,
  hasMore,
  onChange,
  label,
  loading = false,
  contextKey,
  pageSize = 30,
  onPageSizeChange,
  showRange = true,
}: {
  page: number;
  count: number;
  total: number;
  totalKnown: boolean;
  hasMore: boolean;
  onChange: (page: number) => void;
  label: string;
  loading?: boolean;
  contextKey?: string;
  pageSize?: number;
  onPageSizeChange?: (value: number) => void;
  showRange?: boolean;
}) {
  useI18n();

  return (
    <div className="library-pagination">
      {showRange && (
        <span className="library-page-range" aria-live="polite">
          {loading
            ? t("library.loading_2")
            : count
              ? `${page * pageSize + 1}–${page * pageSize + count}`
              : t("library.this_page_is_empty")}
          {!loading && count > 0 && totalKnown && ` / ${total}`}
        </span>
      )}
      <Pagination
        page={page}
        pages={totalKnown ? Math.ceil(total / pageSize) : undefined}
        hasMore={hasMore}
        label={label}
        onChange={onChange}
        contextKey={contextKey}
      />
      {onPageSizeChange && (
        <PageSizeControl value={pageSize} onChange={onPageSizeChange} />
      )}
    </div>
  );
}
