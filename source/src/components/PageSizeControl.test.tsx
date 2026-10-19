// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageSizeControl from "./PageSizeControl";
import { pickSelect } from "../testSelect";
afterEach(cleanup);
it("selects presets and applies a custom integer through Enter", async () => {
  const onChange = vi.fn(),
    user = userEvent.setup();
  const view = render(<PageSizeControl value={30} onChange={onChange} />);
  for (const size of [20, 50, 100, 30]) {
    await pickSelect(user, screen.getByLabelText("每页显示"), String(size));
    expect(onChange).toHaveBeenLastCalledWith(size);
    view.rerender(<PageSizeControl value={size} onChange={onChange} />);
  }
  await pickSelect(user, screen.getByLabelText("每页显示"), "custom");
  const input = screen.getByLabelText("自定义每页数量");
  await user.clear(input);
  await user.type(input, "73{Enter}");
  expect(onChange).toHaveBeenLastCalledWith(73);
  view.rerender(<PageSizeControl value={73} onChange={onChange} />);
  expect(input).toHaveProperty("value", "73");
});
it("keeps invalid drafts out of the callback and exposes a useful error", async () => {
  const onChange = vi.fn(),
    user = userEvent.setup();
  render(<PageSizeControl value={30} onChange={onChange} />);
  await pickSelect(user, screen.getByLabelText("每页显示"), "custom");
  const input = screen.getByLabelText("自定义每页数量");
  for (const value of [
    "",
    "0",
    "-1",
    "9",
    "201",
    "10.5",
    "1e2",
    "abc",
    "99999999999999999",
  ]) {
    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  }
  await user.clear(input);
  await user.type(input, "200{Enter}");
  expect(onChange).toHaveBeenCalledWith(200);
});
