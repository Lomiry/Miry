export const optionalControls = [
  "volume",
  "subtitle",
  "audio",
  "speed",
  "danmaku",
  "mini",
  "fullscreen",
] as const;
export type OptionalControl = (typeof optionalControls)[number];
export type ControlPreset = "minimal" | "standard" | "full" | "custom";
export interface ControlLayout {
  preset: ControlPreset;
  buttons: OptionalControl[];
}
export const controlPresets: Record<
  Exclude<ControlPreset, "custom">,
  readonly OptionalControl[]
> = {
  minimal: ["volume", "fullscreen"],
  standard: ["volume", "subtitle", "audio", "mini", "fullscreen"],
  full: optionalControls,
};
export function normalizeControlLayout(value: unknown): ControlLayout {
  const raw =
    value && typeof value === "object" ? (value as Partial<ControlLayout>) : {};
  const preset = ["minimal", "standard", "full", "custom"].includes(
    raw.preset || "",
  )
    ? raw.preset!
    : "standard";
  const buttons = Array.isArray(raw.buttons)
    ? [
        ...new Set(
          raw.buttons.filter((id): id is OptionalControl =>
            optionalControls.includes(id),
          ),
        ),
      ]
    : [...controlPresets.standard];
  return { preset, buttons };
}
export function visibleControls(
  layout?: ControlLayout,
): readonly OptionalControl[] {
  const normalized = normalizeControlLayout(layout);
  return normalized.preset === "custom"
    ? normalized.buttons
    : controlPresets[normalized.preset];
}
