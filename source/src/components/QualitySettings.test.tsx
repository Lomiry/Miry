import { pickSelect } from "../testSelect";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaults } from "../stores/settings";
import QualitySettings from "./QualitySettings";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
afterEach(cleanup);
it("contains two real video rows with no terminal divider or removed policy", () => {
  const { container } = render(
    <QualitySettings section="video" settings={defaults} onChange={() => {}} />,
  );
  expect(screen.queryByLabelText("自动匹配刷新率")).toBeNull();
  const rows = container.querySelectorAll<HTMLElement>(".setting-row");
  expect(rows.length).toBe(2);
  expect(rows[0].textContent).toContain("HDR 处理");
  expect(rows[1].textContent).toContain("硬件解码");
  expect(rows[1].style.borderBottom).toBe("0px");
  expect(container.querySelector("hr")).toBeNull();
});
it("keeps automatic audio conservative and lets the user explicitly request bitstream", async () => {
  const change = vi.fn();
  render(
    <QualitySettings section="audio" settings={defaults} onChange={change} />,
  );
  expect(screen.getByLabelText("音频直通").getAttribute("data-value")).toBe(
    "auto",
  );
  await pickSelect(userEvent.setup(), screen.getByLabelText("音频直通"), "on");
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({
      quality: expect.objectContaining({ passthrough: "on" }),
    }),
  );
});
it("exposes three hwdec modes and does not advertise full Dolby Vision", async () => {
  const change = vi.fn();
  render(
    <QualitySettings section="video" settings={defaults} onChange={change} />,
  );
  await pickSelect(
    userEvent.setup(),
    screen.getByLabelText("硬件解码模式"),
    "no",
  );
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({
      quality: expect.objectContaining({ hwdec: "no" }),
    }),
  );
  expect(screen.getByText(/不代表完整输出所有 Profile/)).toBeTruthy();
});
