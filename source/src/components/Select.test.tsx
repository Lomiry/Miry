// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "./Select";
import { placePopover } from "./Popover";
import SettingsPanel from "./SettingsPanel";
import { defaults } from "../stores/settings";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("selects with keyboard, skips disabled options and returns focus", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <Select aria-label="观看状态" value="all" onChange={change}>
      <option value="all">全部</option>
      <option value="disabled" disabled>
        不可选
      </option>
      <option value="played">已看</option>
    </Select>,
  );
  const trigger = screen.getByRole("combobox");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "全部" }),
    ),
  );
  await user.keyboard("{ArrowDown}{Enter}");
  expect(change.mock.calls[0][0].target.value).toBe("played");
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("uses the same menu for a long list and navigates to its last option", async () => {
  const user = userEvent.setup();
  render(
    <Select aria-label="题材">
      {Array.from({ length: 40 }, (_, i) => (
        <option key={i} value={i}>
          题材 {i}
        </option>
      ))}
    </Select>,
  );
  await user.click(screen.getByRole("combobox"));
  expect(screen.getAllByRole("option")).toHaveLength(40);
  expect(screen.getByRole("listbox").classList.contains("ui-popover")).toBe(
    true,
  );
  await user.keyboard("{End}");
  expect(document.activeElement?.textContent).toContain("题材 39");
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(screen.getByRole("combobox"));
});
it("flips above near the bottom and clamps wide menus to the viewport", () => {
  const p = placePopover(
    { left: 780, top: 570, bottom: 608, width: 180 },
    { width: 850, height: 650 },
    240,
    320,
  );
  expect(p.flip).toBe(true);
  expect(p.top).toBe(244);
  expect(p.left + p.width).toBeLessThanOrEqual(838);
  expect(p.maxHeight).toBeLessThanOrEqual(320);
  const short = placePopover(
    { left: 20, top: 50, bottom: 88, width: 180 },
    { width: 850, height: 650 },
    0,
    120,
  );
  expect(short.flip).toBe(false);
  expect(short.width).toBe(180);
});
it("closes only the select before the settings dialog", async () => {
  const close = vi.fn(),
    user = userEvent.setup();
  render(
    <SettingsPanel
      settings={defaults}
      api={null}
      onChange={vi.fn()}
      onClose={close}
    />,
  );
  await user.click(screen.getByRole("combobox", { name: "播放兼容模式" }));
  await user.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it("uses vertical settings navigation and keeps the content in its own panel", async () => {
  const user = userEvent.setup();
  render(
    <SettingsPanel
      settings={defaults}
      api={null}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe(
    "vertical",
  );
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(10);
  tabs[0].focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
    tabs[1].id,
  );
  expect(document.activeElement).toBe(tabs[1]);
});
