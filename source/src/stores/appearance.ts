export type Theme = "dark" | "light" | "system";
export type UiSize = "standard" | "larger" | "large";
export interface Appearance {
  theme: Theme;
  uiSize: UiSize;
  sidebarCollapsed: boolean | null;
}
const key = "miry-appearance";
export const appearanceEvent = "miry-appearance-changed";
export function readAppearance(): Appearance {
  let raw: Partial<Appearance> = {};
  try {
    raw = JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    /* Ignore invalid local preferences. */
  }
  return {
    theme: raw.theme === "light" || raw.theme === "system" ? raw.theme : "dark",
    uiSize:
      raw.uiSize === "larger" || raw.uiSize === "large"
        ? raw.uiSize
        : "standard",
    sidebarCollapsed:
      typeof raw.sidebarCollapsed === "boolean" ? raw.sidebarCollapsed : null,
  };
}
export function saveAppearance(patch: Partial<Appearance>) {
  localStorage.setItem(key, JSON.stringify({ ...readAppearance(), ...patch }));
  window.dispatchEvent(new Event(appearanceEvent));
}
export function initializeAppearance() {
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)");
  const narrow = window.matchMedia?.("(max-width: 1000px)");
  const update = () => {
    const prefs = readAppearance();
    const root = document.documentElement;
    root.dataset.theme =
      prefs.theme === "system"
        ? dark?.matches
          ? "dark"
          : "light"
        : prefs.theme;
    root.dataset.uiSize = prefs.uiSize;
    root.dataset.sidebar =
      (prefs.sidebarCollapsed ?? narrow?.matches ?? false)
        ? "collapsed"
        : "expanded";
  };
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      window.dispatchEvent(new Event(appearanceEvent));
    }
  };
  update();
  window.addEventListener(appearanceEvent, update);
  window.addEventListener("storage", storage);
  dark?.addEventListener("change", update);
  narrow?.addEventListener("change", update);
  return () => {
    window.removeEventListener(appearanceEvent, update);
    window.removeEventListener("storage", storage);
    dark?.removeEventListener("change", update);
    narrow?.removeEventListener("change", update);
  };
}
