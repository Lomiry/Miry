import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  appearanceEvent,
  readAppearance,
  saveAppearance,
} from "../stores/appearance";
const SidebarCollapsed = createContext(false);
export const useSidebarCollapsed = () => useContext(SidebarCollapsed);
export default function Sidebar({
  children,
  navigation,
  header,
}: {
  children: ReactNode;
  navigation?: unknown;
  header?: ReactNode;
}) {
  useI18n();

  const [collapsed, setCollapsed] = useState(
    () =>
      readAppearance().sidebarCollapsed ??
      window.matchMedia?.("(max-width: 1000px)").matches ??
      false,
  );
  useEffect(() => {
    const narrow = window.matchMedia?.("(max-width: 1000px)");
    const update = () =>
      setCollapsed(
        readAppearance().sidebarCollapsed ?? narrow?.matches ?? false,
      );
    window.addEventListener(appearanceEvent, update);
    narrow?.addEventListener("change", update);
    return () => {
      window.removeEventListener(appearanceEvent, update);
      narrow?.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const content = document.querySelector<HTMLElement>(
      ".browse-main > .content",
    );
    const animation = content?.animate?.(
      [
        { opacity: 0.96, transform: "translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 150, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [navigation]);
  const tooltip = (event: SyntheticEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>(".nav");
    if (button) {
      if (collapsed) button.dataset.tooltip = button.textContent?.trim() || "";
      else delete button.dataset.tooltip;
    }
  };
  return (
    <aside
      className="sidebar"
      aria-label={t("library.sidebar")}
      data-collapsed={collapsed}
      onPointerOver={tooltip}
      onFocus={tooltip}
    >
      <div className="sidebar-header">
        {header}
        <button
          className="sidebar-toggle"
          aria-label={
            collapsed
              ? t("library.expand_sidebar")
              : t("library.collapse_sidebar")
          }
          data-tooltip={
            collapsed
              ? t("library.expand_sidebar")
              : t("library.collapse_sidebar")
          }
          aria-expanded={!collapsed}
          onClick={() =>
            saveAppearance({
              sidebarCollapsed: !(
                readAppearance().sidebarCollapsed ?? collapsed
              ),
            })
          }
        >
          {collapsed ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
        </button>
      </div>
      <SidebarCollapsed.Provider value={collapsed}>
        {children}
      </SidebarCollapsed.Provider>
    </aside>
  );
}
