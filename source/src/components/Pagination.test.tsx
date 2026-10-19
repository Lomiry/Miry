// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";
import { blockedShortcut } from "../player/shortcuts";

afterEach(cleanup);
function setup(page = 0, pages: number | undefined = 29) {
  const onChange = vi.fn();
  const view = render(
    <Pagination
      page={page}
      pages={pages}
      hasMore
      onChange={onChange}
      contextKey="library-a"
    />,
  );
  return {
    ...view,
    onChange,
    user: userEvent.setup(),
    input: screen.getByLabelText("跳转到页码"),
  };
}
it("keeps a draft until the jump button submits a 1-based page", async () => {
  const { user, input, onChange } = setup();
  await user.clear(input);
  await user.type(input, "15");
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "跳转" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(14);
});
it("uses Enter to submit the same page-change path", async () => {
  const { user, input, onChange } = setup();
  await user.clear(input);
  await user.type(input, "2{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
});
it.each([
  ["1", 0],
  ["29", 28],
])("accepts boundary page %s", async (draft, expected) => {
  const { user, input, onChange } = setup(1);
  await user.clear(input);
  await user.type(input, draft);
  await user.click(screen.getByRole("button", { name: "跳转" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
});
it.each([
  "0",
  "30",
  "",
  "abc",
  "1.5",
  "-1",
  "1e1",
  " 2",
  "99999999999999999999",
])("rejects invalid draft %j without calling onChange", async (draft) => {
  const { user, input, onChange } = setup();
  await user.clear(input);
  if (draft) await user.type(input, draft);
  await user.click(screen.getByRole("button", { name: "跳转" }));
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText("第 1 页 / 29")).toBeTruthy();
});
it("same-page Enter and button submissions are no-ops", async () => {
  const { user, input, onChange } = setup(4);
  await user.click(input);
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: "跳转" }));
  expect(onChange).not.toHaveBeenCalled();
});
it("syncs draft and clears invalid state on page, total and context changes", async () => {
  const { user, input, onChange, rerender } = setup(2);
  await user.clear(input);
  await user.type(input, "25");
  rerender(
    <Pagination
      page={2}
      pages={4}
      hasMore
      onChange={onChange}
      contextKey="library-a"
    />,
  );
  expect(input).toHaveProperty("value", "3");
  await user.clear(input);
  await user.type(input, "0{Enter}");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  rerender(
    <Pagination
      page={2}
      pages={4}
      hasMore
      onChange={onChange}
      contextKey="library-b"
    />,
  );
  expect(input).toHaveProperty("value", "3");
  expect(input.getAttribute("aria-invalid")).toBeNull();
  rerender(
    <Pagination
      page={0}
      pages={4}
      hasMore
      onChange={onChange}
      contextKey="library-b"
    />,
  );
  expect(input).toHaveProperty("value", "1");
});
it("clamps the draft to valid bounds when the total shrinks", () => {
  const { input, onChange, rerender } = setup(24);
  rerender(
    <Pagination page={24} pages={4} hasMore={false} onChange={onChange} />,
  );
  expect(input).toHaveProperty("value", "4");
  expect(onChange).not.toHaveBeenCalled();
});
it("allows a temporarily empty draft and normal keyboard editing with existing shortcut protection", async () => {
  const { user, input, onChange } = setup();
  const shortcut = vi.fn();
  const listen = (event: KeyboardEvent) => {
    if (!blockedShortcut(event)) shortcut();
  };
  document.addEventListener("keydown", listen);
  try {
    await user.click(input);
    expect(document.activeElement).toBe(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}");
    expect(input).toHaveProperty("value", "");
    await user.keyboard("15{ArrowLeft}{Delete}2{Backspace}5");
    expect(input).toHaveProperty("value", "15");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(14);
    expect(shortcut).not.toHaveBeenCalled();
  } finally {
    document.removeEventListener("keydown", listen);
  }
});
it("does not submit during IME composition or keyCode 229", async () => {
  const { user, input, onChange } = setup();
  await user.clear(input);
  await user.type(input, "2");
  fireEvent.compositionStart(input);
  fireEvent.submit(input.closest("form")!);
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
});
it("previous, next and jump share the controlled onChange callback", async () => {
  const { user, onChange } = setup(3);
  await user.click(screen.getByRole("button", { name: "上一页" }));
  await user.click(screen.getByRole("button", { name: "下一页" }));
  expect(onChange.mock.calls).toEqual([[2], [4]]);
});
it("preserves unknown-total previous/next navigation without an unbounded jump", () => {
  const onChange = vi.fn();
  render(<Pagination page={0} hasMore onChange={onChange} />);
  expect(screen.queryByLabelText("跳转到页码")).toBeNull();
  expect(screen.getByRole("button", { name: "下一页" })).toHaveProperty(
    "disabled",
    false,
  );
});
it("respects an explicitly busy pager", () => {
  render(<Pagination page={1} pages={29} hasMore busy onChange={vi.fn()} />);
  expect(screen.getByLabelText("跳转到页码")).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "跳转" })).toHaveProperty(
    "disabled",
    true,
  );
});
