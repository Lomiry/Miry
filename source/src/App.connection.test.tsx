// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { clearNetworkDiagnostics } from "./api/diagnostics";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearNetworkDiagnostics();
});
it("probes 8443 before authenticating and loads libraries only after successful login", async () => {
  const fetch = vi.fn(
    async (address: string, _init?: any) =>
      new Response(
        JSON.stringify(
          address.endsWith("/System/Info/Public")
            ? { Id: "server", ServerName: "Test", Version: "4.9.1.90" }
            : address.endsWith("/AuthenticateByName")
              ? { User: { Id: "u", Name: "Test" }, AccessToken: "secret-token" }
              : {
                  Items: [
                    {
                      Id: "movies",
                      Name: "电影库",
                      Type: "CollectionFolder",
                      CollectionType: "movies",
                    },
                  ],
                  TotalRecordCount: 1,
                },
        ),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByLabelText("服务器地址"),
    "https://media.example.com:8443",
  );
  await user.type(screen.getByLabelText("用户名"), "Test");
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  await screen.findByRole("button", { name: "打开媒体库 电影库" });
  expect(
    fetch.mock.calls.slice(0, 3).map(([url]) => new URL(url).pathname),
  ).toEqual([
    "/System/Info/Public",
    "/emby/Users/AuthenticateByName",
    "/emby/Users/u/Views",
  ]);
  expect(fetch.mock.calls[0][1].headers["X-Emby-Token"]).toBeUndefined();
});
it("does not send credentials after probe failure and labels login rejection separately", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValue("url not allowed on the configured scope");
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByLabelText("服务器地址"),
    "https://media.example.com:8443",
  );
  await user.type(screen.getByLabelText("用户名"), "Test");
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "服务器探测失败",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch
    .mockReset()
    .mockResolvedValueOnce(
      new Response('{"Id":"s","ServerName":"Test","Version":"4.9"}'),
    )
    .mockResolvedValueOnce(new Response("denied", { status: 401 }));
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  expect((await screen.findByRole("alert")).textContent).toContain("登录失败");
  expect(sessionStorage.getItem("miry-account")).toBeNull();
});
it("copies useful anonymous diagnostics from the failed connection screen", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        "url not allowed on the configured scope: https://media.example.com:8443/System/Info/Public",
      ),
  );
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<App />);
  await user.type(
    screen.getByLabelText("服务器地址"),
    "https://media.example.com:8443",
  );
  await user.type(screen.getByLabelText("用户名"), "Test");
  await user.type(screen.getByLabelText("密码"), "private-password");
  await user.click(screen.getByRole("button", { name: "连接服务器" }));
  await user.click(await screen.findByRole("button", { name: "复制匿名诊断" }));
  const diagnostics = write.mock.calls[0][0];
  expect(diagnostics).toContain('"category": "permission"');
  expect(diagnostics).toContain(":8443/System/Info/Public");
  expect(diagnostics).not.toContain("media.example.com");
  expect(diagnostics).not.toContain("private-password");
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    expect.stringContaining("匿名诊断已复制"),
  );
});
