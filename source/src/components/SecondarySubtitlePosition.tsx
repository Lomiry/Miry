import { useEffect, useRef, useState, type PointerEvent } from "react";

export function subtitlePositionAt(
  clientY: number,
  top: number,
  height: number,
) {
  return height > 0
    ? Math.max(0, Math.min(100, Math.round(((clientY - top) / height) * 100)))
    : 0;
}

// This is a position guide. mpv remains the only subtitle renderer.
export default function SecondarySubtitlePosition({
  value,
  send,
  onClose,
}: {
  value: number;
  send: (value: number, persist: boolean) => Promise<void>;
  onClose: (value: number) => void;
}) {
  const original = useRef(value);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const surface = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const pointer = useRef<number | null>(null);
  const latest = useRef<number | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const closing = useRef(false);
  const currentSend = useRef(send);
  currentSend.current = send;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    handle.current?.focus();
    return () => {
      alive.current = false;
      latest.current = null;
      clearTimeout(timer.current);
    };
  }, []);
  function flush() {
    timer.current = undefined;
    if (running.current || closing.current || !alive.current) return;
    running.current = (async () => {
      while (latest.current !== null && alive.current && !closing.current) {
        const next = latest.current;
        latest.current = null;
        try {
          await currentSend.current(next, false);
          if (alive.current) setError("");
        } catch {
          if (alive.current) setError("预览未完成，请重试或取消。");
        }
      }
    })().finally(() => {
      running.current = null;
    });
  }
  function preview(next: number) {
    if (closing.current) return;
    draftRef.current = next;
    setDraft(next);
    latest.current = next;
    if (!timer.current && !running.current)
      timer.current = setTimeout(flush, 50);
  }
  async function finish(confirm: boolean) {
    if (closing.current) return;
    closing.current = true;
    setBusy(true);
    clearTimeout(timer.current);
    timer.current = undefined;
    latest.current = null;
    try {
      await running.current;
      if (!alive.current) return;
      await currentSend.current(
        confirm ? draftRef.current : original.current,
        confirm,
      );
      if (alive.current) onClose(confirm ? draftRef.current : original.current);
    } catch {
      if (alive.current) {
        setError(
          confirm
            ? "位置保存失败，请重试或取消。"
            : "位置恢复失败，请重试取消。",
        );
        setBusy(false);
        closing.current = false;
      }
    }
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current !== event.pointerId || !surface.current) return;
    const rect = surface.current.getBoundingClientRect();
    preview(subtitlePositionAt(event.clientY, rect.top, rect.height));
  }
  return (
    <div
      ref={surface}
      className="secondary-subtitle-position"
      role="dialog"
      aria-modal="true"
      aria-label="调整次字幕位置"
      data-ui-overlay
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          void finish(false);
        }
        if (event.key === "Tab") {
          const buttons = Array.from(
            surface.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) || [],
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          event.preventDefault();
          buttons[
            (index + (event.shiftKey ? -1 : 1) + buttons.length) %
              buttons.length
          ]?.focus();
        }
        event.stopPropagation();
      }}
    >
      <button
        ref={handle}
        className="secondary-subtitle-position-handle"
        style={{ top: `${draft}%`, transform: `translate(-50%, -${draft}%)` }}
        role="slider"
        aria-label="次字幕垂直位置"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={draft}
        aria-orientation="vertical"
        disabled={busy}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          move(event);
          pointer.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
        onKeyDown={(event) => {
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 100
                : event.key === "ArrowUp"
                  ? Math.max(0, draftRef.current - 1)
                  : event.key === "ArrowDown"
                    ? Math.min(100, draftRef.current + 1)
                    : undefined;
          if (next !== undefined) {
            event.preventDefault();
            preview(next);
          }
        }}
      >
        ↕ 次字幕目标位置 · {draft}%
      </button>
      <div
        className="secondary-subtitle-position-actions"
        style={draft >= 50 ? { top: 16, bottom: "auto" } : undefined}
      >
        <p>
          上下拖动预览位置，也可使用方向键。文本字幕保留原生边距；位图字幕不支持移动。
        </p>
        <div>
          <button disabled={busy} onClick={() => preview(0)}>
            恢复默认
          </button>
          <button disabled={busy} onClick={() => void finish(false)}>
            取消
          </button>
          <button disabled={busy} onClick={() => void finish(true)}>
            确认位置
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
