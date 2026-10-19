export type ProviderCounters = {
  session: number;
  providerSearchRequests: number;
  providerCommentRequests: number;
  providerCacheHits: number;
  providerCacheMisses: number;
  providerFallbackRequests: number;
  providerCancelledRequests: number;
  provider429Responses: number;
  providerCoalescedRequests: number;
};
export type RequestScope = { cacheScope: string; counters: ProviderCounters };
type Counter = Exclude<keyof ProviderCounters, "session">;
const sessions = new Map<string, ProviderCounters>();
let nextSession = 0;
// Private scope/item/session identifiers are memory-only lookup keys. Export
// only a local sequence number and counts, never those identifiers or queries.
export function requestScope(
  cacheScope: string,
  playbackSession: string,
): RequestScope {
  const key = JSON.stringify([cacheScope, playbackSession]);
  let counters = sessions.get(key);
  if (!counters) {
    counters = {
      session: ++nextSession,
      providerSearchRequests: 0,
      providerCommentRequests: 0,
      providerCacheHits: 0,
      providerCacheMisses: 0,
      providerFallbackRequests: 0,
      providerCancelledRequests: 0,
      provider429Responses: 0,
      providerCoalescedRequests: 0,
    };
    sessions.set(key, counters);
    if (sessions.size > 24) sessions.delete(sessions.keys().next().value!);
  }
  return { cacheScope, counters };
}
export function count(
  scope: RequestScope | undefined,
  name: Counter,
  amount = 1,
) {
  if (scope) scope.counters[name] += amount;
}
export function readProviderCounters() {
  return [...sessions.values()].map((c) => ({ ...c }));
}
