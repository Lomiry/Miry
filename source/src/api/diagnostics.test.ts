import { afterEach, expect, it, vi } from "vitest";
import { EmbyClient } from "./client";
import {
  clearNetworkDiagnostics,
  readNetworkDiagnostics,
  responsePreview,
  redactNetworkDetail,
  networkCategory,
} from "./diagnostics";
const account = {
  server: "https://private.example.com:8443/emby",
  userId: "private-user",
  name: "Test",
  token: "private-token",
  deviceId: "test-device",
};
afterEach(() => {
  clearNetworkDiagnostics();
  vi.unstubAllGlobals();
});
it("preserves port and reverse-proxy path and probes Public before sending credentials, without a root-page request", async () => {
  const fetch = vi.fn(
    async (_address: string, _init?: any) =>
      new Response(
        JSON.stringify({
          Id: "server",
          ServerName: "Test",
          Version: "4.9.1.90",
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const info = await new EmbyClient({
    ...account,
    server: "https://private.example.com:8443/proxy/emby",
  }).serverInfo();
  expect(info.Version).toBe("4.9.1.90");
  expect(fetch.mock.calls[0][0]).toBe(
    "https://private.example.com:8443/proxy/System/Info/Public",
  );
  expect(fetch.mock.calls[0][1].headers["X-Emby-Token"]).toBeUndefined();
});
it("retries the /emby API prefix only after Public returns 404, not after permission or TLS errors", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("missing", { status: 404 }))
    .mockResolvedValueOnce(
      new Response('{"Id":"s","ServerName":"Test","Version":"4.9"}'),
    );
  vi.stubGlobal("fetch", fetch);
  await new EmbyClient(account).serverInfo();
  expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    "/System/Info/Public",
    "/emby/System/Info/Public",
  ]);
  fetch
    .mockReset()
    .mockRejectedValue(
      "url not allowed on the configured scope: https://private.example.com:8443/System/Info/Public",
    );
  await expect(new EmbyClient(account).serverInfo()).rejects.toMatchObject({
    category: "permission",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("retains the plugin error and safe request fields without disclosing address, credentials or response content", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        "url not allowed on the configured scope: https://private.example.com:8443/emby/Users/AuthenticateByName?token=private-token",
      ),
  );
  await expect(
    new EmbyClient(account).login("test", "private-password"),
  ).rejects.toMatchObject({ category: "permission" });
  const record = readNetworkDiagnostics().at(-1)!;
  expect(record).toMatchObject({
    stage: "login",
    method: "POST",
    url: "https://[server]:8443/Users/AuthenticateByName",
    category: "permission",
  });
  expect(record.underlying).toContain("url not allowed");
  const diagnostics = JSON.stringify(readNetworkDiagnostics());
  for (const secret of [
    "private.example.com",
    "private-token",
    "private-password",
  ])
    expect(diagnostics).not.toContain(secret);
  const preview = responsePreview(
    '{"User":{"Name":"private-user"},"AccessToken":"private-token","ServerName":"https://private.example.com","Message":"private-password"}',
  );
  expect(preview).not.toContain("private");
  expect(preview).toContain("[redacted]");
  const headers = redactNetworkDetail(
    "Authorization: Bearer token\nCookie: cookie\nX-Emby-Token: private-token",
  );
  expect(headers).not.toContain("Bearer");
  expect(headers).not.toContain("private-token");
});
it("separates invalid JSON and invalid ServerInfo from authentication and transport errors", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("<html>secret</html>"))
    .mockResolvedValueOnce(new Response('{"Items":[]}'))
    .mockResolvedValueOnce(new Response("secret", { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  await expect(new EmbyClient(account).serverInfo()).rejects.toMatchObject({
    category: "format",
  });
  await expect(new EmbyClient(account).serverInfo()).rejects.toMatchObject({
    category: "format",
  });
  await expect(
    new EmbyClient(account).login("name", "password"),
  ).rejects.toMatchObject({ category: "http", status: 401 });
  expect(JSON.stringify(readNetworkDiagnostics())).not.toContain("secret");
  expect(networkCategory(new Error("DNS lookup failed"))).toBe("dns");
  expect(networkCategory("connection refused")).toBe("tcp");
  expect(networkCategory("invalid peer certificate")).toBe("tls");
});
it("keeps at most 80 diagnostics in memory", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  const api = new EmbyClient(account);
  for (let i = 0; i < 90; i++) await api.item(String(i));
  expect(readNetworkDiagnostics()).toHaveLength(80);
});
