// @vitest-environment jsdom
import { expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import DesktopSettings from "./DesktopSettings";
import { defaults } from "../stores/settings";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});
const about = () =>
  render(<DesktopSettings settings={defaults} onChange={vi.fn()} api={null} />);
it("shows stable branding and actions without an editable release URL or startup request", () => {
  const view = about();
  expect(screen.getByRole("heading", { name: "Miry v1.0.6" })).toBeTruthy();
  expect(screen.queryByLabelText("发布信息地址")).toBeNull();
  expect(view.container.querySelector('input[type="url"]')).toBeNull();
  expect(screen.getByRole("button", { name: "检查新版本" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "导出匿名诊断" })).toBeTruthy();
  expect(invoke).not.toHaveBeenCalled();
});
it("checks the built-in source on demand and opens a newer release without installing", async () => {
  vi.mocked(invoke).mockResolvedValue({
    version: "1.1.0",
    newer: true,
    notes: "Release notes",
    url: "https://github.com/Lomiry/Miry/releases/tag/v1.1.0",
  });
  about();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "检查新版本" }));
  expect(await screen.findByText("Release notes")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("发现新版本 v1.1.0");
  expect(invoke).toHaveBeenCalledExactlyOnceWith("check_release");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "查看发布页面" }));
  expect(invoke).toHaveBeenLastCalledWith("open_release", {
    url: "https://github.com/Lomiry/Miry/releases/tag/v1.1.0",
  });
});
it.each(["1.0.1", "0.9.9"])(
  "treats release %s as current without offering an older installer",
  async (version) => {
    vi.mocked(invoke).mockResolvedValue({ version, newer: false });
    about();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "检查新版本" }));
    expect(screen.getByRole("status").textContent).toBe("当前已是最新版本");
    expect(screen.queryByRole("button", { name: "查看发布页面" })).toBeNull();
  },
);
it("keeps failures nonblocking and clears a stale newer release", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ version: "1.0.3", newer: true, notes: "Notes" })
    .mockRejectedValueOnce("GitHub 访问受限");
  about();
  const button = screen.getByRole("button", { name: "检查新版本" });
  await userEvent.setup().click(button);
  await userEvent.setup().click(button);
  expect(screen.getByRole("status").textContent).toContain("暂时无法检查更新");
  expect(screen.queryByRole("button", { name: "查看发布页面" })).toBeNull();
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(button.hasAttribute("disabled")).toBe(false);
});
