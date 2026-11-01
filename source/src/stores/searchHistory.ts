import type { Account } from "../types/emby";
import { connectionId } from "./connectionRemarks";
import { normalizeSearch } from "../api/search";

const key = "miry-search-history";
export const searchScope = (account: Account | null) =>
  account ? connectionId(account) : "demo";
export function searchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}
export function historyTermAllowed(value: string, sensitive: string[] = []) {
  const term = searchTerm(value);
  return (
    /[\p{L}\p{N}]/u.test(term) &&
    !/https?:\/\/|\b(?:bearer|authorization|cookie)\b|(?:token|api[_-]?key|password|passwd|username|用户名|密码|令牌)\s*[:=：]|[\w.+-]+@[\w.-]+\.[a-z]{2,}|^[a-f\d]{24,}$|^[\w+/=-]{32,}$/i.test(
      term,
    ) &&
    !sensitive.some(
      (secret) =>
        secret &&
        (term.toLowerCase() === secret.toLowerCase() ||
          (secret.length >= 8 &&
            value.toLowerCase().includes(secret.toLowerCase()))),
    )
  );
}
function entries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((term): term is string => {
      if (typeof term !== "string" || !historyTermAllowed(term)) return false;
      const normalized = normalizeSearch(term);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 20)
    .map(searchTerm);
}
function read(): Record<string, string[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    if (!raw || Array.isArray(raw) || typeof raw !== "object") return {};
    return Object.fromEntries(
      Object.entries(raw)
        .slice(-100)
        .map(([scope, value]) => [scope, entries(value)]),
    );
  } catch {
    return {};
  }
}
export function readSearchHistory(scope: string) {
  return read()[scope] || [];
}
export function saveSearchHistory(scope: string, history: string[]) {
  const next = entries(history);
  try {
    const all = read();
    delete all[scope];
    localStorage.setItem(
      key,
      JSON.stringify(
        Object.fromEntries([...Object.entries(all), [scope, next]].slice(-100)),
      ),
    );
  } catch {
    // Searching remains available when local storage is full or disabled.
  }
  return next;
}
export function recordSearch(
  scope: string,
  term: string,
  sensitive: string[] = [],
) {
  const query = searchTerm(term);
  if (!historyTermAllowed(term, sensitive))
    return saveSearchHistory(
      scope,
      readSearchHistory(scope).filter((entry) =>
        historyTermAllowed(entry, sensitive),
      ),
    );
  return saveSearchHistory(scope, [
    query,
    ...readSearchHistory(scope)
      .filter((entry) => historyTermAllowed(entry, sensitive))
      .filter((entry) => normalizeSearch(entry) !== normalizeSearch(query)),
  ]);
}
export function searchSuggestions(history: string[], query: string) {
  const normalized = searchTerm(query).toLocaleLowerCase();
  return history
    .filter((term) => term.toLocaleLowerCase().includes(normalized))
    .slice(0, 6);
}
