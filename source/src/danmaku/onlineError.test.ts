import { expect, it } from "vitest";
import {
  onlineErrorKind,
  onlineErrorMessage,
  validateProviderEnvelope,
} from "./onlineError";
it.each([
  [{ kind: "network" }, "NETWORK_ERROR"],
  [{ kind: "timeout" }, "NETWORK_ERROR"],
  [{ status: 401 }, "AUTH_ERROR"],
  [{ status: 403 }, "AUTH_ERROR"],
  [{ status: 429 }, "RATE_LIMITED"],
  [{ kind: "rate-limit", status: 200, code: 429 }, "RATE_LIMITED"],
  [{ status: 500 }, "PROVIDER_ERROR"],
  [Error("format"), "INVALID_RESPONSE"],
  [{ kind: "size" }, "INVALID_RESPONSE"],
  [{ kind: "no-match" }, "NO_MATCH"],
  [new DOMException("Aborted", "AbortError"), "CANCELLED"],
  [{ kind: "cancelled" }, "CANCELLED"],
])("classifies %j without a generic network label", (error, kind) => {
  expect(onlineErrorKind(error)).toBe(kind);
  expect(onlineErrorMessage(error)).not.toMatch(
    /HTTP|JSON|403|signature|网络错误或数据不可用/,
  );
});
it("honors HTTP-200 API failure envelopes without returning their messages", () => {
  try {
    validateProviderEnvelope({
      success: false,
      errorCode: 429,
      errorMessage: "private-body",
    });
    throw Error("not thrown");
  } catch (e) {
    expect(e).toEqual({ kind: "rate-limit", code: 429 });
    expect(JSON.stringify(e)).not.toContain("private-body");
  }
  expect(() =>
    validateProviderEnvelope({ success: true, animes: [] }),
  ).not.toThrow();
  expect(() =>
    validateProviderEnvelope({ success: false, errorCode: 7 }),
  ).toThrow();
});
it("rate-limit message distinguishes playback impact without urging an immediate restart", () => {
  expect(onlineErrorMessage({ code: 429 })).toBe(
    "弹弹play服务当前请求受限，请稍后再试。\n在线弹幕暂时不可用，不影响视频播放。",
  );
  expect(onlineErrorMessage({ code: 429 })).not.toMatch(
    /重新打开|立即重启|配额耗尽/,
  );
});
