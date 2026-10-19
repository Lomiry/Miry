import type { Account } from "../types/emby";
import { connectionId, withConnectionRemark } from "./connectionRemarks";
export { connectionId } from "./connectionRemarks";
export interface Connection {
  account: Account;
  remember: boolean;
}
const key = "miry-connections";
export function connectionLabel(account: Account) {
  return account.remark?.trim() || new URL(account.server).host;
}
function entries(storage: Storage, remember: boolean): Connection[] {
  try {
    const list = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(list)
      ? list
          .filter(
            (a) =>
              a &&
              ["server", "userId", "token", "name", "deviceId"].every(
                (k) => typeof a[k] === "string",
              ) &&
              /^https?:\/\//.test(a.server),
          )
          .map((account) => ({
            account: withConnectionRemark(account),
            remember,
          }))
      : [];
  } catch {
    return [];
  }
}
export function readConnections(): Connection[] {
  const all = [
    ...entries(localStorage, true),
    ...entries(sessionStorage, false),
  ];
  // Migrate a login made by earlier versions without changing its storage policy.
  for (const [storage, remember] of [
    [localStorage, true],
    [sessionStorage, false],
  ] as const) {
    try {
      const a = JSON.parse(storage.getItem("miry-account") || "null");
      if (
        a &&
        ["server", "userId", "token", "name", "deviceId"].every(
          (k) => typeof a[k] === "string",
        )
      )
        all.push({ account: withConnectionRemark(a), remember });
    } catch {
      /* Ignore invalid saved logins. */
    }
  }
  return [...new Map(all.map((c) => [connectionId(c.account), c])).values()];
}
export function rememberConnection(account: Account, remember: boolean) {
  removeConnection(account);
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(
    key,
    JSON.stringify([
      ...entries(storage, remember).map((c) => c.account),
      account,
    ]),
  );
}
export function removeConnection(account: Account) {
  for (const storage of [localStorage, sessionStorage])
    storage.setItem(
      key,
      JSON.stringify(
        entries(storage, false)
          .filter((c) => connectionId(c.account) !== connectionId(account))
          .map((c) => c.account),
      ),
    );
}
