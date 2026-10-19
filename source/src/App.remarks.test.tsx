import { pickSelect } from "./testSelect";
// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount, readAccount, clearAccount } from "./stores/account";
import { saveLoginHint } from "./stores/loginHints";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
const first = {
  server: "https://first.test/emby",
  userId: "u",
  token: "first-token",
  name: "A",
  deviceId: "d",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mockServer() {
  const fetch = vi.fn(
    async (address: string) =>
      new Response(
        JSON.stringify(
          address.includes("AuthenticateByName")
            ? { User: { Id: "u", Name: "B" }, AccessToken: "second-token" }
            : address.includes("System/Info/Public")
              ? { Id: "server", ServerName: "Test", Version: "4.9" }
              : { Items: [], TotalRecordCount: 0 },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("prefills an existing remark and allows clearing it through a saved connection", async () => {
  saveAccount({ ...first, remark: "旧备注" }, false);
  saveLoginHint(first.server, first.name);
  localStorage.setItem("miry-server", first.server);
  clearAccount();
  mockServer();
  const user = userEvent.setup();
  render(<App />);
  const remark = screen.getByLabelText("服务器备注");
  expect(remark).toHaveProperty("value", "旧备注");
  await user.clear(remark);
  await user.click(screen.getByRole("button", { name: "连接 旧备注" }));
  expect(
    await screen.findByRole("combobox", { name: "当前服务器" }),
  ).toBeTruthy();
  expect(readAccount()?.remark).toBe("");
});

it("adds a server with a local remark and preserves it when switching away and back", async () => {
  saveAccount(first, false);
  const fetch = mockServer();
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "添加服务器" }));
  const dialog = await screen.findByRole("dialog", { name: "添加服务器" });
  const form = within(dialog);
  expect(form.getByLabelText("服务器地址")).toHaveProperty("type", "url");
  await user.type(form.getByLabelText("服务器地址"), "https://second.test");
  await user.type(form.getByLabelText("服务器备注"), " 家庭影院 ");
  await user.type(form.getByLabelText("用户名"), "second");
  await user.click(form.getByRole("button", { name: "连接服务器" }));
  await screen.findByRole("combobox", { name: "当前服务器" });
  expect(readAccount()?.remark).toBe("家庭影院");
  expect(screen.queryByRole("dialog")).toBeNull();
  const login = fetch.mock.calls.find(([url]) =>
    url.includes("AuthenticateByName"),
  );
  expect(
    JSON.parse(String((login as unknown as [string, RequestInit])[1].body)),
  ).toEqual({ Username: "second", Pw: "" });
  await pickSelect(user, screen.getByLabelText("当前服务器"), {
    name: "first.test",
  });
  await screen.findByText("first.test", { selector: ".account strong" });
  await pickSelect(user, screen.getByLabelText("当前服务器"), {
    name: "家庭影院",
  });
  expect(readAccount()?.remark).toBe("家庭影院");
  expect(
    await screen.findByText("家庭影院", { selector: ".account strong" }),
  ).toBeTruthy();
});

it("also offers an optional remark on initial login and accepts a blank one", async () => {
  mockServer();
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByLabelText("服务器备注")).toHaveProperty("required", false);
  await user.type(screen.getByLabelText("服务器地址"), "https://second.test");
  await user.type(screen.getByLabelText("用户名"), "second");
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  expect(
    await screen.findByRole("combobox", { name: "当前服务器" }),
  ).toBeTruthy();
});
