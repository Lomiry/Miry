import { useEffect, useRef, useState } from "react";
import type { Item } from "../types/emby";
import type { EmbyClient } from "../api/client";
import { Artwork } from "./Artwork";
import PosterFallback from "./PosterFallback";
// Only visible collections request up to four children. Limit concurrent metadata work.
let running = 0;
const waiters: (() => void)[] = [];
async function permit(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (running >= 4)
    await new Promise<void>((resolve, reject) => {
      const proceed = () => {
        signal.removeEventListener("abort", cancel);
        resolve();
      };
      const cancel = () => {
        const at = waiters.indexOf(proceed);
        if (at >= 0) waiters.splice(at, 1);
        reject(new DOMException("Aborted", "AbortError"));
      };
      waiters.push(proceed);
      signal.addEventListener("abort", cancel, { once: true });
    });
  else running++;
  const release = () => {
    const next = waiters.shift();
    if (next) next();
    else running--;
  };
  if (signal.aborted) {
    release();
    throw new DOMException("Aborted", "AbortError");
  }
  return release;
}
export default function CollectionArtwork({
  item,
  api,
}: {
  item: Item;
  api: EmbyClient;
}) {
  const root = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(
      typeof IntersectionObserver === "undefined",
    );
  const [children, setChildren] = useState<Item[] | null>(null);
  useEffect(() => {
    if (visible || !root.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setChildren(null);
    void permit(controller.signal)
      .then(async (done) => {
        release = done;
        const result = await api.items(
          { ParentId: item.Id, Recursive: false, Limit: 4, EnableImages: true },
          controller.signal,
        );
        if (!controller.signal.aborted)
          setChildren(
            result.Items.slice(0, 4).filter(
              (child) => api.artworkImages(child, "poster", 240).length,
            ),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setChildren([]);
      })
      .finally(() => release?.());
    return () => controller.abort();
  }, [api, item.Id, visible]);
  return (
    <div ref={root} className="collection-artwork">
      {children === null ? (
        <div className="art-skeleton" aria-label="正在加载合集封面" />
      ) : children.length ? (
        <div
          className={"collection-mosaic mosaic-" + children.length}
          aria-label={item.Name + " · 合集拼贴"}
        >
          {children.map((child) => (
            <div className="mosaic-cell" key={child.Id}>
              <Artwork
                sources={api.artworkImages(child, "poster", 240)}
                alt={child.Name}
                fallback={<PosterFallback item={child} />}
              />
            </div>
          ))}
        </div>
      ) : (
        <PosterFallback item={item} />
      )}
    </div>
  );
}
