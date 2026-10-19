import { memo, useEffect, useRef, useState } from "react";

/** Bounded fallback chain; identical cached/error behavior for cards and backdrops. */
export const Artwork = memo(function Artwork({
  sources,
  alt = "",
  eager = false,
  className = "",
  fallback,
}: {
  sources: (string | undefined)[];
  alt?: string;
  eager?: boolean;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const urls = [...new Set(sources.filter((s): s is string => !!s))];
  const signature = urls.join("\n");
  const [state, setState] = useState({
    signature,
    index: 0,
    loaded: false,
    portrait: false,
  });
  const image = useRef<HTMLImageElement>(null);
  const current =
    state.signature === signature
      ? state
      : { signature, index: 0, loaded: false, portrait: false };
  const source = urls[current.index];
  useEffect(() => {
    const loaded = !!image.current?.complete && !!image.current.naturalWidth;
    setState((s) => ({
      signature,
      index: s.signature === signature ? s.index : 0,
      loaded,
      portrait:
        loaded && image.current!.naturalHeight > image.current!.naturalWidth,
    }));
  }, [signature, source]);
  return source ? (
    <>
      {!current.loaded && <span className="art-skeleton" aria-hidden="true" />}
      <img
        key={source}
        ref={image}
        src={source}
        alt={alt}
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        className={`${current.loaded ? "art-loaded" : "art-loading"}${current.portrait ? " art-portrait" : ""}${className ? ` ${className}` : ""}`}
        onContextMenu={(e) => e.preventDefault()}
        onLoad={(event) =>
          setState({
            signature,
            index: current.index,
            loaded: true,
            portrait:
              event.currentTarget.naturalHeight >
              event.currentTarget.naturalWidth,
          })
        }
        onError={() =>
          setState({
            signature,
            index: current.index + 1,
            loaded: false,
            portrait: false,
          })
        }
      />
    </>
  ) : (
    fallback || null
  );
});
