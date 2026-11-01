import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import type { Item } from "../types/emby";

export function mediaProgress(item: Item) {
  const data = item.UserData;
  const percentage =
    data?.PlayedPercentage ||
    (item.RunTimeTicks && item.RunTimeTicks > 0
      ? ((data?.PlaybackPositionTicks || 0) / item.RunTimeTicks) * 100
      : 0);
  return Number.isFinite(percentage)
    ? Math.max(0, Math.min(100, percentage))
    : 0;
}

export default function MediaProgress({ item }: { item: Item }) {
  useI18n();

  const percentage = mediaProgress(item);
  if (!percentage) return null;
  return (
    <div
      className="media-progress"
      role="progressbar"
      aria-label={t("library.watch_progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percentage)}
    >
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}
