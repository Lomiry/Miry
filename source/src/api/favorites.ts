import type { Account } from "../types/emby";

export const favoritesChanged = "miry-favorites-changed";
export const favoriteScope = (account: Account) =>
  JSON.stringify([
    account.serverId || account.homeServer || account.server,
    account.userId,
  ]);
// Bounded invalidation stamps only; server Items remains the source of favorites.
const revisions = new Map<string, object>();
export function favoriteRevision(account: Account) {
  const scope = favoriteScope(account);
  let revision = revisions.get(scope);
  if (!revision) {
    revision = {};
    revisions.set(scope, revision);
    if (revisions.size > 128) revisions.delete(revisions.keys().next().value!);
  }
  return revision;
}
export function invalidateFavorites(account: Account) {
  const scope = favoriteScope(account);
  revisions.delete(scope);
  favoriteRevision(account);
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(favoritesChanged, { detail: scope }));
}
