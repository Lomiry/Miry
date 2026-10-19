import { useId, useRef, useState, type ReactNode } from "react";
import Popover from "./Popover";
import MenuItem from "./MenuItem";
export default function DropdownMenu({
  label,
  children,
  items,
}: {
  label: string;
  children: ReactNode;
  items: {
    label: string;
    action: () => void;
    disabled?: boolean;
    danger?: boolean;
    selected?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      <Popover
        id={id}
        label={label}
        open={open}
        anchor={trigger}
        onClose={close}
      >
        {items.map((item, i) => (
          <MenuItem
            key={i}
            role="menuitem"
            disabled={item.disabled}
            danger={item.danger}
            selected={item.selected}
            onClick={() => {
              item.action();
              close();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Popover>
    </>
  );
}
