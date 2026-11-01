import { t } from "../i18n/core";
export function sourceError(kind: string) {
  switch (kind) {
    case "UNCONFIGURED":
      return t("danmaku.online_danmaku_is_not_configured");
    case "NETWORK_ERROR":
      return t("sources.error_network");
    case "AUTH_ERROR":
      return t("sources.error_auth");
    case "RATE_LIMITED":
      return t("sources.error_rate");
    case "INVALID_RESPONSE":
      return t("sources.error_data");
    case "NO_MATCH":
      return t("sources.error_match");
    case "NO_COMMENTS":
      return t("sources.error_empty");
    case "MANUAL_MATCH":
      return t("sources.error_manual");
    default:
      return t("sources.error_service");
  }
}
