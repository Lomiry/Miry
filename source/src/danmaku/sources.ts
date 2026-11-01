export interface DanmakuSource {
  id: string;
  name: string;
  protocol: "dandanplay" | "logvar";
  endpoint: string;
  enabled: boolean;
  priority: number;
  keyRevision?: number;
  anonymous?: boolean;
  allowLanHttp?: boolean;
}
export interface SourceSettings {
  mode: string;
  sources: DanmakuSource[];
}
export const sourceDefaults: SourceSettings = {
  mode: "dandanplay",
  sources: [
    {
      id: "dandanplay",
      name: "DandanPlay",
      protocol: "dandanplay",
      endpoint: "",
      enabled: true,
      priority: 0,
    },
  ],
};
function parsedEndpoint(value: string): URL | null {
  try {
    const u = new URL(value);
    const path = decodeURIComponent(u.pathname);
    return value.length <= 2048 &&
      !/[\s\\\u0000-\u001f]/.test(value) &&
      ["https:", "http:"].includes(u.protocol) &&
      !!u.hostname &&
      !u.username &&
      !u.password &&
      !u.href.includes("?") &&
      !u.href.includes("#") &&
      u.port !== "0" &&
      !/[\u0000-\u001f]/.test(path) &&
      !path
        .split("/")
        .some((s) =>
          /^(?:api|token|admin_token|access_token|api_key)(?:=|$)/i.test(s),
        )
      ? u
      : null;
  } catch {
    return null;
  }
}
function httpScope(u: URL): "loopback" | "lan" | "remote" {
  if (["localhost", "[::1]"].includes(u.hostname)) return "loopback";
  // URL parses and canonicalizes the host first; compare numeric octets, not prefixes.
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return "remote";
  const [a, b] = u.hostname.split(".").map(Number);
  if (a === 127) return "loopback";
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
    ? "lan"
    : "remote";
}
export function needsLanHttpConsent(value: string): boolean {
  const u = parsedEndpoint(value);
  return !!u && u.protocol === "http:" && httpScope(u) === "lan";
}
export function endpointContainsToken(value: string, token: string): boolean {
  const u = parsedEndpoint(value);
  return (
    !!u && !!token && decodeURIComponent(u.pathname).split("/").includes(token)
  );
}
export function validEndpoint(value: string, allowLanHttp = false): boolean {
  const u = parsedEndpoint(value);
  return (
    !!u &&
    (u.protocol === "https:" ||
      httpScope(u) === "loopback" ||
      (httpScope(u) === "lan" && allowLanHttp))
  );
}
export function normalizeSources(
  value: Partial<SourceSettings> | undefined,
): SourceSettings {
  const sources: DanmakuSource[] = [];
  const seen = new Set<string>();
  for (const raw of (Array.isArray(value?.sources)
    ? value.sources
    : sourceDefaults.sources
  ).slice(0, 12)) {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id) ||
      seen.has(raw.id)
    )
      continue;
    const builtIn = raw.id === "dandanplay";
    if (
      !builtIn &&
      (raw.protocol !== "logvar" ||
        typeof raw.endpoint !== "string" ||
        !validEndpoint(raw.endpoint, raw.allowLanHttp === true))
    )
      continue;
    seen.add(raw.id);
    sources.push({
      id: raw.id,
      name: builtIn
        ? "DandanPlay"
        : typeof raw.name === "string"
          ? raw.name.replace(/[\u0000-\u001f]/g, "").slice(0, 60) || "LogVar"
          : "LogVar",
      protocol: builtIn ? "dandanplay" : "logvar",
      endpoint: builtIn ? "" : raw.endpoint.replace(/\/+$/, ""),
      enabled: raw.enabled !== false,
      ...(!builtIn &&
      raw.allowLanHttp === true &&
      needsLanHttpConsent(raw.endpoint)
        ? { allowLanHttp: true }
        : {}),
      ...(!builtIn && raw.anonymous === true ? { anonymous: true } : {}),
      ...(!builtIn &&
      Number.isSafeInteger(raw.keyRevision) &&
      raw.keyRevision! > 0
        ? { keyRevision: raw.keyRevision }
        : {}),
      priority: Number.isFinite(raw.priority)
        ? Math.max(0, Math.min(99, Math.round(raw.priority)))
        : sources.length,
    });
  }
  if (!seen.has("dandanplay"))
    sources.unshift({ ...sourceDefaults.sources[0] });
  sources.splice(12);
  return {
    mode:
      value?.mode === "auto" || sources.some((s) => s.id === value?.mode)
        ? value!.mode!
        : "dandanplay",
    sources,
  };
}
export function orderedSources(config: SourceSettings) {
  return config.sources
    .filter(
      (s) => s.enabled && (config.mode === "auto" || config.mode === s.id),
    )
    .sort((a, b) => a.priority - b.priority);
}
