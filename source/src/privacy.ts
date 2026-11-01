// Addresses are visible; credentials inside diagnostic URLs remain private.
import { t, localizeMessage, isAppMessage } from "./i18n/core";
export function privateText(value: string) {
  return value
    .replace(
      /([?&](?:api_key|token|access_token|password|pw)=)[^&\s<>"'，。；）)]+/gi,
      "$1[凭据已隐藏]",
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[凭据已隐藏]@");
}

export function privateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    localizeMessage(privateText(message)) ||
    t("player.the_action_could_not_be_completed_try")
  );
}

export function displayError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = privateText(raw);
  if (!message) return "";
  const localized = localizeMessage(message);
  if (isAppMessage(message)) return localized;
  // Known messages in the selected catalog are already localized. Unknown
  // external detail stays verbatim, behind an understandable localized label.
  const wrapped = t("errors.external", { detail: message });
  if (message.startsWith(t("errors.external", { detail: "" }))) return message;
  return wrapped;
}

export function routeLabel(name: string, index: number) {
  return name || t("network.route_number", { p0: index + 1 });
}
