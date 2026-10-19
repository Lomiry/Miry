import type { Item } from "../types/emby";
export type ArtworkKind = "poster" | "backdrop" | "episode";
export function artworkCandidates(item: Item, kind: ArtworkKind) {
  type Candidate = [string | undefined, string, string | undefined];
  const primary: Candidate[] = [
    [item.Id, "Primary", item.ImageTags?.Primary],
    [item.SeriesId, "Primary", item.SeriesPrimaryImageTag],
    [
      item.ParentPrimaryItemId || item.ParentId,
      "Primary",
      item.ParentPrimaryImageTag,
    ],
  ];
  const backdrops: Candidate[] = [
    [item.Id, "Backdrop/0", item.BackdropImageTags?.[0]],
    [
      item.ParentBackdropItemId,
      "Backdrop/0",
      item.ParentBackdropImageTags?.[0],
    ],
  ];
  const thumbs: Candidate[] = [
    [item.Id, "Thumb", item.ImageTags?.Thumb],
    [item.ParentThumbItemId, "Thumb", item.ParentThumbImageTag],
    [item.SeriesId, "Thumb", item.SeriesThumbImageTag],
  ];
  return kind === "poster"
    ? primary
    : kind === "backdrop"
      ? [...backdrops, ...primary]
      : [...thumbs, ...backdrops, ...primary];
}
