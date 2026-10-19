export const videoFitModes = ["fit", "fill", "stretch"] as const;
export type VideoFit = (typeof videoFitModes)[number];

export function normalizeVideoFit(value: unknown): VideoFit {
  return value === "fill" || value === "stretch" ? value : "fit";
}

export const videoFitLabels: Record<VideoFit, string> = {
  fit: "自动适应（默认）",
  fill: "填充屏幕",
  stretch: "拉伸铺满",
};
