// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  normalizeMetrics,
  routeScore,
  saveRouteTest,
  readRouteQuality,
  setRouteMode,
  noteRouteChoice,
  testRoute,
  suppressRouteWarnings,
  routeWarningsSuppressed,
} from "./smartRoutes";
import { saveRoute } from "../stores/routes";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
vi.mock("../stores/routes", async (original) => ({
  ...(await original<object>()),
  verifyRoute: vi
    .fn()
    .mockResolvedValue({ url: "https://backup.test/emby", serverId: "s" }),
}));
const account = {
  server: "https://home.test/emby",
  userId: "u",
  token: "private",
  deviceId: "d",
  name: "QA",
  serverId: "s",
};
const backup = {
  name: "备用",
  url: "https://backup.test/emby",
  serverId: "s",
  userId: "u",
};
const good = () =>
  normalizeMetrics({
    identityValid: true,
    apiTtfbMs: 100,
    apiTotalMs: 120,
    jitterMs: 10,
    samples: 3,
    failureRate: 0,
  });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  saveRoute(account, backup);
});
it("keeps unavailable stages null and rejects nonfinite or overlarge metrics", () => {
  const m = normalizeMetrics({
    samples: NaN,
    sampleBytes: 1e9,
    dnsMs: NaN,
    tcpMs: -1,
    tlsMs: null,
  });
  expect(m).toMatchObject({
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    samples: 0,
    sampleBytes: 262144,
  });
  expect(routeScore(m).label).toBe("不稳定");
});
it("explains API-only recommendations and penalizes inadequate media throughput", () => {
  const m = good();
  expect(routeScore(m).reasons.join()).toContain("媒体吞吐未测");
  expect(routeScore({ ...m, throughputMbps: 2 }, 30e6).score).toBeLessThan(
    routeScore(m).score,
  );
  expect(routeScore({ ...m, failureRate: 1 / 3 }).label).toBe("不稳定");
});
it("keeps the manual pin while recommending another route and isolates servers", () => {
  saveRouteTest(account, backup, good());
  expect(readRouteQuality(account)).toMatchObject({
    mode: "manual",
    pinned: account.server,
    recommended: backup.url,
  });
  expect(
    readRouteQuality({ ...account, serverId: "other" }).recommended,
  ).toBeUndefined();
  setRouteMode(account, "auto");
  noteRouteChoice(account, backup.url, false);
  expect(readRouteQuality(account)).toMatchObject({
    mode: "auto",
    automatic: backup.url,
  });
  noteRouteChoice(account, account.server, true);
  expect(readRouteQuality(account)).toMatchObject({
    mode: "manual",
    pinned: account.server,
  });
});
it("expires recommendations and preserves the bitrate used for scoring", () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1e12);
  const test = saveRouteTest(
    account,
    backup,
    { ...good(), throughputMbps: 1 },
    30e6,
  );
  expect(readRouteQuality(account).tests[backup.url].score).toBe(test.score);
  now.mockReturnValue(1e12 + 2 * 864e5);
  expect(readRouteQuality(account).recommended).toBeUndefined();
  now.mockReturnValue(1e12 + 8 * 864e5);
  expect(readRouteQuality(account).tests).toEqual({});
  now.mockRestore();
});
it("cancels a result without saving it and throttles before verification", async () => {
  const { invoke } = await import("@tauri-apps/api/core"),
    { verifyRoute } = await import("../stores/routes");
  const controller = new AbortController();
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "route_probe") {
      controller.abort();
      return good();
    }
  });
  await expect(
    testRoute(account, backup, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(readRouteQuality(account).tests).toEqual({});
  expect(invoke).toHaveBeenCalledWith("cancel_route_probe", expect.any(Object));
  await expect(
    testRoute(account, backup, new AbortController().signal),
  ).rejects.toThrow("60 秒");
  expect(verifyRoute).toHaveBeenCalledOnce();
});
it("does not invoke any probes for a single endpoint", async () => {
  const { invoke } = await import("@tauri-apps/api/core");
  const single = { ...account, userId: "single" };
  await expect(
    testRoute(
      single,
      { name: "base", url: single.server, serverId: "s", userId: "single" },
      new AbortController().signal,
    ),
  ).rejects.toThrow("至少两条");
  expect(invoke).not.toHaveBeenCalled();
});
it("suppresses UI for this module lifetime without writing persistent settings or changing health scores", () => {
  const before = localStorage.length,
    score = routeScore(good());
  expect(routeWarningsSuppressed()).toBe(false);
  suppressRouteWarnings();
  expect(routeWarningsSuppressed()).toBe(true);
  expect(localStorage.length).toBe(before);
  expect(routeScore(good())).toEqual(score);
});
