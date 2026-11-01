import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import type { ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import Tooltip from "./Tooltip";
export function ViewToggle({
  list,
  onChange,
}: {
  list: boolean;
  onChange: (list: boolean) => void;
}) {
  useI18n();

  return (
    <div
      className="view-switch"
      role="group"
      aria-label={t("library.view_mode")}
    >
      <Tooltip text={t("library.poster_view")}>
        <button
          aria-label={t("library.poster_view")}
          aria-pressed={!list}
          onClick={() => onChange(false)}
        >
          <LayoutGrid size={17} />
        </button>
      </Tooltip>
      <Tooltip text={t("library.list_view")}>
        <button
          aria-label={t("library.list_view")}
          aria-pressed={list}
          onClick={() => onChange(true)}
        >
          <List size={17} />
        </button>
      </Tooltip>
    </div>
  );
}
export default function PageHeader({
  title,
  count,
  actions,
}: {
  title: string;
  count: ReactNode;
  actions?: ReactNode;
}) {
  useI18n();

  return (
    <div className="page-header">
      <div className="section-heading">
        <h1>{title}</h1>
        <small>{count}</small>
      </div>
      {actions}
    </div>
  );
}
