import type { SearchGroup } from "./aggregate";

// Keep the visible counts and cards on the same projection. Server totals are
// reserved for pagination; supplemental matches never become primary results.
export function searchPresentation(group: SearchGroup) {
  const items = group.error ? [] : group.items;
  const seen = new Set(items.map((item) => item.Id));
  const suggestions = group.error
    ? []
    : (group.suggestions || []).filter((item) => {
        if (seen.has(item.Id)) return false;
        seen.add(item.Id);
        return true;
      });
  return {
    items,
    suggestions,
    primary: items.length,
    supplemental: suggestions.length,
    displayed: items.length + suggestions.length,
  };
}
