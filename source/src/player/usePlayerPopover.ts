import { useCallback, useEffect, useRef, useState } from "react";
import { playerMotion } from "./motion";
import type { PlayerMenu } from "./uiModel";

export function usePlayerPopover() {
  const [menu, setMenu] = useState<PlayerMenu | null>(null);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("open");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef(0),
    nextFrame = useRef(0);
  const current = useRef({ menu, phase });
  current.current = { menu, phase };
  const anchor = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(true);
  const clear = useCallback(() => {
    clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    cancelAnimationFrame(nextFrame.current);
  }, []);
  const finish = useCallback(() => {
    if (current.current.phase !== "closing") return;
    clear();
    current.current.menu = null;
    setMenu(null);
    if (restoreFocus.current) anchor.current?.focus();
  }, [clear]);
  const close = useCallback(
    (restore = true) => {
      if (!current.current.menu || current.current.phase === "closing") return;
      clear();
      restoreFocus.current = restore;
      current.current.phase = "closing";
      setPhase("closing");
      timer.current = setTimeout(
        finish,
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? 0
          : playerMotion.popover.out,
      );
    },
    [clear, finish],
  );
  const open = useCallback(
    (value: PlayerMenu, trigger?: HTMLButtonElement, reposition = false) => {
      if (
        !reposition &&
        current.current.menu === value &&
        current.current.phase !== "closing"
      ) {
        close();
        return;
      }
      clear();
      if (trigger) anchor.current = trigger;
      const reverse =
        current.current.menu === value && current.current.phase === "closing";
      current.current = { menu: value, phase: reverse ? "open" : "opening" };
      setMenu(value);
      setPhase(reverse ? "open" : "opening");
      if (!reverse)
        frame.current = requestAnimationFrame(() => {
          nextFrame.current = requestAnimationFrame(() => setPhase("open"));
        });
    },
    [clear, close],
  );
  useEffect(() => clear, [clear]);
  const reset = useCallback(() => {
    clear();
    current.current = { menu: null, phase: "open" };
    setMenu(null);
    setPhase("open");
  }, [clear]);
  const closeFor = useCallback(
    (value: PlayerMenu | null) => {
      if (current.current.menu === value) close();
    },
    [close],
  );
  return { menu, phase, anchor, open, close, closeFor, finish, reset };
}
