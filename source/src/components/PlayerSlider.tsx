import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function PlayerSlider({
  label,
  max,
  value,
  disabled,
  commit,
  onEditing,
  className,
}: {
  label: string;
  max: number;
  value: number;
  disabled: boolean;
  commit: (value: number) => void;
  onEditing?: (editing: boolean) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value),
    editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  const finish = () => {
    if (editing.current) {
      editing.current = false;
      onEditing?.(false);
      commit(draft);
    }
  };
  return (
    <input
      className={className}
      style={
        {
          "--player-progress": `${(Math.min(max, draft) / Math.max(1, max)) * 100}%`,
        } as CSSProperties
      }
      aria-label={label}
      type="range"
      min={0}
      max={max}
      step={1}
      value={Math.min(max, draft)}
      disabled={disabled}
      onPointerDown={() => {
        editing.current = true;
        onEditing?.(true);
      }}
      onChange={(e) => {
        editing.current = true;
        onEditing?.(true);
        setDraft(Number(e.target.value));
      }}
      onPointerUp={finish}
      onKeyUp={finish}
      onBlur={finish}
      onPointerCancel={() => {
        editing.current = false;
        setDraft(value);
        onEditing?.(false);
      }}
    />
  );
}
