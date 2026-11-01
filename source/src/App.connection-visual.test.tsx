// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
  setLanguage("zh-CN", false);
  vi.unstubAllGlobals();
});

it("offers only connection tools before sign-in and makes no media requests", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { container } = render(<App />);
  expect(
    screen.getByRole("heading", { level: 1, name: "连接你的媒体库" }),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Emby 服务器" })).toBeTruthy();
  for (const label of ["服务器地址", "服务器备注", "用户名", "密码"])
    expect(screen.getByLabelText(label)).toBeTruthy();
  expect(screen.getByRole("button", { name: "智能导入" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "打开演示媒体库" })).toBeTruthy();
  expect(
    container.querySelector("nav, .media-card, .player-panel, .home-view"),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".login-feature")).toHaveLength(3);
});

it("fills the existing form from a compact preview with the supplied port and no invented path", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  const { container } = render(<App />);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  fireEvent.change(screen.getByLabelText("粘贴连接说明"), {
    target: {
      value:
        "服务器地址：media.example.test\n协议是：https\n端口是：8443\n用户名：demo\n密码：synthetic-only",
    },
  });
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  expect(screen.getAllByLabelText("服务器地址")).toHaveLength(1);
  expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1);
  expect(
    container.querySelector(".import-preview input:not([type=radio])"),
  ).toBeNull();
  expect(screen.queryByText("synthetic-only")).toBeNull();
  await user.click(screen.getByRole("button", { name: "填入连接表单" }));
  expect(screen.getByLabelText("服务器地址")).toHaveProperty(
    "value",
    "https://media.example.test:8443",
  );
  expect(screen.getByLabelText("用户名")).toHaveProperty("value", "demo");
  expect(screen.getByLabelText("密码")).toHaveProperty(
    "value",
    "synthetic-only",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("retranslates connection tools without resetting fields, remember choice or an import draft", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  const server = screen.getByLabelText("服务器地址") as HTMLInputElement;
  const remark = screen.getByLabelText("服务器备注") as HTMLInputElement;
  const username = screen.getByLabelText("用户名") as HTMLInputElement;
  const password = screen.getByLabelText("密码") as HTMLInputElement;
  fireEvent.change(server, { target: { value: "https://example.test" } });
  fireEvent.change(remark, { target: { value: "Test library" } });
  fireEvent.change(username, { target: { value: "test-user" } });
  fireEvent.change(password, { target: { value: "test-only" } });
  await user.click(screen.getByRole("checkbox", { name: /记住登录/ }));
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  fireEvent.change(screen.getByLabelText("粘贴连接说明"), {
    target: { value: "https://import.example.test" },
  });
  act(() => setLanguage("en-US", false));
  expect(
    screen.getByRole("heading", { level: 1, name: "Connect to your library" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("Server address")).toBe(server);
  expect(server.value).toBe("https://example.test");
  expect(remark.value).toBe("Test library");
  expect(username.value).toBe("test-user");
  expect(password.value).toBe("test-only");
  expect(
    (screen.getByRole("checkbox", { name: /Remember me/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (screen.getByRole("textbox", { name: /Paste/ }) as HTMLTextAreaElement)
      .value,
  ).toBe("https://import.example.test");
  expect(fetch).not.toHaveBeenCalled();
});

it("shows TLS settings at the top level without enabling compatibility or changing form values", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);
  expect(screen.queryByText("高级连接设置")).toBeNull();
  await user.type(screen.getByLabelText("服务器地址"), "https://example.test");
  expect(
    container.querySelector(".route-security .certificate-option"),
  ).toBeTruthy();
  expect(
    (container.querySelector(".certificate-option input") as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect((screen.getByLabelText("服务器地址") as HTMLInputElement).value).toBe(
    "https://example.test",
  );
});
