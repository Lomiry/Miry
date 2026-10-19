import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import IconButton from "./IconButton";
import SectionHeader from "./SectionHeader";

export default function MediaShelf({
  title,
  children,
  landscape = false,
  onViewAll,
}: {
  title: string;
  children: ReactNode;
  landscape?: boolean;
  onViewAll?: () => void;
}) {
  const id = useId();
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const el = rail.current;
    if (!el) return;
    const next = {
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    };
    setEdges((old) =>
      old.start === next.start && old.end === next.end ? old : next,
    );
  };
  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (rail.current) observer.observe(rail.current);
    return () => observer.disconnect();
  }, [children]);
  const move = (direction: number) => {
    const el = rail.current;
    el?.scrollBy({
      left: direction * el.clientWidth * 0.85,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <section
      className={`media-shelf${landscape ? " shelf-wide" : ""}`}
      aria-labelledby={id}
    >
      <SectionHeader className="shelf-heading" title={title} id={id}>
        <div className="shelf-navigation">
          {onViewAll && (
            <button
              className="text-button"
              aria-label={title === "最近加入" ? undefined : `查看全部${title}`}
              onClick={onViewAll}
            >
              查看全部 <ChevronRight size={15} />
            </button>
          )}
          {!(edges.start && edges.end) && (
            <div className="shelf-arrows">
              <IconButton
                label={`${title}向左滚动`}
                disabled={edges.start}
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton
                label={`${title}向右滚动`}
                disabled={edges.end}
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
          )}
        </div>
      </SectionHeader>
      <div
        ref={rail}
        className="media-rail"
        role="group"
        aria-label={`${title}内容`}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            move(e.key === "ArrowLeft" ? -1 : 1);
          }
          if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            rail.current?.scrollTo({
              left: e.key === "Home" ? 0 : rail.current.scrollWidth,
            });
          }
        }}
      >
        {children}
      </div>
    </section>
  );
}
