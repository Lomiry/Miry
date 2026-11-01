import { t } from "../i18n/core";
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
      return t("danmaku.could_not_connect_to_the_play_open");
    case "AUTH_ERROR":
      return t("danmaku.the_play_service_is_unavailable_try_again");
    case "RATE_LIMITED":
      return t("danmaku.the_play_service_is_rate_limited_try");
    case "NO_MATCH":
      return t("danmaku.no_matching_danmaku_title_found_try_a");
    case "NO_COMMENTS":
      return t("danmaku.title_found_but_no_danmaku_is_available");
    case "INVALID_RESPONSE":
      return t("danmaku.the_data_returned_by_play_is_unavailable");
    case "CANCELLED":
      return t("danmaku.online_request_cancelled_you_can_search_manually");
    case "UNCONFIGURED":
      return t("danmaku.unconfigured_with_local");
    case "NOT_FOUND":
      return t("danmaku.this_match_is_no_longer_available_choose");
    default:
      return t("danmaku.the_play_service_is_unavailable_try_again");
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
