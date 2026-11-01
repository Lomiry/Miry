// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { EmbyClient } from "./client";
import { readNetworkDiagnostics, clearNetworkDiagnostics } from "./diagnostics";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
const account = {
  server: "https://media.example.test/emby",
  serverId: "s",
  userId: "u",
  token: "test-only-token",
  name: "demo",
  deviceId: "d",
};
afterEach(() => {
  vi.clearAllMocks();
  clearNetworkDiagnostics();
});
it("isolates native certificate policy per connection and refuses redirect credential forwarding", async () => {
  vi.mocked(nativeFetch).mockImplementation(async () => new Response("{}"));
  await new EmbyClient({ ...account, ignoreCertificateErrors: true }).request(
    "/one",
  );
  await new EmbyClient(account).request("/two");
  expect(vi.mocked(nativeFetch).mock.calls[0][1]).toMatchObject({
    maxRedirections: 0,
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: false },
  });
  expect(vi.mocked(nativeFetch).mock.calls[1][1]).not.toHaveProperty("danger");
});
it("distinguishes TLS errors from authentication and redacts login diagnostics", async () => {
  vi.mocked(nativeFetch).mockRejectedValue(
    Error(
      "certificate verify failed https://media.example.test test-only-token test-only-password",
    ),
  );
  await expect(
    new EmbyClient(account).login("demo", "test-only-password"),
  ).rejects.toMatchObject({ category: "tls", status: 0 });
  const diagnostics = JSON.stringify(readNetworkDiagnostics());
  expect(diagnostics).not.toContain("media.example.test");
  expect(diagnostics).not.toContain("test-only-token");
  expect(diagnostics).not.toContain("test-only-password");
});
