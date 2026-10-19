// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ShortcutSettings from "./ShortcutSettings";
import { defaults } from "../stores/settings";
afterEach(cleanup);
it("waits for the primary key, captures canonical chords and refuses conflicts and reserved keys", () => {
  const onChange = vi.fn();
  render(<ShortcutSettings settings={defaults} onChange={onChange} />);
  const input = screen.getByRole("textbox", { name: "播放 / 暂停快捷键" });
  fireEvent.focus(input);
  fireEvent.keyDown(input, {
    key: "Control",
    code: "ControlLeft",
    ctrlKey: true,
  });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(input, {
    key: "S",
    code: "KeyS",
    ctrlKey: true,
    shiftKey: true,
  });
  expect(onChange.mock.lastCall?.[0].shortcuts.pause).toBe("Ctrl+Shift+KeyS");
  onChange.mockClear();
  fireEvent.keyDown(input, { key: "f", code: "KeyF" });
  expect(screen.getByRole("alert").textContent).toContain("已用于");
  fireEvent.keyDown(input, { key: "F4", code: "F4", altKey: true });
  expect(screen.getByRole("alert").textContent).toContain("系统保留");
  expect(onChange).not.toHaveBeenCalled();
});
