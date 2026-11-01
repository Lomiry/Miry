import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { compatibleTransport } from "./compatibleTransport";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
const source = {
  id: "custom",
  name: "LogVar",
  protocol: "logvar" as const,
  endpoint: "https://example.invalid",
  priority: 1,
  enabled: true,
};
it("reports unreadable native credentials without leaking details", async () => {
  vi.mocked(invoke).mockRejectedValueOnce("credential-read");
  await expect(
    compatibleTransport(
      source,
      { kind: "health" },
      new AbortController().signal,
    ),
  ).rejects.toEqual({ kind: "unconfigured" });
});
it("withholds unexpected native errors", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(Error(crypto.randomUUID()));
  await expect(
    compatibleTransport(
      source,
      { kind: "health" },
      new AbortController().signal,
    ),
  ).rejects.toEqual({ kind: "provider" });
});
it("passes only the persisted source's explicit LAN authorization to the native request", async () => {
  vi.mocked(invoke)
    .mockClear()
    .mockResolvedValueOnce({ success: true, animes: [] });
  await compatibleTransport(
    { ...source, endpoint: "http://192.168.50.1:9321", allowLanHttp: true },
    { kind: "health" },
    new AbortController().signal,
  );
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_request",
    expect.objectContaining({
      endpoint: "http://192.168.50.1:9321",
      allowLanHttp: true,
    }),
  );
});
