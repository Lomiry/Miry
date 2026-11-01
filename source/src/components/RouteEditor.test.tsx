// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutePanel from "./RoutePanel";
import { readRoutes, saveRoute, activeRoutes } from "../stores/routes";
const account = {
  server: "https://home.example.test/emby",
  serverId: "s",
  userId: "u",
  token: "test-only-token",
  name: "demo",
  deviceId: "d",
};
const backup = {
  name: "Backup",
  url: "https://backup.example.test/emby",
  serverId: "s",
  userId: "u",
};
beforeEach(() => {
  localStorage.clear();
  saveRoute(account, backup);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("edits a label, priority and disabled state without rebuilding a connection", async () => {
  const fetch = vi.fn(),
    change = vi.fn(),
    user = userEvent.setup();
  vi.stubGlobal("fetch", fetch);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={change} />);
  await user.click(screen.getByRole("button", { name: "编辑线路 Backup" }));
  const form = screen.getByLabelText("编辑线路").closest("form")!;
  const name = within(form).getByLabelText("线路名称");
  await user.clear(name);
  await user.type(name, "Preferred");
  const priority = within(form).getByLabelText(/优先级/);
  await user.clear(priority);
  await user.type(priority, "1");
  await user.click(within(form).getByRole("checkbox", { name: "启用线路" }));
  await user.click(screen.getByRole("button", { name: "保存修改" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(readRoutes(account).find((r) => r.name === "Preferred")).toMatchObject(
    { enabled: false, priority: 1 },
  );
  expect(activeRoutes(account)).toEqual([]);
});
it("blocks address changes to a different server before sending any token or overwriting configuration", async () => {
  const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ Id: "other", ServerName: "Other", Version: "4.9" }),
        ),
      ),
    change = vi.fn(),
    user = userEvent.setup();
  vi.stubGlobal("fetch", fetch);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={change} />);
  await user.click(screen.getByRole("button", { name: /编辑线路 默认/ }));
  const input = screen.getByLabelText("编辑线路");
  await user.clear(input);
  await user.type(input, "https://other.example.test");
  await user.click(screen.getByRole("button", { name: "保存修改" }));
  await screen.findByRole("alert");
  expect(change).not.toHaveBeenCalled();
  expect(readRoutes(account)).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("X-Emby-Token");
});
it("saves a matching address before using the existing switch path and does not re-probe it", async () => {
  const fetch = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("/Users/")
              ? { Id: "u" }
              : { Id: "s", ServerName: "Home", Version: "4.9" },
          ),
        ),
    ),
    change = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  vi.stubGlobal("fetch", fetch);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={change} />);
  await user.click(screen.getByRole("button", { name: /编辑线路 默认/ }));
  const input = screen.getByLabelText("编辑线路");
  await user.clear(input);
  await user.type(input, "https://new.example.test:8920/prefix");
  await user.click(screen.getByRole("button", { name: "保存修改" }));
  await waitFor(() => expect(change).toHaveBeenCalled());
  expect(change.mock.calls[0][2]).toMatchObject({
    url: "https://new.example.test:8920/prefix",
    serverId: "s",
    userId: "u",
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("shows TLS directly and requires full verification instead of offering pending-route saves", async () => {
  const user = userEvent.setup(),
    fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  await user.type(
    screen.getByLabelText("线路地址"),
    "https://pending.example.test",
  );
  expect(screen.queryByRole("button", { name: "保存为待验证线路" })).toBeNull();
  expect(screen.queryByText("高级连接设置")).toBeNull();
  expect(screen.getByLabelText(/忽略此线路/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "验证并添加" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  expect(
    readRoutes(account).find((r) => r.status === "pending"),
  ).toBeUndefined();
  expect(activeRoutes(account)).toHaveLength(2);
});
it("saves a server remark without invoking routing or authentication", async () => {
  const user = userEvent.setup(),
    change = vi.fn(),
    update = vi.fn(),
    fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <RoutePanel
      account={account}
      onClose={vi.fn()}
      onSwitch={change}
      onUpdate={update}
    />,
  );
  await user.type(screen.getByLabelText("服务器备注"), "My library");
  await user.click(screen.getByRole("button", { name: "保存修改" }));
  expect(update).toHaveBeenCalledWith({ ...account, remark: "My library" });
  expect(fetch).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
it("verifies a single pending backup before allowing it into the route group", async () => {
  localStorage.clear();
  saveRoute(account, {
    name: "Pending",
    url: "https://pending.example.test/emby",
    serverId: "",
    status: "pending",
  });
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("/Users/")
            ? { Id: "u" }
            : { Id: "s", ServerName: "Demo", Version: "4.9" },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  expect(activeRoutes(account)).toEqual([]);
  await user.click(screen.getByRole("button", { name: "检测 Pending" }));
  await waitFor(() => expect(activeRoutes(account)).toHaveLength(2));
  expect(readRoutes(account).find((r) => r.name === "Pending")).toMatchObject({
    serverId: "s",
    userId: "u",
    status: "verified",
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
