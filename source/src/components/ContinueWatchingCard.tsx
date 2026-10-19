import type { ComponentProps } from "react";
import { MediaTile } from "./PosterCard";
export default function ContinueWatchingCard(
  props: ComponentProps<typeof MediaTile>,
) {
  return <MediaTile {...props} landscape />;
}
