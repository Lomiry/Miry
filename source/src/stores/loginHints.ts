import { normalizeServer } from "../api/client";
const key = "miry-login-hints";
type Hint = { server: string; username: string };
function hints(): Hint[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (h) =>
              h &&
              typeof h.server === "string" &&
              typeof h.username === "string",
          )
          .slice(0, 10)
          .map((h) => ({ server: h.server, username: h.username }))
      : [];
  } catch {
    return [];
  }
}
export function readLoginHint(server: string): string {
  try {
    return (
      hints().find((h) => h.server === normalizeServer(server))?.username || ""
    );
  } catch {
    return "";
  }
}
export function saveLoginHint(server: string, username: string) {
  const name = username.trim();
  if (!name || name.length > 256) return;
  try {
    const canonical = normalizeServer(server);
    localStorage.setItem(
      key,
      JSON.stringify(
        [
          { server: canonical, username: name },
          ...hints().filter((h) => h.server !== canonical),
        ].slice(0, 10),
      ),
    );
  } catch {
    /* Login can succeed even when local storage is full. */
  }
}
