export type NetworkCategory =
  | "permission"
  | "dns"
  | "tcp"
  | "tls"
  | "timeout"
  | "cancelled"
  | "http"
  | "format"
  | "network";
export interface NetworkDiagnostic {
  time: string;
  stage: string;
  method: string;
  url: string;
  backend: string;
  status?: number;
  redirected?: boolean;
  redirectStatuses?: number[];
  contentType?: string;
  bodyPreview?: string;
  elapsedMs: number;
  category?: NetworkCategory;
  underlying?: string;
  itemId?: string;
  mediaSourceId?: string;
  playMethod?: string;
}
const records: NetworkDiagnostic[] = [];
export function redactNetworkDetail(value: unknown, secrets: string[] = []) {
  let text =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : String(value ?? "");
  text = text
    .replace(/https?:\/\/[^\s<>"')]+/gi, "[URL]")
    .replace(
      /(?:X-Emby-Token|Authorization|Cookie|Set-Cookie)\s*[:=][^\r\n]*/gi,
      "[credential header omitted]",
    )
    .replace(
      /(["']?(?:password|pw|access_token|accesstoken|api_key|token)["']?\s*[:=]\s*)[^,}\r\n]+/gi,
      "$1[redacted]",
    );
  for (const secret of secrets.filter(Boolean))
    text = text.split(secret).join("[redacted]");
  return text.slice(0, 1200);
}
export function networkCategory(error: unknown): NetworkCategory {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/not allowed|url.*denied|permission|scope/i.test(text))
    return "permission";
  if (/timeout|timed out|超时/i.test(text)) return "timeout";
  if (/dns|resolve|lookup|hostname.*(not|fail)|11001|11004/i.test(text))
    return "dns";
  if (/tls|ssl|certificate|certificat|renegoti|证书/i.test(text)) return "tls";
  if (/refused|reset|unreachable|connect.*fail|10061|10060/i.test(text))
    return "tcp";
  return "network";
}
export function diagnosticUrl(url: URL, path: string) {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    if (
      [
        "Users",
        "Items",
        "Shows",
        "Playlists",
        "Videos",
        "FavoriteItems",
        "PlayedItems",
      ].includes(parts[i - 1]) &&
      !["AuthenticateByName", "Resume", "Latest", "Public"].includes(parts[i])
    )
      parts[i] = "{id}";
  }
  const endpoint =
    /^\/(?:System|Users|Items|Shows|Playlists|Sessions|Genres|Videos)(?:\/|$)/.test(
      path,
    )
      ? parts.join("/")
      : "/{endpoint}";
  return `${url.protocol}//[server]${url.port ? `:${url.port}` : ""}${endpoint}`;
}
export function responsePreview(text: string, parsed?: unknown) {
  try {
    const json = (parsed === undefined ? JSON.parse(text) : parsed) as any;
    if (Array.isArray(json)) return `JSON array (${json.length} entries)`;
    if (!json || typeof json !== "object") return `JSON ${typeof json}`;
    const safe: Record<string, string | number> = {};
    for (const key of [
      "Id",
      "ServerName",
      "Version",
      "User",
      "AccessToken",
      "Items",
      "TotalRecordCount",
      "ErrorCode",
      "Message",
    ]) {
      if (!(key in json)) continue;
      safe[key] =
        key === "AccessToken"
          ? "[redacted]"
          : Array.isArray(json[key])
            ? `array(${json[key].length})`
            : key === "TotalRecordCount" && Number.isFinite(json[key])
              ? json[key]
              : typeof json[key];
    }
    return JSON.stringify(safe).slice(0, 300);
  } catch {
    return `Non-JSON response (${text.length} characters; content omitted)`;
  }
}
export function recordNetwork(diagnostic: Omit<NetworkDiagnostic, "time">) {
  const entry = { ...diagnostic, time: new Date().toISOString() };
  records.push(entry);
  if (records.length > 80) records.splice(0, records.length - 80);
  if (
    import.meta.env.DEV &&
    import.meta.env.MODE !== "test" &&
    diagnostic.category
  )
    console.debug("[Miry network]", entry);
}
export function readNetworkDiagnostics() {
  return records.map((record) => ({ ...record }));
}
export function clearNetworkDiagnostics() {
  records.length = 0;
}
