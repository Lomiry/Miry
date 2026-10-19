import type { Account } from "../types/emby";

const key = "miry-connection-remarks";
export const connectionId = (a: Account) =>
  `${a.homeServer || a.server}|${a.userId}`;
const clean = (value: string) => value.trim().slice(0, 60);

interface Remark {
  name: string;
  remark: string;
}
function readRemarks(): Record<string, Remark> {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data as Record<string, Remark>)
        .filter(
          ([, entry]) =>
            typeof entry?.remark === "string" &&
            typeof entry?.name === "string",
        )
        .slice(-100)
        .map(([id, note]) => [
          id,
          { name: note.name, remark: clean(note.remark) },
        ]),
    );
  } catch {
    return {};
  }
}

export function withConnectionRemark(account: Account): Account {
  return {
    ...account,
    remark:
      readRemarks()[connectionId(account)]?.remark ??
      (typeof account.remark === "string" ? clean(account.remark) : undefined),
  };
}

export function saveConnectionRemark(account: Account) {
  if (typeof account.remark !== "string") return;
  const notes = readRemarks();
  delete notes[connectionId(account)];
  // Empty notes deliberately override any older remark inside saved accounts.
  notes[connectionId(account)] = {
    name: account.name,
    remark: clean(account.remark),
  };
  localStorage.setItem(
    key,
    JSON.stringify(Object.fromEntries(Object.entries(notes).slice(-100))),
  );
}

export function connectionRemarkHint(server: string, username: string) {
  return (
    Object.entries(readRemarks()).find(
      ([id, note]) =>
        id.startsWith(`${server}|`) &&
        note.name.toLocaleLowerCase() === username.trim().toLocaleLowerCase(),
    )?.[1].remark || ""
  );
}
