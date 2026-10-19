import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export default function TooltipHost() {
  const [tip, setTip] = useState<{
    text: string;
    x: number;
    y: number;
    below: boolean;
    rail?: boolean;
    closing?: boolean;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined),
    target = useRef<Element | null>(null);
  useEffect(() => {
    let nativeTitle: string | null = null;
    const hide = () => {
      clearTimeout(timer.current);
      clearTimeout(exitTimer.current);
      if (nativeTitle !== null && target.current?.isConnected)
        target.current.setAttribute("title", nativeTitle);
      nativeTitle = null;
      target.current = null;
      setTip((previous) => (previous ? { ...previous, closing: true } : null));
      exitTimer.current = setTimeout(() => setTip(null), 120);
    };
    const show = (e: Event) => {
      if (!(e.target instanceof Element)) return;
      const anchor =
        e.target.closest<HTMLElement>("[data-tooltip]") ||
        e.target.closest<HTMLElement>("button[aria-label]");
      if (
        !anchor ||
        anchor.closest("[inert]") ||
        (anchor as HTMLButtonElement).disabled
      )
        return;
      const explicit = anchor.dataset.tooltip;
      if (
        !explicit &&
        anchor.textContent?.trim() &&
        !anchor.classList.contains("quick-card-button")
      )
        return;
      if (anchor === target.current) return;
      hide();
      target.current = anchor;
      nativeTitle = anchor.getAttribute("title");
      if (nativeTitle !== null) anchor.removeAttribute("title");
      timer.current = setTimeout(() => {
        if (!anchor.isConnected || target.current !== anchor) return;
        const r = anchor.getBoundingClientRect();
        const rail = !!anchor.closest('.sidebar[data-collapsed="true"]');
        const icon = anchor.querySelector("svg")?.getBoundingClientRect() || r;
        setTip({
          text: explicit || anchor.getAttribute("aria-label") || "",
          x: rail
            ? icon.right + 10
            : Math.max(132, Math.min(innerWidth - 132, r.left + r.width / 2)),
          y: rail
            ? icon.top + icon.height / 2
            : r.top < 48
              ? r.bottom + 8
              : r.top - 8,
          below: r.top < 48,
          rail,
        });
      }, 350);
    };
    const leave = (e: Event) => {
      if (
        e instanceof MouseEvent &&
        e.relatedTarget instanceof Node &&
        target.current?.contains(e.relatedTarget)
      )
        return;
      hide();
    };
    document.addEventListener("pointerover", show);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      clearTimeout(exitTimer.current);
      document.removeEventListener("pointerover", show);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  return tip
    ? createPortal(
        <span
          className="ui-tooltip tooltip-portal"
          role="tooltip"
          aria-hidden={tip.closing}
          data-state={tip.closing ? "closing" : "open"}
          style={{
            left: tip.x,
            top: tip.y,
            transform: tip.rail
              ? "translateY(-50%)"
              : `translate(-50%, ${tip.below ? "0" : "-100%"})`,
          }}
        >
          {tip.text}
        </span>,
        document.body,
      )
    : null;
}
