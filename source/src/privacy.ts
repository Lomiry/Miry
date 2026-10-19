// Addresses are visible; credentials inside diagnostic URLs remain private.
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
  return privateText(message) || "操作未完成，请重试。";
}

export function routeLabel(name: string, index: number) {
  return name || `线路 ${index + 1}`;
}
