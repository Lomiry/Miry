import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { playerMotion } from "./motion";
import { shouldIgnorePlayerShortcut } from "./shortcuts";

export function usePlayerChrome(
  enabled: boolean,
  keepVisible: boolean,
  revision: number,
  blocked = false,
  eventTarget = "main",
) {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">(
    "visible",
  );
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem("miry-controls-pinned") === "true";
    } catch {
      return false;
    }
  });
  const console = useRef<HTMLDivElement>(null);
  const current = useRef({
    enabled,
    keepVisible,
    blocked,
    pinned,
    phase,
    keyboard: false,
  });
  Object.assign(current.current, {
    enabled,
    keepVisible,
    blocked,
    pinned,
    phase,
  });
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suspended = useRef(false),
    restoreVisible = useRef(false);
  const [isSuspended, setSuspended] = useState(false);
  const restoreFrame = useRef(0),
    nextRestoreFrame = useRef(0),
    keyboardFrame = useRef(0);
  const clear = useCallback(() => {
    clearTimeout(idle.current);
    clearTimeout(fade.current);
    cancelAnimationFrame(restoreFrame.current);
    cancelAnimationFrame(nextRestoreFrame.current);
    cancelAnimationFrame(keyboardFrame.current);
  }, []);
  const finishFade = useCallback(() => {
    if (current.current.phase !== "fading") return;
    clearTimeout(fade.current);
    if (console.current?.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
    current.current.keyboard = false;
    current.current.phase = "hidden";
    setPhase("hidden");
  }, []);
  const hide = useCallback(() => {
    if (
      !current.current.enabled ||
      current.current.blocked ||
      current.current.keepVisible ||
      current.current.phase !== "visible"
    )
      return;
    clear();
    current.current.phase = "fading";
    setPhase("fading");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      finishFade();
    else fade.current = setTimeout(finishFade, playerMotion.chrome.out);
  }, [clear, finishFade]);
  const reveal = useCallback(() => {
    if (suspended.current) return;
    clear();
    if (current.current.phase !== "visible") {
      current.current.phase = "visible";
      setPhase("visible");
    }
    const s = current.current;
    if (s.enabled && !s.keepVisible && !s.pinned && !s.keyboard)
      idle.current = setTimeout(hide, 2800);
  }, [clear, hide]);
  const toggle = useCallback(
    () => (current.current.phase === "visible" ? hide() : reveal()),
    [hide, reveal],
  );
  const suspend = useCallback(() => {
    if (suspended.current) {
      clear();
      return;
    }
    suspended.current = true;
    setSuspended(true);
    restoreVisible.current = current.current.phase !== "hidden";
    clear();
    current.current.phase = "hidden";
    setPhase("hidden");
  }, [clear]);
  const resume = useCallback(() => {
    if (!suspended.current) return;
    cancelAnimationFrame(restoreFrame.current);
    cancelAnimationFrame(nextRestoreFrame.current);
    // Paint the suspended state before using the normal show transition.
    restoreFrame.current = requestAnimationFrame(() => {
      nextRestoreFrame.current = requestAnimationFrame(() => {
        suspended.current = false;
        setSuspended(false);
        if (restoreVisible.current) reveal();
      });
    });
  }, [reveal]);
  useEffect(() => {
    const visibility = () => (document.hidden ? suspend() : resume());
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [suspend, resume]);
  useEffect(() => {
    reveal();
    return clear;
  }, [enabled, keepVisible, pinned, revision, reveal, clear]);
  useEffect(() => {
    if (!enabled) return;
    const keyboard = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || shouldIgnorePlayerShortcut(e))
        return;
      if (e.key.toLowerCase() === "h" && !current.current.blocked) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Tab") {
        current.current.keyboard = true;
        reveal();
      } else reveal();
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [enabled, reveal, toggle]);
  useEffect(() => {
    if (!isTauri() || !enabled) return;
    let active = true;
    let remove: (() => void) | undefined;
    void listen<string>(
      "player-controls",
      ({ payload }) => {
        if (!active) return;
        if (payload === "suspend") {
          suspend();
          return;
        }
        if (payload === "resume") {
          resume();
          return;
        }
        if (payload === "toggle") {
          toggle();
          return;
        }
        current.current.keyboard = payload === "keyboard";
        reveal();
        if (payload === "keyboard")
          keyboardFrame.current = requestAnimationFrame(() =>
            console.current
              ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
              ?.focus(),
          );
      },
      { target: eventTarget },
    )
      .then((fn) => (active ? (remove = fn) : fn()))
      .catch(() => {});
    return () => {
      active = false;
      remove?.();
    };
  }, [enabled, toggle, reveal, eventTarget, suspend, resume]);
  return {
    suspended: isSuspended,
    phase: enabled ? phase : "visible",
    pinned,
    console,
    onTransitionEnd: (event: TransitionEvent<HTMLDivElement>) => {
      if (
        event.target === event.currentTarget &&
        event.propertyName === "opacity"
      )
        finishFade();
    },
    reveal,
    hide,
    pointer: () => {
      current.current.keyboard = false;
      reveal();
    },
    hover: (value: boolean) => {
      reveal();
    },
    pin: (value: boolean) => {
      setPinned(value);
      try {
        localStorage.setItem("miry-controls-pinned", String(value));
      } catch {
        /* Playback stays usable. */
      }
    },
  };
}
