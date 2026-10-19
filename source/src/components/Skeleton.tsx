export default function Skeleton({
  variant = "grid",
}: {
  variant?: "grid" | "home";
}) {
  return (
    <>
      {variant === "home" && (
        <div className="skeleton-feature" aria-hidden="true" />
      )}
      <div role="status" aria-label="正在加载媒体" className="skeleton-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="skeleton-card" key={i} aria-hidden="true">
            <div />
            <span />
            <small />
          </div>
        ))}
      </div>
    </>
  );
}
