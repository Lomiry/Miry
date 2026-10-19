import type { Account } from "../types/emby";
import {
  saveConnectionRemark,
  withConnectionRemark,
} from "./connectionRemarks";
import {
  rememberConnection,
  readConnections,
  connectionId,
} from "./connections";
const key = "miry-account";
export function readAccount(): Account | null {
  try {
    const value = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!value) return null;
    const a = JSON.parse(value);
    return ["server", "userId", "name", "token", "deviceId"].every(
      (k) => typeof a[k] === "string",
    )
      ? withConnectionRemark(a)
      : null;
  } catch {
    return null;
  }
}
export function saveAccount(account: Account, remember: boolean) {
  saveConnectionRemark(account);
  account = withConnectionRemark(account);
  for (const previous of readConnections())
    if (connectionId(previous.account) !== connectionId(account))
      rememberConnection(previous.account, previous.remember);
  clearAccount();
  rememberConnection(account, remember);
  (remember ? localStorage : sessionStorage).setItem(
    key,
    JSON.stringify(account),
  );
}
export function clearAccount() {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
