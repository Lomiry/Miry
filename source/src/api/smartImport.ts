import { normalizeServer } from "./client";

export interface ImportCandidate {
  address: string;
  username: string;
  password: string;
}
/** Pure parsing: no requests, persistence, logging or inferred server identities. */
export function parseConnectionText(text: string): ImportCandidate[] {
  const input = text.slice(0, 32000);
  const field = (
    labels: string,
    suffix = /(?:是|为)?/.source,
    separator = /[:：=]/.source,
  ) => {
    const values = [
      ...input.matchAll(
        new RegExp(
          `(?:^|\\n)[^\\S\\r\\n]*(?:${labels})${suffix}[^\\S\\r\\n]*${separator}[^\\S\\r\\n]*([^\\r\\n]+)`,
          "gi",
        ),
      ),
    ].map((match) => match[1].trim());
    // Repeated or conflicting credentials cannot safely be assigned to URLs.
    return values.length === 1 &&
      !/(?:用户名|密码|username|password|server|地址)\s*[:：=]/i.test(values[0])
      ? values[0]
      : "";
  };
  const username = field("用户名|用户名称|username|user"),
    password = field("密码|password|passwd|pass");
  const explicit =
    input.match(/https?:\/\/[^\s<>「」【】\u3000-\u303f\u4e00-\u9fff]+/gi) ||
    [];
  // Bare hosts require a labelled address field or a standalone line. Never
  // turn arbitrary words or account names in prose into a server address.
  const bare = [
    ...input.matchAll(
      /(?:^|\n)\s*(?:(?:服务器地址|地址|线路|服务器|server|url|https?|address)(?:是|为)?\s*[:：]\s*)?((?:\[[0-9a-f:]+\]|(?:[a-z0-9-]+\.)+[a-z0-9-]+)(?::\d{1,5})?(?:\/[^\s<>]*)?)\s*(?=\r?$)/gim,
    ),
  ].map((m) => m[1]);
  const urls = new Set<string>();
  // Port sentences can omit punctuation after 是/为. Credential labels stay strict.
  const port = field(
      "端口|port",
      /号?(?:是|为)?/.source,
      /(?:[:：=]|(?<=[是为]))/.source,
    ),
    prefix = field("路径前缀|路径|path"),
    protocol = field("协议|protocol");
  const parsed = new Map<string, { url: URL; hasPort: boolean }>();
  for (const raw of [...explicit, ...bare]) {
    try {
      const value = raw.replace(/[),.;!，。；！]+$/, "");
      // Protocol omitted: offer HTTPS for review; user can edit before login.
      const url = new URL(
        /^https?:\/\//i.test(value)
          ? value
          : `${protocol.toLowerCase() === "http" ? "http" : "https"}://${value}`,
      );
      const address = normalizeServer(url.href);
      const hasPort =
        /^(?:https?:\/\/)?(?:\[[^\]]+\]|[^/:]+):\d+(?:\/|$)/i.test(value);
      parsed.set(address, {
        url,
        hasPort: hasPort || !!parsed.get(address)?.hasPort,
      });
    } catch {
      /* Invalid links stay out of the preview. */
    }
    if (parsed.size >= 20) break;
  }
  for (const { url, hasPort } of parsed.values()) {
    // Apply shared metadata only to one unambiguous endpoint, after deduplication.
    if (parsed.size === 1) {
      if (port && !hasPort) {
        if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535) continue;
        url.port = port;
      }
      if (prefix.startsWith("/") && url.pathname === "/") url.pathname = prefix;
    }
    urls.add(normalizeServer(url.href));
  }
  // Multiple endpoints may be unrelated. Require explicit per-candidate entry
  // of credentials instead of silently sharing a password across servers.
  return [...urls].map((address) => ({
    address,
    username: urls.size === 1 ? username : "",
    password: urls.size === 1 ? password : "",
  }));
}
