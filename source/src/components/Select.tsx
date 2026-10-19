import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import Popover from "./Popover";
import MenuItem from "./MenuItem";
type Option = { value: string; label: ReactNode; disabled: boolean };
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment) return optionsOf(child.props.children);
    return child.type === "option"
      ? [
          {
            value: String(child.props.value ?? child.props.children ?? ""),
            label: child.props.children,
            disabled: !!child.props.disabled,
          },
        ]
      : [];
  });
}
export default function Select({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = optionsOf(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const [open, setOpen] = useState(false);
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  const selected = String(value ?? local),
    label = options.find((o) => o.value === selected)?.label;
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  return (
    <span className={`ui-select ${className}`}>
      {props.name && <input type="hidden" name={props.name} value={selected} />}
      <button
        ref={trigger}
        type="button"
        id={props.id}
        role="combobox"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={props.title}
        disabled={disabled}
        className="ui-select-trigger"
        data-value={selected}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (["ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        <span>{label || "\u00a0"}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <Popover
        id={id}
        role="listbox"
        label={props["aria-label"] ? props["aria-label"] + "选项" : undefined}
        open={open}
        anchor={trigger}
        onClose={close}
        width={240}
        className="ui-select-options"
      >
        {options.map((o) => (
          <MenuItem
            key={o.value}
            role="option"
            aria-selected={selected === o.value}
            selected={selected === o.value}
            disabled={o.disabled}
            data-value={o.value}
            onClick={() => {
              setLocal(o.value);
              onChange?.({
                target: { value: o.value },
                currentTarget: { value: o.value },
              } as ChangeEvent<HTMLSelectElement>);
              close();
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Popover>
    </span>
  );
}
