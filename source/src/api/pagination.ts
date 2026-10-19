import type { ItemPage } from "../types/emby";

// Some servers omit the total or return zero even when the page has items.
export function pageInfo(result: ItemPage, start: number, limit: number) {
  const loaded = start + result.Items.length;
  const reported = result.TotalRecordCount;
  const totalKnown =
    Number.isSafeInteger(reported) &&
    reported >= loaded &&
    (reported > 0 || start === 0);
  if (totalKnown)
    return {
      total: reported,
      totalKnown: true,
      hasMore: start + limit < reported,
    };
  return {
    total: loaded,
    totalKnown: result.Items.length < limit,
    hasMore: result.Items.length >= limit,
  };
}
