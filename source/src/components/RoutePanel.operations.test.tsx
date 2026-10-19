// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import RoutePanel from "./RoutePanel";
import { readRoutes, saveRoute } from "../stores/routes";
import { readRouteQuality } from "../player/smartRoutes";
import { pickSelect } from "../testSelect";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
const account = {
  server: "https://stage-g.test/emby",
  serverId: "stage-g",
  userId: "u",
  token: "mock-token",
  name: "QA",
  deviceId: "d",
};
const backup = {
  name: "备用",
  url: "https://backup.stage-g.test/emby",
  serverId: account.serverId,
  userId: account.userId,
};
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  saveRoute(account, backup);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/Users/u")
              ? { Id: "u" }
              : {
                  Id: account.serverId,
                  ServerName: "Stage G Mock",
                  Version: "4.9",
                },
          ),
        ),
    ),
  );
  vi.mocked(invoke).mockResolvedValue({
    identityValid: true,
    apiTtfbMs: 90,
    failureRate: 0,
    samples: 1,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("persists auto/manual selection and evaluates API without a media probe", async () => {
  const user = userEvent.setup();
  render(<RoutePanel account={account} onClose={vi.fn()} onSwitch={vi.fn()} />);
  await pickSelect(user, screen.getByLabelText("线路选择"), {
    name: "自动选择（空闲时）",
  });
  expect(readRouteQuality(account).mode).toBe("auto");
  await user.click(screen.getByRole("button", { name: "评估 备用" }));
  await waitFor(() =>
    expect(readRouteQuality(account).recommended).toBe(backup.url),
  );
  expect(invoke).toHaveBeenCalledWith(
    "route_probe",
    expect.objectContaining({
      server: backup.url,
      expected: account.serverId,
      media: null,
    }),
  );
  expect(screen.getByText(/推荐.*90 ms/)).toBeTruthy();
  await pickSelect(user, screen.getByLabelText("线路选择"), {
    name: "手动固定",
  });
  expect(readRouteQuality(account)).toMatchObject({
    mode: "manual",
    pinned: account.server,
  });
});

it("uses the selected route and protects current/default routes while deleting a backup", async () => {
  const user = userEvent.setup(),
    switchRoute = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <RoutePanel account={account} onClose={vi.fn()} onSwitch={switchRoute} />,
  );
  const currentRow = screen.getByText("默认线路 · 当前").closest("article")!;
  expect(
    within(currentRow).getByRole("button", { name: "使用" }),
  ).toHaveProperty("disabled", true);
  expect(within(currentRow).queryByRole("button", { name: /删除/ })).toBeNull();
  const backupRow = screen.getByText("备用").closest("article")!;
  await user.click(within(backupRow).getByRole("button", { name: "使用" }));
  expect(switchRoute).toHaveBeenCalledWith(backup, expect.any(AbortSignal));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "删除 备用" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  await user.click(screen.getByRole("button", { name: "删除 备用" }));
  expect(readRoutes(account)).toHaveLength(1);
  view.unmount();
  render(
    <RoutePanel account={account} onClose={vi.fn()} onSwitch={switchRoute} />,
  );
  expect(screen.queryByText("备用")).toBeNull();
  expect(screen.queryByLabelText("线路选择")).toBeNull();
});

it("isolates server lists and modes when the account changes", async () => {
  const other = {
    ...account,
    server: "https://other.stage-g.test/emby",
    serverId: "other",
  };
  saveRoute(other, {
    ...backup,
    name: "其他备用",
    url: "https://backup.other.test/emby",
    serverId: "other",
  });
  const user = userEvent.setup(),
    switchRoute = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <RoutePanel account={account} onClose={vi.fn()} onSwitch={switchRoute} />,
  );
  await pickSelect(user, screen.getByLabelText("线路选择"), {
    name: "自动选择（空闲时）",
  });
  view.rerender(
    <RoutePanel account={other} onClose={vi.fn()} onSwitch={switchRoute} />,
  );
  expect(screen.queryByText(backup.url)).toBeNull();
  const otherRow = screen.getByText("其他备用").closest("article")!;
  await user.click(within(otherRow).getByRole("button", { name: "使用" }));
  expect(switchRoute).toHaveBeenCalledWith(
    expect.objectContaining({ serverId: "other" }),
    expect.any(AbortSignal),
  );
  expect(readRouteQuality(other).mode).toBe("manual");
  expect(readRouteQuality(account).mode).toBe("auto");
  expect(readRoutes(account)).toHaveLength(2);
});

it("traps keyboard focus and aborts an outstanding verification on close", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    }),
  );
  const user = userEvent.setup(),
    close = vi.fn();
  const view = render(
    <RoutePanel account={account} onClose={close} onSwitch={vi.fn()} />,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "关闭线路设置" }),
  );
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "验证并添加" }),
  );
  await user.click(screen.getByRole("button", { name: "检测 备用" }));
  expect(screen.getByRole("button", { name: "删除 备用" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  view.unmount();
  expect(signal?.aborted).toBe(true);
  expect(readRoutes(account)).toHaveLength(2);
});
