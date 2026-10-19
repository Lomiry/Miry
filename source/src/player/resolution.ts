export function playbackResolution(
  params?: Record<string, unknown>,
): string | null {
  const width = Number(params?.w),
    height = Number(params?.h);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  if (width >= 7680 || height >= 4320) return "8K";
  if (width >= 3840 || height >= 2160) return "4K";
  if (width >= 1920 || height >= 1080) return "1080p";
  if (width >= 1280 || height >= 720) return "720p";
  if (height >= 576 || (width >= 1024 && height >= 400)) return "576p";
  if (height >= 480 || (width >= 854 && height >= 360)) return "480p";
  return null;
}
