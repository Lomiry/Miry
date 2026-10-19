// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel from "./SettingsPanel";
import { defaults } from "../stores/settings";
import { EmbyClient } from "../api/client";
import { clearNetworkDiagnostics } from "../api/diagnostics";
import { pickSelect } from "../testSelect";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearNetworkDiagnostics();
});
it("keeps multi-route management visible but disabled without a server", async () => {
  const endpoints = vi.fn();
  render(
    <SettingsPanel
      api={null}
      settings={defaults}
      onChange={vi.fn()}
      onClose={vi.fn()}
      onEndpoints={endpoints}
      initialSection="connection"
    />,
  );
  const button = screen.getByRole("button", { name: "多线路管理" });
  expect(button).toHaveProperty("disabled", true);
  await userEvent.setup().click(button);
  expect(endpoints).not.toHaveBeenCalled();
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
  render(
    <SettingsPanel
      api={api}
      settings={defaults}
      onChange={vi.fn()}
      onClose={vi.fn()}
      initialSection="connection"
    />,
  );
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
it("checks the authenticated server connection without displaying tokens", async () => {
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
  const close = vi.fn();
  render(
    <SettingsPanel
      api={api}
      settings={defaults}
      onChange={vi.fn()}
      onClose={close}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "网络 / 线路" }));
  await user.click(screen.getByRole("button", { name: "检查连接" }));
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    expect.stringContaining("连接正常 · Emby 4.9"),
  );
  expect(document.body.textContent).not.toContain("secret-token");
  expect(screen.getByText(api.account.server)).toBeTruthy();
  expect(fetch.mock.calls[0][0]).toContain("/System/Info/Public");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it("keeps keyboard focus inside the settings dialog", async () => {
  render(
    <SettingsPanel
      api={null}
      settings={defaults}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const first = screen.getByRole("button", { name: "关闭设置" });
  expect(document.activeElement).toBe(first);
  await userEvent.setup().keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "清空内存缓存" }),
  );
});
it("uses direct playback wording and exposes independent appearance controls", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <SettingsPanel
      api={null}
      settings={defaults}
      onChange={change}
      onClose={vi.fn()}
    />,
  );
  await pickSelect(user, screen.getByLabelText("播放兼容模式"), {
    name: "仅直接播放",
  });
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({ compatibility: "direct-only" }),
  );
  expect(document.body.textContent).not.toContain("直播放");
  await user.click(screen.getByRole("tab", { name: "外观" }));
  expect(screen.getByLabelText("界面字号")).toBeTruthy();
});
