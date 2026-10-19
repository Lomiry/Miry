// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { saveAccount, clearAccount, readAccount } from "./account";
import { withConnectionRemark } from "./connectionRemarks";
import { readConnections } from "./connections";
const account = {
  server: "https://first.test/emby",
  userId: "u",
  token: "session-secret",
  name: "用户",
  deviceId: "d",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it("keeps a local remark after a session-only login ends without persisting the token", () => {
  saveAccount({ ...account, remark: " 家庭影院 " }, false);
  expect(readAccount()?.remark).toBe("家庭影院");
  clearAccount();
  sessionStorage.clear();
  expect(withConnectionRemark(account).remark).toBe("家庭影院");
  expect(localStorage.getItem("miry-connection-remarks")).not.toContain(
    account.token,
  );
  expect(localStorage.getItem("miry-account")).toBeNull();
  saveAccount(account, false);
  expect(readConnections()[0].account.remark).toBe("家庭影院");
});

it("scopes remarks by server and account while preserving them across alternate routes", () => {
  saveAccount({ ...account, remark: "主账号" }, false);
  const other = { ...account, userId: "other", remark: "另一个账号" };
  saveAccount(other, true);
  saveAccount(
    {
      ...account,
      server: "https://backup.test/emby",
      homeServer: account.server,
    },
    false,
  );
  expect(readAccount()?.remark).toBe("主账号");
  expect(withConnectionRemark(other).remark).toBe("另一个账号");
  expect(
    withConnectionRemark({ ...account, server: "https://second.test/emby" })
      .remark,
  ).toBeUndefined();
});

it("clears a remark without reviving an old cached alias", () => {
  saveAccount({ ...account, remark: "旧备注" }, true);
  saveAccount({ ...account, remark: "" }, true);
  expect(readAccount()?.remark).toBe("");
  expect(withConnectionRemark({ ...account, remark: "旧备注" }).remark).toBe(
    "",
  );
});
