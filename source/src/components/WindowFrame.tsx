import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

export default function WindowFrame({ children }: { children: ReactNode }) {
  const native = isTauri();
  const window = useMemo(() => (native ? getCurrentWindow() : null), [native]);
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!native) return;
    // The browser's default menu/drag data can export authenticated image URLs.
    // Preserve normal text-input menus for entering connection details.
    const contextMenu = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("input, textarea, [contenteditable='true']")
      )
        event.preventDefault();
    };
    const drag = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest("img, a"))
        event.preventDefault();
    };
    document.addEventListener("contextmenu", contextMenu);
    document.addEventListener("dragstart", drag);
    return () => {
      document.removeEventListener("contextmenu", contextMenu);
      document.removeEventListener("dragstart", drag);
    };
  }, [native]);
  useEffect(() => {
    if (!window) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const removers: (() => void)[] = [];
    const track = (subscription: Promise<() => void>) => {
      void subscription
        .then((remove) => (active ? removers.push(remove) : remove()))
        .catch(() => {});
    };
    const refresh = async () => {
      try {
        const [max, full] = await Promise.all([
          window.isMaximized(),
          window.isFullscreen(),
        ]);
        if (active) {
          setMaximized(max);
          setFullscreen(full);
        }
      } catch {
        /* Window may already be closing. */
      }
    };
    void refresh();
    track(
      window.onResized(() => {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 80);
      }),
    );
    track(
      window.onFocusChanged(({ payload }) => {
        if (active) setFocused(payload);
      }),
    );
    return () => {
      active = false;
      clearTimeout(timer);
      removers.forEach((remove) => remove());
    };
  }, [window]);
  async function control(action: "minimize" | "maximize" | "close") {
    if (!window || busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "minimize") await window.minimize();
      if (action === "maximize") {
        await window.toggleMaximize();
        setMaximized(await window.isMaximized());
      }
      // CloseRequested still runs the native progress-save handler.
      if (action === "close") await window.close();
    } catch {
      setError("窗口操作未完成，请重试。");
    } finally {
      setBusy(false);
    }
  }
  if (!native) return children;
  return (
    <div
      className={`desktop-frame${fullscreen ? " native-fullscreen" : ""}${maximized ? " native-maximized" : ""}${focused ? "" : " window-unfocused"}`}
    >
      <header
        className="window-caption"
        aria-label="Miry 窗口栏"
        data-tauri-drag-region
      >
        <div className="window-brand" data-tauri-drag-region>
          <AppIcon decorative dragRegion />
          <strong data-tauri-drag-region>miry</strong>
        </div>
        <div className="window-drag-space" data-tauri-drag-region />
        <div className="window-actions" role="toolbar" aria-label="窗口控制">
          <button
            title="最小化"
            aria-label="最小化窗口"
            disabled={busy}
            onClick={() => void control("minimize")}
          >
            <Minus size={16} />
          </button>
          <button
            title={maximized ? "还原窗口" : "最大化"}
            aria-label={maximized ? "还原窗口" : "最大化窗口"}
            disabled={busy}
            onClick={() => void control("maximize")}
          >
            {maximized ? <Copy size={14} /> : <Square size={14} />}
          </button>
          <button
            className="window-close"
            title="关闭"
            aria-label="关闭窗口"
            disabled={busy}
            onClick={() => void control("close")}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      <div className="desktop-content">{children}</div>
      {error && (
        <p className="window-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
import AppIcon from "./AppIcon";
