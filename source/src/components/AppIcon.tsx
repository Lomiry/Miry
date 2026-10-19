import icon from "../assets/miry-icon.svg";

export default function AppIcon({
  decorative = false,
  dragRegion = false,
}: {
  decorative?: boolean;
  dragRegion?: boolean;
}) {
  return (
    <img
      src={icon}
      alt={decorative ? "" : "Miry"}
      aria-hidden={decorative || undefined}
      data-tauri-drag-region={dragRegion || undefined}
      width={32}
      height={32}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    />
  );
}
