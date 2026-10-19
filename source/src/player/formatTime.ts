export function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 3600) ? Math.floor(n / 3600) + ":" : ""}${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
