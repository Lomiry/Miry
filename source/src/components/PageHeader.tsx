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
  return (
    <div className="view-switch" role="group" aria-label="显示方式">
      <Tooltip text="海报视图">
        <button
          aria-label="海报视图"
          aria-pressed={!list}
          onClick={() => onChange(false)}
        >
          <LayoutGrid size={17} />
        </button>
      </Tooltip>
      <Tooltip text="列表视图">
        <button
          aria-label="列表视图"
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
