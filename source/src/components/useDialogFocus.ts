import { useCallback, useEffect, useRef, type RefObject } from "react";
const dialogStack: symbol[] = [];
export default function useDialogFocus(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
  disabled = false,
  enabled = true,
  initial = "button:not(:disabled),input:not(:disabled),[tabindex='0']",
) {
  const close = useRef(onClose),
    blocked = useRef(disabled),
    closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  close.current = onClose;
  blocked.current = disabled;
  const requestClose = useCallback(() => {
    if (blocked.current || closing.current !== undefined) return;
    panel.current?.classList.add("is-closing");
    const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 120;
    closing.current = setTimeout(() => {
      closing.current = undefined;
      close.current();
    }, duration);
  }, [panel]);
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null,
      layer = Symbol("dialog");
    dialogStack.push(layer);
    panel.current?.querySelector<HTMLElement>(initial)?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (
        dialogStack.at(-1) !== layer ||
        e.defaultPrevented ||
        (e.target instanceof Element && e.target.closest("[data-ui-overlay]"))
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']",
        ) || []),
      ].filter((n) => !n.closest("[inert],[hidden],[aria-hidden='true']"));
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !panel.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !panel.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      clearTimeout(closing.current);
      closing.current = undefined;
      panel.current?.classList.remove("is-closing");
      dialogStack.splice(dialogStack.indexOf(layer), 1);
      document.removeEventListener("keydown", keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, [panel, enabled, initial, requestClose]);
  return requestClose;
}
