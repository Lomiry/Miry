import type { EmbyClient } from "./client";
import type { Item, ItemPage } from "../types/emby";

type Query = Record<string, string | number | boolean | undefined>;
export const candidateLimit = 120;
export const maxSearchRequests = 3;
export function normalizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}
const compact = (value: string) => normalizeSearch(value).replace(/ /g, "");
function distance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let older = previous;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        row[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        row[j] = Math.min(row[j], older[j - 2] + 1);
    }
    if (Math.min(...row) > limit) return limit + 1;
    older = previous;
    previous = row;
  }
  return previous[b.length];
}
export function searchScore(item: Item, query: string) {
  const term = compact(query.slice(0, 80));
  if (!term) return 0;
  return Math.max(
    0,
    ...[item.Name, item.OriginalTitle]
      .filter((v): v is string => !!v)
      .map((name, alias) => {
        const title = compact(name.slice(0, 160));
        if (title === term) return 100 - alias * 5;
        if (title.includes(term)) return 80 - alias * 5;
        const limit = term.length >= 10 ? 2 : term.length >= 4 ? 1 : 0;
        return limit && distance(title, term, limit) <= limit
          ? 50 - alias * 5
          : 0;
      }),
  );
}
export function rankSearchCandidates(
  items: Item[],
  query: string,
  excluded: Item[] = [],
) {
  const seen = new Set(excluded.map((item) => item.Id));
  return items
    .slice(0, candidateLimit * 2)
    .filter((item) => {
      if (seen.has(item.Id)) return false;
      seen.add(item.Id);
      return true;
    })
    .map((item, index) => ({ item, index, score: searchScore(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
export function searchVariants(query: string) {
  const normalized = normalizeSearch(query),
    joined = compact(query);
  if (!joined) return [];
  const tokens = normalized.split(" ").filter((token) => token.length >= 2);
  const half = Math.ceil(joined.length / 2);
  return [
    ...new Set([
      normalized,
      joined,
      ...(tokens.length > 1
        ? [...tokens].sort((a, b) => b.length - a.length)
        : []),
      ...(joined.length >= 4
        ? [joined.slice(0, half), joined.slice(half)]
        : []),
    ]),
  ]
    .filter((term) => term && term !== query)
    .slice(0, maxSearchRequests - 1);
}
export interface SearchPage extends ItemPage {
  suggestions: Item[];
}
// The primary page retains Emby's totals/order. Supplemental matches have their own
// bounded section: they must never corrupt server offsets or claim full-library recall.
export async function searchMedia(
  api: Pick<EmbyClient, "items">,
  query: Query,
  signal: AbortSignal,
): Promise<SearchPage> {
  const term = String(query.SearchTerm || "")
    .trim()
    .slice(0, 80);
  const primary = await api.items(
    {
      ...query,
      SearchTerm: term,
      Fields: [query.Fields, "OriginalTitle"].filter(Boolean).join(","),
    },
    signal,
  );
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const result = { ...primary, suggestions: [] as Item[] };
  if (
    Number(query.StartIndex || 0) > 0 ||
    primary.Items.length >= Number(query.Limit || 30) ||
    primary.TotalRecordCount > primary.Items.length ||
    primary.Items.some((item) => searchScore(item, term) >= 95)
  )
    return result;
  const variants = searchVariants(term);
  if (!variants.length) return result;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 5000);
  try {
    const candidates = await Promise.all(
      variants.map(async (variant) => {
        try {
          const page = await api.items(
            {
              ...query,
              SearchTerm: variant,
              StartIndex: 0,
              Limit: candidateLimit,
              Fields: "OriginalTitle",
            },
            controller.signal,
          );
          return page.Items.slice(0, candidateLimit);
        } catch {
          // Supplemental failure/timeout cannot discard a successful primary page.
          return [];
        }
      }),
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    result.suggestions = rankSearchCandidates(
      candidates.flat(),
      term,
      primary.Items,
    ).slice(0, Number(query.Limit || 30));
    return result;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
