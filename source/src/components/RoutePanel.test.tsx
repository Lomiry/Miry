// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutePanel from "./RoutePanel";
import { readRoutes, saveRoute } from "../stores/routes";
import { setLanguage, t } from "../i18n/core";
const account = {
  server: "https://private.test/emby",
  userId: "u",
  token: "secret",
  name: "用户",
  deviceId: "d",
  serverId: "server",
};
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLanguage("zh-CN", false);
});

it("keeps an unsaved route and input focus when switching between Chinese and English", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  const input = screen.getByLabelText("线路地址");
  await userEvent.setup().type(input, "https://draft.example.test");
  act(() => setLanguage("en-US", false));
  expect(
    screen.getByRole("dialog", { name: "Server and routes" }),
  ).toBeTruthy();
  expect(screen.getByLabelText(t("network.route_address"))).toBe(input);
  expect(input).toHaveProperty("value", "https://draft.example.test");
  expect(document.activeElement).toBe(input);
  expect(fetch).not.toHaveBeenCalled();
});

it("shows one editor and one submit action, and cancels editing without changing the route", async () => {
  const backup = {
    name: "Backup",
    url: "https://backup.example.test/emby",
    serverId: "server",
    userId: "u",
  };
  saveRoute(account, backup);
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "编辑线路 Backup" }));
  expect(screen.queryByLabelText("线路地址")).toBeNull();
  expect(screen.getAllByRole("button", { name: "保存修改" })).toHaveLength(1);
  await user.clear(screen.getByLabelText("线路名称"));
  await user.type(screen.getByLabelText("线路名称"), "Unsaved");
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByLabelText("线路地址")).toBeTruthy();
  expect(readRoutes(account).find((r) => r.url === backup.url)?.name).toBe(
    "Backup",
  );
});

it("shows stored addresses and preserves address-bearing route aliases", () => {
  saveRoute(account, {
    name: "backup.private.test",
    url: "https://backup.private.test/emby",
    serverId: "server",
    userId: account.userId,
  });
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  expect(screen.getByText("backup.private.test")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "检测 backup.private.test" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("线路地址")).toHaveProperty("type", "url");
  expect(screen.getAllByText(account.server)[0]).toBeTruthy();
  expect(screen.getByText("https://backup.private.test/emby")).toBeTruthy();
});
it("has no assessment or auto-mode UI for a single endpoint", () => {
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  expect(screen.queryByLabelText("线路选择")).toBeNull();
  expect(screen.queryByRole("button", { name: /检测|评估|吞吐/ })).toBeNull();
  expect(screen.getByRole("button", { name: "验证并添加" })).toBeTruthy();
});

it("adds a verified route without using the returned server name as a visible alias", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/Users/u")
              ? { Id: "u" }
              : {
                  Id: "server",
                  ServerName: "backup.private.test",
                  Version: "4.9",
                },
          ),
        ),
    ),
  );
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("线路地址"),
    "https://backup.private.test",
  );
  await user.click(screen.getByRole("button", { name: "验证并添加" }));
  expect(await screen.findByText("线路 2")).toBeTruthy();
  expect(screen.getByText("https://backup.private.test")).toBeTruthy();
  expect(readRoutes(account)[1]).toMatchObject({
    name: "线路 2",
    url: "https://backup.private.test",
  });
});
