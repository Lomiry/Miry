// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "./SearchBar";
import { recordSearch, readSearchHistory } from "../stores/searchHistory";
const native = vi.hoisted(() => ({
  enabled: false,
  focus: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => native.enabled }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ setFocus: native.focus }),
}));
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
it("realistic pointer focus and keyboard editing reach the input and request main WebView focus", async () => {
  native.enabled = true;
  native.focus.mockClear();
  try {
    const user = userEvent.setup(),
      search = vi.fn();
    render(<SearchBar scope="demo" onSearch={search} />);
    const input = screen.getByLabelText("搜索媒体");
    await user.pointer({ target: input, keys: "[MouseLeft]" });
    expect(document.activeElement).toBe(input);
    expect(native.focus).toHaveBeenCalled();
    await user.keyboard("abc123 {ArrowLeft}{Backspace}");
    expect(input).toHaveProperty("value", "abc12 ");
    await user.keyboard("{Control>}a{/Control}");
    await user.copy();
    await user.cut();
    expect(input).toHaveProperty("value", "");
    await user.paste();
    expect(input).toHaveProperty("value", "abc12 ");
    await user.keyboard("{Enter}");
    expect(search).toHaveBeenLastCalledWith("abc12");
  } finally {
    native.enabled = false;
  }
});
it("Enter submits typed text with visible history, without clearing it; click and empty queries are explicit", async () => {
  recordSearch("demo", "Dune 1984");
  const search = vi.fn(),
    clear = vi.fn(),
    user = userEvent.setup();
  render(<SearchBar scope="demo" onSearch={search} onClear={clear} />);
  const input = screen.getByLabelText("搜索媒体");
  await user.type(input, "Dune 2021");
  await user.keyboard("{Enter}");
  expect(search).toHaveBeenLastCalledWith("Dune 2021");
  expect(readSearchHistory("demo")).toContain("Dune 1984");
  await user.click(screen.getByLabelText("清空搜索关键词"));
  expect(clear).toHaveBeenCalledTimes(1);
  await user.keyboard("{Enter}");
  expect(search).toHaveBeenCalledTimes(1);
  await user.type(input, "沙丘 2");
  await user.click(screen.getByLabelText("提交媒体搜索"));
  expect(search).toHaveBeenLastCalledWith("沙丘 2");
});
it("blocks native composing Enter even when composition state has ended", () => {
  const search = vi.fn();
  render(<SearchBar scope="demo" onSearch={search} />);
  const input = screen.getByLabelText("搜索媒体");
  fireEvent.change(input, { target: { value: "沙丘" } });
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    isComposing: true,
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(search).not.toHaveBeenCalled();
});
it("waits for submission and lets users revisit suggestions with the keyboard", async () => {
  recordSearch("demo", "星际穿越");
  recordSearch("demo", "星际迷航");
  const search = vi.fn();
  const user = userEvent.setup();
  render(<SearchBar scope="demo" onSearch={search} />);
  await user.type(screen.getByLabelText("搜索媒体"), "星际");
  expect(search).not.toHaveBeenCalled();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(search).toHaveBeenCalledWith("星际迷航");
  expect(screen.queryByRole("region", { name: "最近搜索" })).toBeNull();
  expect(readSearchHistory("demo")[0]).toBe("星际迷航");
  await user.click(screen.getByLabelText("搜索媒体"));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "最近搜索" })).toBeNull();
});
it("removes individual entries, clears history, and preserves the entered query", async () => {
  recordSearch("demo", "星际穿越");
  recordSearch("demo", "降临");
  render(<SearchBar scope="demo" onSearch={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("搜索媒体"));
  await user.click(screen.getByRole("button", { name: "删除搜索记录 降临" }));
  expect(readSearchHistory("demo")).toEqual(["星际穿越"]);
  await user.click(screen.getByRole("button", { name: "清空历史" }));
  expect(readSearchHistory("demo")).toEqual([]);
  await user.type(screen.getByLabelText("搜索媒体"), "新搜索");
  expect(screen.getByLabelText("搜索媒体")).toHaveProperty("value", "新搜索");
});
it("avoids submitting during Chinese composition and disables shortcuts behind dialogs", async () => {
  const search = vi.fn();
  const { rerender } = render(<SearchBar scope="demo" onSearch={search} />);
  const input = screen.getByLabelText("搜索媒体");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "电影" } });
  fireEvent.submit(input.closest("form")!);
  expect(search).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.submit(input.closest("form")!);
  expect(search).toHaveBeenCalledWith("电影");
  rerender(<SearchBar scope="demo" onSearch={search} disabled />);
  input.blur();
  await userEvent.setup().keyboard("{Control>}k{/Control}");
  expect(document.activeElement).not.toBe(input);
});
