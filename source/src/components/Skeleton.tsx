import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
export default function Skeleton({
  variant = "grid",
}: {
  variant?: "grid" | "home";
}) {
  useI18n();

  return (
    <>
      {variant === "home" && (
        <div className="skeleton-feature" aria-hidden="true" />
      )}
      <div
        role="status"
        aria-label={t("library.loading_media")}
        className="skeleton-grid"
      >
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
