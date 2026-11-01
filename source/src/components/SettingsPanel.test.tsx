// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel from "./SettingsPanel";
import { defaults } from "../stores/settings";
import { clearNetworkDiagnostics } from "../api/diagnostics";
import { pickSelect } from "../testSelect";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearNetworkDiagnostics();
});
it("retains settings categories without the duplicate network route page", () => {
  render(
    <SettingsPanel
      api={null}
      settings={defaults}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.queryByRole("tab", { name: "网络 / 线路" })).toBeNull();
  expect(screen.queryByRole("button", { name: "多线路管理" })).toBeNull();
  expect(screen.getAllByRole("tab")).toHaveLength(9);
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
  expect(change).toHaveBeenCalledWith(expect.any(Function));
  expect(change.mock.calls.at(-1)![0](defaults)).toEqual(
    expect.objectContaining({ compatibility: "direct-only" }),
  );
  expect(document.body.textContent).not.toContain("直播放");
  await user.click(screen.getByRole("tab", { name: "外观" }));
  expect(screen.getByLabelText("界面字号")).toBeTruthy();
});
