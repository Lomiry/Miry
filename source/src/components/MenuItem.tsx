import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
export default function MenuItem({
  selected,
  children,
  icon,
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`ui-menu-item${danger ? " is-danger" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      <span className="ui-menu-mark" aria-hidden="true">
        {selected ? <Check size={16} /> : icon}
      </span>
      <span className="ui-menu-label">{children}</span>
    </button>
  );
}
