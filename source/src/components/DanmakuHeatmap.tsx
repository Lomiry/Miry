import { memo } from "react";
import type { DanmakuDensity } from "../danmaku/density";
// Presentation-only slot: reusable by compact, standard and future custom layouts.
export default memo(function DanmakuHeatmap({
  value,
  duration,
}: {
  value?: DanmakuDensity;
  duration: number;
}) {
  if (
    !value ||
    value.duration !== duration ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    return null;
  return (
    <svg
      className="danmaku-heatmap"
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${value.bins.length} 1`}
      preserveAspectRatio="none"
    >
      {value.bins.map((n, i) =>
        n > 0 ? <rect key={i} x={i} y={1 - n} width={1} height={n} /> : null,
      )}
    </svg>
  );
});
