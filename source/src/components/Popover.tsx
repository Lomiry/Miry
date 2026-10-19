import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export function placePopover(
  anchor: Pick<DOMRect, "left" | "top" | "bottom" | "width">,
  viewport: { width: number; height: number },
  requestedWidth: number,
  requestedHeight: number,
) {
  const margin = 12,
    gap = 6;
  const width = Math.max(
    0,
    Math.min(
      Math.max(anchor.width, requestedWidth),
      viewport.width - margin * 2,
    ),
  );
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - gap - margin);
  const flip = below < Math.min(requestedHeight, 160) && above > below;
  const maxHeight = Math.min(320, flip ? above : below);
  return {
    left: Math.max(
      margin,
      Math.min(anchor.left, viewport.width - width - margin),
    ),
    top: flip
      ? Math.max(
          margin,
          anchor.top - gap - Math.min(requestedHeight, maxHeight),
        )
      : anchor.bottom + gap,
    width,
    maxHeight,
    flip,
  };
}
const layers: symbol[] = [];
export default function Popover({
  open,
  anchor,
  onClose,
  children,
  id,
  role = "menu",
  label,
  width = 240,
  className = "",
}: {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  onClose: (restoreFocus?: boolean) => void;
  children: ReactNode;
  id: string;
  role?: "menu" | "listbox" | "dialog";
  label?: string;
  width?: number;
  className?: string;
}) {
  const [present, setPresent] = useState(open);
  const [placement, setPlacement] = useState<ReturnType<typeof placePopover>>();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = setTimeout(() => setPresent(false), 120);
    return () => clearTimeout(timer);
  }, [open]);
  useLayoutEffect(() => {
    if (!present || !anchor.current) return;
    const place = () => {
      if (!anchor.current) return;
      setPlacement(
        placePopover(
          anchor.current.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
          width,
          Math.min(320, panel.current?.scrollHeight || 320),
        ),
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(place);
    observer?.observe(anchor.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [present, width, anchor]);
  useEffect(() => {
    if (!open || !present) return;
    const layer = Symbol("popover");
    layers.push(layer);
    const outside = (e: PointerEvent) => {
      if (
        layers.at(-1) !== layer ||
        panel.current?.contains(e.target as Node) ||
        anchor.current?.contains(e.target as Node)
      )
        return;
      close.current(false);
    };
    const frame = requestAnimationFrame(() => {
      const active =
        panel.current?.querySelector<HTMLElement>(
          '[aria-selected="true"],[aria-checked="true"]',
        ) ||
        panel.current?.querySelector<HTMLElement>(
          "button:not(:disabled),input:not(:disabled)",
        );
      active?.focus();
      active?.scrollIntoView?.({ block: "nearest" });
    });
    document.addEventListener("pointerdown", outside, true);
    return () => {
      cancelAnimationFrame(frame);
      layers.splice(layers.indexOf(layer), 1);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open, present, anchor]);
  if (!present) return null;
  return createPortal(
    <div
      ref={panel}
      id={id}
      role={role}
      aria-label={label}
      aria-hidden={!open}
      inert={!open}
      data-ui-overlay=""
      data-state={open ? "open" : "closing"}
      data-direction={placement?.flip ? "up" : "down"}
      className={`ui-popover ${className}`}
      style={
        placement
          ? {
              position: "fixed",
              left: placement.left,
              top: placement.top,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }
          : { visibility: "hidden" }
      }
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close.current(true);
          return;
        }
        if (e.key === "Tab") {
          // Return to the trigger before the browser follows its normal tab order.
          anchor.current?.focus();
          close.current(false);
          return;
        }
        if (
          !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) ||
          (e.target as Element).closest("input,textarea")
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : (at + (e.key === "ArrowUp" ? -1 : 1) + items.length) %
                items.length;
        items[next]?.focus();
        items[next]?.scrollIntoView?.({ block: "nearest" });
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
