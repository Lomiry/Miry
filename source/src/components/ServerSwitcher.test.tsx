// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServerSwitcher from "./ServerSwitcher";
import Sidebar from "./Sidebar";

const account = {
  server: "https://one.example.test/emby",
  serverId: "s",
  userId: "u",
  token: "fixture",
  name: "User",
  deviceId: "d",
  remark: "1111",
};
const second = {
  ...account,
  server: "https://two.example.test/emby",
  serverId: "other",
  remark: "Second",
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function setup() {
  const actions = {
    onSwitch: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onLogout: vi.fn(),
  };
  render(
    <Sidebar
      header={
        <ServerSwitcher
          {...actions}
          account={account}
          connections={[
            { account, remember: true },
            { account: second, remember: true },
          ]}
          busy={false}
          demo={false}
        />
      }
    >
      <nav>Fixture navigation</nav>
    </Sidebar>,
  );
  return actions;
}
it("switches servers from the current server menu without a duplicate account footer", async () => {
  const actions = setup(),
    user = userEvent.setup();
  expect(document.querySelector(".account")).toBeNull();
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Second" }));
  expect(actions.onSwitch).toHaveBeenCalledWith({
    account: second,
    remember: true,
  });
});
it("keeps add and management actions reachable when the sidebar is collapsed", async () => {
  const actions = setup(),
    user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "收起侧边栏" }));
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitem", { name: "编辑服务器与线路" }));
  expect(actions.onEdit).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitem", { name: "添加服务器" }));
  expect(actions.onAdd).toHaveBeenCalledOnce();
});
it("only logs out after confirmation and restores menu focus", async () => {
  const actions = setup(),
    user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitem", { name: "退出登录" }));
  expect(actions.onLogout).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "当前服务器" }),
  );
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "当前服务器" }));
  await user.click(screen.getByRole("menuitem", { name: "退出登录" }));
  expect(actions.onLogout).toHaveBeenCalledOnce();
});
