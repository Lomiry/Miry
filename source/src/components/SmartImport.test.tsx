// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SmartImport from "./SmartImport";
import CertificateOption from "./CertificateOption";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("previews below the paste box without a duplicate edit form or exposed password", async () => {
  localStorage.clear();
  const confirm = vi.fn(),
    user = userEvent.setup();
  render(<SmartImport disabled={false} onConfirm={confirm} />);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  await user.type(
    screen.getByLabelText("粘贴连接说明"),
    "https://a.example.test\n用户名: demo\n密码: sample",
  );
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  expect(screen.getByLabelText("粘贴连接说明")).toHaveProperty("value", "");
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(screen.getByText(/密码已识别/)).toBeTruthy();
  expect(screen.queryByText("sample")).toBeNull();
  expect(
    document.querySelector('input[type="password"], input[type="text"]'),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  expect(screen.getByLabelText("粘贴连接说明")).toHaveProperty("value", "");
});
it("fills only the selected candidate and keeps the other exact URLs pending", async () => {
  const confirm = vi.fn(),
    user = userEvent.setup();
  render(<SmartImport disabled={false} onConfirm={confirm} />);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  await user.type(
    screen.getByLabelText("粘贴连接说明"),
    "https://a.example.test\nhttps://b.example.test",
  );
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  await user.click(screen.getByRole("radio", { name: /候选 2/ }));
  await user.click(screen.getByRole("button", { name: "填入连接表单" }));
  expect(confirm).toHaveBeenCalledWith(
    { address: "https://b.example.test", username: "", password: "" },
    ["https://a.example.test"],
  );
});
it("requires warning acceptance before enabling the certificate exception", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false),
    change = vi.fn(),
    user = userEvent.setup();
  render(<CertificateOption value={false} onChange={change} />);
  await user.click(screen.getByRole("checkbox"));
  expect(confirm).toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("checkbox"));
  expect(change).toHaveBeenCalledWith(true);
});
it("shows a clear failed parse and never applies, requests or persists it", async () => {
  const confirm = vi.fn(),
    user = userEvent.setup();
  const fetch = vi.spyOn(globalThis, "fetch");
  const write = vi.spyOn(Storage.prototype, "setItem");
  render(<SmartImport disabled={false} onConfirm={confirm} />);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  fireEvent.change(screen.getByLabelText("粘贴连接说明"), {
    target: { value: "https://media.example.test/path?api_key=synthetic-only" },
  });
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  expect(screen.getByRole("status").textContent).toContain("未找到有效地址");
  expect(screen.queryByRole("button", { name: "填入连接表单" })).toBeNull();
  expect(confirm).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
it("uses the latest parse, discards old preview on edit and ignores repeated empty parse clicks", async () => {
  const confirm = vi.fn(),
    user = userEvent.setup();
  render(<SmartImport disabled={false} onConfirm={confirm} />);
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  const input = screen.getByLabelText("粘贴连接说明");
  fireEvent.change(input, { target: { value: "https://first.example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "解析并预览" }));
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  fireEvent.change(input, {
    target: { value: "https://second.example.test:9443/base" },
  });
  expect(screen.queryByRole("radio")).toBeNull();
  const parse = screen.getByRole("button", { name: "解析并预览" });
  fireEvent.click(parse);
  fireEvent.click(parse);
  expect(parse).toHaveProperty("disabled", true);
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("radio").getAttribute("aria-label")).toContain(
    "https://second.example.test:9443/base",
  );
  await user.click(screen.getByRole("button", { name: "填入连接表单" }));
  expect(confirm).toHaveBeenCalledExactlyOnceWith(
    {
      address: "https://second.example.test:9443/base",
      username: "",
      password: "",
    },
    [],
  );
});
it("blocks import actions while the existing form is busy", async () => {
  const confirm = vi.fn(),
    user = userEvent.setup();
  const { rerender } = render(
    <SmartImport disabled={false} onConfirm={confirm} />,
  );
  await user.click(screen.getByRole("button", { name: "智能导入" }));
  fireEvent.change(screen.getByLabelText("粘贴连接说明"), {
    target: { value: "https://media.example.test" },
  });
  await user.click(screen.getByRole("button", { name: "解析并预览" }));
  rerender(<SmartImport disabled onConfirm={confirm} />);
  await user.click(screen.getByRole("button", { name: "填入连接表单" }));
  expect(confirm).not.toHaveBeenCalled();
});
