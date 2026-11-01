// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionDiagnostics from "./ConnectionDiagnostics";
import { EmbyClient } from "../api/client";
import {
  clearNetworkDiagnostics,
  readNetworkDiagnostics,
} from "../api/diagnostics";
import { invoke } from "@tauri-apps/api/core";
const native = vi.hoisted(() => ({ enabled: false }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => native.enabled,
  invoke: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearNetworkDiagnostics();
  native.enabled = false;
  vi.clearAllMocks();
});
it("exports connection failures with the status but without private response values", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Message: "secret-token https://media.example.com/private",
          AccessToken: "secret-token",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  const api = new EmbyClient({
    server: "https://media.example.com:8443/emby",
    userId: "user",
    token: "secret-token",
    name: "Test",
    deviceId: "device",
  });
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<ConnectionDiagnostics account={api.account} />);
  if (!document.querySelector("details[open]"))
    await user.click(screen.getByText("连接诊断", { selector: "summary" }));
  await user.click(screen.getByRole("button", { name: "检查连接" }));
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    expect.stringContaining("服务器拒绝访问"),
  );
  await user.click(screen.getByRole("button", { name: "复制连接诊断" }));
  const diagnostics = write.mock.calls[0][0];
  expect(diagnostics).toContain('"status": 403');
  expect(diagnostics).toContain('"stage": "probe"');
  expect(diagnostics).not.toContain("media.example.com");
  expect(diagnostics).not.toContain("secret-token");
});
it("checks current server information without displaying tokens", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        '{"ServerName":"https://host.test/emby","Version":"4.9","Id":"server"}',
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const api = new EmbyClient({
    server: "https://host.test/emby",
    userId: "user",
    token: "secret-token",
    name: "Test",
    deviceId: "device",
  });
  render(<ConnectionDiagnostics account={api.account} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("连接诊断", { selector: "summary" }));
  if (!document.querySelector("details[open]"))
    await user.click(screen.getByText("连接诊断", { selector: "summary" }));
  await user.click(screen.getByRole("button", { name: "检查连接" }));
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    expect.stringContaining("连接正常 · Emby 4.9"),
  );
  expect(document.body.textContent).not.toContain("secret-token");
  expect(screen.getByText(api.account.server)).toBeTruthy();
  expect(fetch.mock.calls[0][0]).toContain("/System/Info/Public");
});
it("retains native diagnostics and ignores reports arriving after close", async () => {
  native.enabled = true;
  let complete!: (value: unknown) => void;
  vi.mocked(invoke).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const account = {
    server: "https://native.example.test/emby",
    userId: "u",
    token: "fixture",
    name: "QA",
    deviceId: "d",
  };
  const view = render(<ConnectionDiagnostics account={account} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("连接诊断", { selector: "summary" }));
  await user.click(screen.getByRole("button", { name: "获取底层诊断" }));
  expect(invoke).toHaveBeenCalledWith("diagnose_server", {
    server: account.server,
  });
  view.unmount();
  await act(async () =>
    complete({
      stage: "probe",
      backend: "native",
      url: account.server,
      status: 200,
      redirectStatuses: [],
      elapsedMs: 25,
      category: "ok",
      errors: [],
      validServerInfo: true,
      bodyPreview: "",
    }),
  );
  expect(readNetworkDiagnostics()).toEqual([]);
});
