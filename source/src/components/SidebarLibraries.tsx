import { useEffect, useId, useRef, useState } from "react";
import { Check, Film, LibraryBig, Tv } from "lucide-react";
import type { Item } from "../types/emby";
import Popover from "./Popover";
import { useSidebarCollapsed } from "./Sidebar";

export default function SidebarLibraries({
  libraries,
  activeId,
  onNavigate,
}: {
  libraries: Item[];
  activeId?: string;
  onNavigate: (library: Item) => void;
}) {
  const collapsed = useSidebarCollapsed();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = libraries.find((library) => library.Id === activeId);
  useEffect(() => setOpen(false), [collapsed, activeId, libraries]);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) anchor.current?.focus();
  };
  const icon = (library: Item) =>
    /电视|series/i.test(library.Name) ? <Tv size={19} /> : <Film size={19} />;
  return (
    <>
      <nav
        className="library-nav library-nav-expanded"
        aria-label="媒体库"
        hidden={collapsed}
      >
        {libraries.map((library) => (
          <button
            key={library.Id}
            className={activeId === library.Id ? "nav active" : "nav"}
            aria-current={activeId === library.Id ? "page" : undefined}
            title={library.Name}
            onClick={() => onNavigate(library)}
          >
            {icon(library)} <span>{library.Name}</span>
          </button>
        ))}
      </nav>
      <button
        ref={anchor}
        hidden={!collapsed}
        className={`nav library-rail-trigger${current ? " active" : ""}`}
        aria-label="媒体库"
        aria-current={current ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={collapsed && open}
        aria-controls={collapsed && open ? id : undefined}
        data-tooltip={current ? `媒体库 · ${current.Name}` : "媒体库"}
        onClick={() => setOpen((value) => !value)}
      >
        <LibraryBig size={19} />
        <span>{current ? `媒体库 · ${current.Name}` : "媒体库"}</span>
      </button>
      {collapsed && open && (
        <Popover
          open
          anchor={anchor}
          onClose={close}
          id={id}
          label="选择媒体库"
          width={280}
          className="library-rail-flyout"
        >
          {libraries.length === 0 && <p>暂无媒体库</p>}
          {libraries.map((library) => (
            <button
              key={library.Id}
              role="menuitemradio"
              aria-checked={activeId === library.Id}
              onClick={() => {
                close(true);
                onNavigate(library);
              }}
            >
              {icon(library)}
              <span>{library.Name}</span>
              {activeId === library.Id && <Check size={16} />}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}
