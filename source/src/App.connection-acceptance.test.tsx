// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { setLanguage } from "./i18n/core";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setLanguage("zh-CN", false);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("cancelling a parsed import preserves every existing form field and does not save or request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  const values = [
    ["服务器地址", "https://original.example.test:9443/proxy"],
    ["服务器备注", "Original"],
    ["用户名", "synthetic-user"],
    ["密码", "synthetic-only"],
  ];
  for (const [name, value] of values)
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  await user.click(screen.getByRole("checkbox", { name: /记住登录/ }));
  const before = JSON.stringify(localStorage);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  fireEvent.change(screen.getByLabelText("粘贴连接说明"), {
    target: { value: "https://replacement.example.test\n端口是8096" },
  });
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  await user.click(screen.getByRole("button", { name: "取消" }));
  for (const [name, value] of values)
    expect(screen.getByLabelText(name)).toHaveProperty("value", value);
  expect(screen.getByRole("checkbox", { name: /记住登录/ })).toHaveProperty(
    "checked",
    true,
  );
  expect(JSON.stringify(localStorage)).toBe(before);
  expect(fetch).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "智能导入" }),
  );
});
it("retains native required/URL validation and blocks invalid submission before networking", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  const { container } = render(<App />);
  const form = container.querySelector("form")!;
  expect(form.checkValidity()).toBe(false);
  fireEvent.change(screen.getByLabelText("服务器地址"), {
    target: { value: "not-a-url" },
  });
  fireEvent.change(screen.getByLabelText("用户名"), {
    target: { value: "synthetic-user" },
  });
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  expect(form.checkValidity()).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("服务器地址"), {
    target: { value: "https://media.example.test:9443/base" },
  });
  expect(form.checkValidity()).toBe(true);
});
