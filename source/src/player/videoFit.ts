import { t } from "../i18n/core";
export const videoFitModes = ["fit", "fill", "stretch"] as const;
export type VideoFit = (typeof videoFitModes)[number];

export function normalizeVideoFit(value: unknown): VideoFit {
  return value === "fill" || value === "stretch" ? value : "fit";
}

export const videoFitLabels: Record<VideoFit, string> = {
  get fit() {
    return t("player.video_fit_default");
  },
  get fill() {
    return t("player.video_fit_fill");
  },
  get stretch() {
    return t("player.video_fit_stretch");
  },
};
