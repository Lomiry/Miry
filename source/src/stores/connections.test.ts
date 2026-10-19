// @vitest-environment jsdom
import { beforeEach, it, expect } from "vitest";
import { saveAccount, clearAccount } from "./account";
import {
  readConnections,
  removeConnection,
  connectionLabel,
} from "./connections";
const first = {
  server: "https://first.test/emby",
  userId: "same-user",
  token: "session-only-token",
  name: "A",
  deviceId: "d",
};
const second = {
  ...first,
  server: "https://second.test/emby",
  token: "remembered-token",
  name: "B",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
it("shows remark only, otherwise endpoint, and preserves duplicate/long labels without conflating identities", () => {
  expect(connectionLabel({ ...first, remark: "  okemby00  " })).toBe(
    "okemby00",
  );
  expect(connectionLabel(first)).toBe("first.test");
  expect(connectionLabel({ ...second, remark: "okemby00" })).toBe("okemby00");
  expect(connectionLabel({ ...first, remark: "长".repeat(60) })).toHaveLength(
    60,
  );
});
it("keeps each connection's remember policy when switching servers", () => {
  saveAccount(first, false);
  saveAccount(second, true);
  saveAccount(first, false);
  expect(readConnections()).toHaveLength(2);
  expect(localStorage.getItem("miry-connections")).not.toContain(first.token);
  expect(localStorage.getItem("miry-connections")).toContain(second.token);
  expect(sessionStorage.getItem("miry-connections")).toContain(first.token);
});
it("preserves an old-version session login when adding another server", () => {
  sessionStorage.setItem("miry-account", JSON.stringify(first));
  saveAccount(second, true);
  expect(readConnections()).toHaveLength(2);
  expect(sessionStorage.getItem("miry-connections")).toContain(first.token);
});
it("removes only the logged-out connection", () => {
  saveAccount(first, false);
  saveAccount(second, true);
  clearAccount();
  removeConnection(second);
  expect(readConnections().map((c) => c.account.server)).toEqual([
    first.server,
  ]);
});
