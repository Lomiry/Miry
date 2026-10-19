import { useEffect, useRef, useState } from "react";

export default function SubtitleSlider({
  label,
  value,
  min,
  max,
  step = 1,
  send,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  send: (value: number, persist: boolean) => Promise<void>;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false),
    active = useRef(true),
    sending = useRef(false);
  const latest = useRef<{ value: number; persist: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [error, setError] = useState(false);
  const current = useRef(send),
    draftRef = useRef(value);
  current.current = send;
  useEffect(() => {
    if (!editing.current) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value]);
  const flush = async () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (sending.current || !active.current || !latest.current) return;
    const next = latest.current;
    latest.current = null;
    sending.current = true;
    try {
      await current.current(next.value, next.persist);
      if (active.current) setError(false);
    } catch {
      if (active.current) setError(true);
    } finally {
      sending.current = false;
      const pending = latest.current as {
        value: number;
        persist: boolean;
      } | null;
      if (active.current && pending)
        timer.current = setTimeout(
          () => void flush(),
          pending.persist ? 0 : 50,
        );
    }
  };
  const finish = () => {
    if (!editing.current) return;
    editing.current = false;
    latest.current = { value: draftRef.current, persist: true };
    void flush();
  };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(timer.current);
      latest.current = null;
    };
  }, []);
  return (
    <label className="player-subtitle-slider">
      <span>{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onPointerDown={() => {
          editing.current = true;
        }}
        onChange={(e) => {
          editing.current = true;
          draftRef.current = Number(e.target.value);
          setDraft(draftRef.current);
          latest.current = { value: draftRef.current, persist: false };
          if (!timer.current && !sending.current)
            timer.current = setTimeout(() => void flush(), 50);
        }}
        onPointerUp={finish}
        onKeyUp={finish}
        onBlur={finish}
        onPointerCancel={finish}
      />
      <small>{Math.round(draft * (max <= 3 ? 100 : 1))}%</small>
      {error && <small role="alert">调整未完成，请重试。</small>}
    </label>
  );
}
