// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutePanel from "./RoutePanel";
import { readRoutes, saveRoute } from "../stores/routes";
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
  expect(screen.getByText(account.server)).toBeTruthy();
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
  expect(screen.getByText("https://backup.private.test/emby")).toBeTruthy();
  expect(readRoutes(account)[1]).toMatchObject({
    name: "线路 2",
    url: "https://backup.private.test/emby",
  });
});
