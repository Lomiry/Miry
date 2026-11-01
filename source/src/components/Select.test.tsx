// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import Select from "./Select";
import { placePopover } from "./Popover";
import SettingsPanel from "./SettingsPanel";
import { defaults } from "../stores/settings";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  // Keyboard input must work before the next animation frame.
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
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
  expect(document.activeElement).toBe(
    screen.getByRole("option", { name: "题材 0" }),
  );
  await user.keyboard("{End}");
  expect(document.activeElement?.textContent).toContain("题材 39");
  fireEvent.resize(window);
  fireEvent.scroll(window);
  expect(document.activeElement?.textContent).toContain("题材 39");
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(screen.getByRole("combobox"));
});
it("focuses an enabled option when the selected option is disabled", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <Select aria-label="可用选项" value="unavailable" onChange={change}>
      <option value="unavailable" disabled>
        当前不可用
      </option>
      <option value="first">首个可用项</option>
      <option value="disabled" disabled>
        跳过此项
      </option>
      <option value="last">末个可用项</option>
    </Select>,
  );
  const trigger = screen.getByRole("combobox");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("option", { name: "首个可用项" }),
    ),
  );
  expect(change).not.toHaveBeenCalled();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(change).toHaveBeenCalledOnce();
  expect(change.mock.calls[0][0].target.value).toBe("last");
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});
it.each(["empty", "disabled"])(
  "keeps the trigger usable when the list is %s",
  async (kind) => {
    const change = vi.fn(),
      user = userEvent.setup();
    render(
      <Select aria-label="边界选项" onChange={change}>
        {kind === "disabled" && (
          <option value="disabled" disabled>
            不可用
          </option>
        )}
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{Escape}");
    expect(change).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  },
);
it("handles rapid reopen before and after exit cleanup in StrictMode", () => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
  render(
    <StrictMode>
      <Select aria-label="快速操作">
        <option value="first">第一项</option>
        <option value="disabled" disabled>
          不可用
        </option>
        <option value="last">最后一项</option>
      </Select>
    </StrictMode>,
  );
  const trigger = screen.getByRole("combobox");
  for (let i = 0; i < 3; i++) {
    fireEvent.click(trigger);
    const first = screen.getByRole("option", { name: "第一项" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    const last = screen.getByRole("option", { name: "最后一项" });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
    act(() => vi.advanceTimersByTime(i === 2 ? 121 : 60));
  }
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(
    screen.getByRole("option", { name: "第一项" }),
  );
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole("listbox")).toBeTruthy();
});
it("does not steal outside focus on pointer dismissal or after unmount", () => {
  vi.useFakeTimers();
  const renderSelect = () => (
    <Select aria-label="卸载选项">
      <option value="first">可用项</option>
    </Select>
  );
  const outside = document.createElement("button");
  document.body.append(outside);
  const view = render(renderSelect());
  fireEvent.click(screen.getByRole("combobox"));
  outside.focus();
  fireEvent.pointerDown(outside);
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(outside);
  fireEvent.click(screen.getByRole("combobox"));
  view.unmount();
  outside.focus();
  act(() => vi.advanceTimersByTime(200));
  expect(document.querySelector(".ui-popover")).toBeNull();
  expect(document.activeElement).toBe(outside);
  // A new owner's menu still responds after the previous layer was removed.
  render(renderSelect());
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.pointerDown(outside);
  expect(screen.queryByRole("listbox")).toBeNull();
  outside.remove();
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
  // Account actions already live in the server menu; settings has nine sections.
  expect(tabs).toHaveLength(9);
  tabs[0].focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
    tabs[1].id,
  );
  expect(document.activeElement).toBe(tabs[1]);
});
