import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// CSS and the owned native window consume the same Chrome state. Requests are
// serialized, so a delayed Hide cannot land after the latest Show or cleanup.
export function usePlayerCursor(owned: boolean, hidden: boolean) {
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (!owned || !isTauri()) return;
    const window = getCurrentWindow();
    const apply = (visible: boolean) => {
      queue.current = queue.current
        .catch(() => {})
        .then(() => window.setCursorVisible(visible))
        .catch(() => {
          /* CSS remains authoritative if the owned window is already disposed. */
        });
    };
    apply(!hidden);
    return () => apply(true);
  }, [owned, hidden]);
}
