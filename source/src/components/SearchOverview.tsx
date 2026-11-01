import { Search } from "lucide-react";
import { t } from "../i18n/core";
import type { SearchGroup } from "../api/aggregate";
import { searchPresentation } from "../api/searchPresentation";
import SearchCounts from "./SearchCounts";

export default function SearchOverview({
  query,
  groups,
  busy,
  demoTotal,
  demoSupplemental = 0,
  filtered,
}: {
  query: string;
  groups: SearchGroup[];
  busy: boolean;
  demoTotal?: number;
  demoSupplemental?: number;
  filtered: boolean;
}) {
  const counts = groups.map(searchPresentation);
  const primary = demoTotal ?? counts.reduce((sum, g) => sum + g.primary, 0);
  const supplemental =
    demoTotal !== undefined
      ? demoSupplemental
      : counts.reduce((sum, g) => sum + g.supplemental, 0);
  return (
    <section
      className="search-overview"
      aria-label={t("search.page")}
      aria-busy={busy}
    >
      <div className="search-overview-title">
        <Search size={24} />
        <div>
          <p>{t("search.all_connections")}</p>
          <h1>{t("library.search_results_for", { p0: query })}</h1>
        </div>
      </div>
      <p role="status">
        {busy ? (
          t("search.loading")
        ) : (
          <SearchCounts primary={primary} supplemental={supplemental} />
        )}{" "}
        ·{" "}
        {demoTotal !== undefined
          ? t("library.demo_mode")
          : t("search.server_groups", { count: groups.length })}
      </p>
      <span className="search-filter-state">
        {filtered ? t("search.filters_active") : t("search.filters_all")}
      </span>
    </section>
  );
}
