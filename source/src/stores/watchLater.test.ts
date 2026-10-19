// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { readLater, toggleLater, clearLater } from "./watchLater";
const account = {
  server: "https://a.test/emby",
  userId: "u",
  name: "A",
  token: "secret",
  deviceId: "d",
};
beforeEach(() => localStorage.clear());
it("isolates accounts and routes, toggles metadata only and can clear", () => {
  toggleLater(account, {
    Id: "m",
    Name: "Movie",
    Type: "Movie",
    MediaSources: [{ Id: "secret-url" }],
    Overview: "private",
  });
  expect(readLater({ ...account, userId: "other" })).toHaveLength(0);
  const backup = {
    ...account,
    homeServer: account.server,
    server: "https://backup.test/emby",
  };
  expect(readLater(backup)).toHaveLength(1);
  expect(JSON.stringify(readLater(account))).not.toContain("secret");
  toggleLater(backup, { Id: "m", Name: "Movie", Type: "Movie" });
  expect(readLater(account)).toHaveLength(0);
  toggleLater(account, { Id: "n", Name: "Movie", Type: "Movie" });
  clearLater(account);
  expect(readLater(account)).toHaveLength(0);
});
it("bounds the list to 200 items and ignores corrupt data", () => {
  for (let i = 0; i < 205; i++)
    toggleLater(account, { Id: String(i), Name: "Movie", Type: "Movie" });
  expect(readLater(account)).toHaveLength(200);
  localStorage.setItem("miry-later:https://a.test/emby|u", "broken");
  expect(readLater(account)).toHaveLength(0);
});
