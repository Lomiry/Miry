import type { ComponentProps } from "react";
import { Poster } from "./Poster";
/** Explicit still-image variant for episode browsers, never inferred from API images. */
export default function EpisodeCard(props: ComponentProps<typeof Poster>) {
  return <Poster {...props} landscape />;
}
