export type OnlineErrorKind =
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "NO_MATCH"
  | "NO_COMMENTS"
  | "INVALID_RESPONSE"
  | "CANCELLED"
  | "UNCONFIGURED"
  | "NOT_FOUND";

export function onlineErrorKind(error: unknown): OnlineErrorKind {
  const e = error as {
    kind?: string;
    status?: number;
    code?: number;
    name?: string;
    message?: string;
  } | null;
  if (e?.name === "AbortError" || e?.kind === "cancelled") return "CANCELLED";
  if (e?.kind === "rate-limit" || e?.status === 429 || e?.code === 429)
    return "RATE_LIMITED";
  if (
    e?.kind === "auth" ||
    [401, 403].includes(e?.status || 0) ||
    [401, 403].includes(e?.code || 0)
  )
    return "AUTH_ERROR";
  if (e?.kind === "unconfigured") return "UNCONFIGURED";
  if (e?.kind === "no-match") return "NO_MATCH";
  if (e?.kind === "not-found" || e?.status === 404) return "NOT_FOUND";
  if (
    ["network", "timeout"].includes(e?.kind || "") ||
    e?.message === "timeout"
  )
    return "NETWORK_ERROR";
  if (
    ["format", "size", "redirect", "invalid-response"].includes(
      e?.kind || "",
    ) ||
    e?.message === "format"
  )
    return "INVALID_RESPONSE";
  return "PROVIDER_ERROR";
}

export function onlineErrorMessage(error: unknown) {
  switch (onlineErrorKind(error)) {
    case "NETWORK_ERROR":
      return "暂时无法连接弹弹play开放弹幕网络，请稍后重试";
    case "AUTH_ERROR":
      return "弹弹play服务暂时不可用，请稍后重试";
    case "RATE_LIMITED":
      return "弹弹play服务当前请求受限，请稍后再试。\n在线弹幕暂时不可用，不影响视频播放。";
    case "NO_MATCH":
      return "未找到匹配的弹幕作品，可尝试手动搜索";
    case "NO_COMMENTS":
      return "已找到作品，但暂无可用弹幕";
    case "INVALID_RESPONSE":
      return "弹弹play返回的数据暂时不可用，请稍后重试";
    case "CANCELLED":
      return "已取消在线请求，可继续手动搜索";
    case "UNCONFIGURED":
      return "未配置在线弹幕服务，视频播放和本地弹幕可继续使用";
    case "NOT_FOUND":
      return "匹配资源已失效，请更换匹配";
    default:
      return "弹弹play服务暂时不可用，请稍后重试";
  }
}

export function validateProviderEnvelope(value: unknown, comments = false) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("format");
  const v = value as { success?: unknown; errorCode?: unknown };
  if (
    v.success === false ||
    (typeof v.errorCode === "number" && v.errorCode !== 0)
  ) {
    const code = typeof v.errorCode === "number" ? v.errorCode : undefined;
    throw {
      kind:
        code === 429
          ? "rate-limit"
          : code === 401 || code === 403
            ? "auth"
            : code === 7
              ? comments
                ? "not-found"
                : "no-match"
              : "provider",
      code,
    };
  }
}
