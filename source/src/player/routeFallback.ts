import type { Account } from "../types/emby";
import { ApiError } from "../api/client";
import {
  activeRoutes,
  verifyRoute,
  captureRoute,
  currentRoute,
  updateRouteFailure,
  type ServerRoute,
} from "../stores/routes";
import { readRouteQuality, autoRouteVersion } from "./smartRoutes";
import { privateError } from "../privacy";

export function canFallback(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status >= 500 ||
      ["network", "timeout", "tls", "dns", "tcp"].includes(
        error.category || "",
      ))
  );
}
const attempts = new Map<string, number>();
/** One bounded pass on connection failure. No polling, no replay of API writes. */
export async function findFallback(
  account: Account,
  signal: AbortSignal,
  isCurrent: () => boolean = () => true,
): Promise<
  | { route: ServerRoute; checked: Awaited<ReturnType<typeof verifyRoute>> }
  | undefined
> {
  const key = `${account.serverId}|${account.userId}|${account.server}`;
  if (
    signal.aborted ||
    !isCurrent() ||
    readRouteQuality(account).mode !== "auto" ||
    Date.now() - (attempts.get(key) ?? 0) < 60000
  )
    return;
  attempts.set(key, Date.now());
  const version = autoRouteVersion(account);
  const valid = () =>
    !signal.aborted &&
    isCurrent() &&
    readRouteQuality(account).mode === "auto" &&
    autoRouteVersion(account) === version;
  if (attempts.size > 100) attempts.delete(attempts.keys().next().value!);
  for (const route of activeRoutes(account)
    .filter((r) => r.url !== account.server)
    .slice(0, 3)) {
    if (!valid()) return;
    const lease = captureRoute(account, route);
    const controller = new AbortController(),
      abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 4000);
    try {
      const checked = await verifyRoute(account, route.url, controller.signal);
      const latest = currentRoute(account, lease);
      if (valid() && latest) return { route: latest, checked };
    } catch (error) {
      if (valid()) updateRouteFailure(account, lease, privateError(error));
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }
}
