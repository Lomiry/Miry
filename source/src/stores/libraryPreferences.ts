import type { Item } from "../types/emby";

export interface LibraryPreferences {
  hidden: string[];
  order: string[];
}
const key = "miry-library-preferences";
export const defaultLibraries = (): LibraryPreferences => ({
  hidden: [],
  order: [],
});
function ids(value: unknown) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && !!id && id.length <= 200,
          ),
        ),
      ].slice(0, 500)
    : [];
}
function read(): Record<string, LibraryPreferences> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    if (!raw || Array.isArray(raw) || typeof raw !== "object") return {};
    return Object.fromEntries(
      Object.entries(raw)
        .slice(-100)
        .map(([scope, value]) => {
          const prefs = value as Partial<LibraryPreferences> | null;
          return [
            scope,
            { hidden: ids(prefs?.hidden), order: ids(prefs?.order) },
          ];
        }),
    );
  } catch {
    return {};
  }
}
export function readLibraryPreferences(scope: string): LibraryPreferences {
  return read()[scope] || defaultLibraries();
}
export function saveLibraryPreferences(
  scope: string,
  prefs: LibraryPreferences,
) {
  const all = read();
  delete all[scope];
  localStorage.setItem(
    key,
    JSON.stringify(
      Object.fromEntries(
        [
          ...Object.entries(all),
          [scope, { hidden: ids(prefs.hidden), order: ids(prefs.order) }],
        ].slice(-100),
      ),
    ),
  );
}
export function orderedLibraries(views: Item[], prefs: LibraryPreferences) {
  const ranks = new Map(prefs.order.map((id, index) => [id, index]));
  return [...views].sort(
    (a, b) => (ranks.get(a.Id) ?? Infinity) - (ranks.get(b.Id) ?? Infinity),
  );
}
export function visibleLibraries(views: Item[], prefs: LibraryPreferences) {
  const hidden = new Set(prefs.hidden);
  return orderedLibraries(views, prefs).filter((view) => !hidden.has(view.Id));
}
