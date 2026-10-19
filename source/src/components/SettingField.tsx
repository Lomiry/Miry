import {
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import Checkbox from "./Checkbox";

export function SettingRow({
  title,
  description,
  children,
  descriptionId,
  disabled = false,
  separator = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  descriptionId?: string;
  disabled?: boolean;
  separator?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`,
    noteId = descriptionId || `${id}-note`;
  const associate = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (!isValidElement<Record<string, unknown>>(node)) return node;
      if (node.type === "span")
        return cloneElement(
          node,
          {},
          associate(node.props.children as ReactNode),
        );
      return cloneElement(node, {
        ...(node.props["aria-label"] ? {} : { "aria-labelledby": labelId }),
        ...(description ? { "aria-describedby": noteId } : {}),
      });
    });
  return (
    <div
      className={`setting-row${disabled ? " is-disabled" : ""}`}
      style={separator ? undefined : { borderBottom: 0 }}
    >
      <span className="setting-label">
        <span id={labelId}>{title}</span>
        {description && <small id={noteId}>{description}</small>}
      </span>
      <span className="setting-control">{associate(children)}</span>
    </div>
  );
}

export function NumberField({
  title,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow title={title} description={description} disabled={disabled}>
      <input
        aria-label={title}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
    </SettingRow>
  );
}
export function SliderField({
  title,
  description,
  valueLabel,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  valueLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const control = (
    <input
      aria-label={title}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
  return (
    <SettingRow title={title} description={description} disabled={disabled}>
      {valueLabel ? (
        <span className="setting-slider-value">
          {control}
          <span className="setting-value" aria-hidden="true">
            {valueLabel}
          </span>
        </span>
      ) : (
        control
      )}
    </SettingRow>
  );
}
export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="setting-actions">{children}</div>;
}
export function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="setting-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function SettingDescription({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <p className={`setting-note${warning ? " is-warning" : ""}`}>{children}</p>
  );
}

export function SwitchField({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingRow title={title} description={description} descriptionId={id}>
      <span className="switch-control">
        <Checkbox
          aria-label={title}
          aria-describedby={description ? id : undefined}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
      </span>
    </SettingRow>
  );
}
