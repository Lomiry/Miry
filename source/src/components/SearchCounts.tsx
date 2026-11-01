import { t } from "../i18n/core";

export default function SearchCounts({
  primary,
  supplemental,
}: {
  primary: number;
  supplemental: number;
}) {
  return (
    <span className="search-counts">
      <span>
        {t("search.displayed_count", { count: primary + supplemental })}
      </span>
      {supplemental > 0 && (
        <small>
          {t("search.primary_count", { count: primary })} ·{" "}
          {t("search.supplemental_count", { count: supplemental })}
        </small>
      )}
    </span>
  );
}
