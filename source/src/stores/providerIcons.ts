import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { isTauri } from "@tauri-apps/api/core";
import type { Account } from "../types/emby";

export const catalogUrl =
  "https://raw.githubusercontent.com/lige47/lige_icon/main/lige-emby-icon.json";
export interface ProviderIcon {
  name: string;
  url: string;
}
export interface IconPreference {
  provider: string;
  override: string;
}
const key = "miry-provider-icons",
  cacheKey = "miry-provider-icon-catalog";
const identity = (a: Account) => a.serverId || a.homeServer || a.server;
export function safeIconUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function adaptIconCatalog(value: unknown): ProviderIcon[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("icons" in value) ||
    !Array.isArray(value.icons)
  )
    return [];
  const result = new Map<string, ProviderIcon>();
  for (const icon of value.icons.slice(0, 2000)) {
    if (typeof icon?.name !== "string" || typeof icon?.url !== "string")
      continue;
    const name = icon.name.trim().slice(0, 100),
      url = safeIconUrl(icon.url);
    if (name && url) result.set(name, { name, url });
  }
  return [...result.values()];
}
function preferences(): Record<string, IconPreference> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}
export function readIconPreference(a: Account): IconPreference {
  const pref = preferences()[identity(a)];
  return {
    provider: typeof pref?.provider === "string" ? pref.provider : "",
    override: safeIconUrl(pref?.override || ""),
  };
}
export function saveIconPreference(a: Account, pref: IconPreference) {
  const all = preferences();
  delete all[identity(a)];
  all[identity(a)] = {
    provider: pref.provider.trim().slice(0, 100),
    override: safeIconUrl(pref.override),
  };
  localStorage.setItem(
    key,
    JSON.stringify(Object.fromEntries(Object.entries(all).slice(-100))),
  );
  window.dispatchEvent(new Event("miry-provider-icons"));
}
export function cachedIconCatalog(): ProviderIcon[] {
  try {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || "null");
    return Date.now() - cache.at >= 0 && Date.now() - cache.at < 864e5
      ? adaptIconCatalog(cache)
      : [];
  } catch {
    return [];
  }
}
export function matchProviderIcon(name: string, icons: ProviderIcon[]) {
  return icons.find(
    (icon) =>
      icon.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  )?.url;
}
const iconName = (name: string) =>
  name
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s_-]/g, "");
function uniqueIcon(names: string[], icons: ProviderIcon[], aliases = false) {
  const wanted = new Set(names.map(iconName).filter(Boolean));
  const matches = icons.filter((icon) => {
    const name = iconName(icon.name);
    // Catalog convention: the unnumbered '-emby' entry is the default variant.
    // Do not guess an alternate '(1)' image or use an arbitrary substring.
    return (
      wanted.has(name) ||
      (aliases &&
        !/\(\d+\)/.test(name) &&
        /emby$/.test(name) &&
        wanted.has(name.slice(0, -4)))
    );
  });
  return matches.length === 1 ? matches[0].url : undefined;
}
export function resolveProviderIconTrace(
  account: Account,
  icons: ProviderIcon[],
  pref = readIconPreference(account),
) {
  const result = (rule: string, url?: string) => ({
    rule,
    url,
    name: icons.find((i) => i.url === url)?.name,
  });
  if (pref.override) return result("manual", pref.override);
  if (pref.provider)
    return result(
      "provider",
      matchProviderIcon(pref.provider, icons) ||
        uniqueIcon([pref.provider], icons, true),
    );
  const names = [account.remark || "", account.serverName || ""].filter(
    (n) => !/^\d+$/.test(n.trim()) && iconName(n) !== "emby",
  );
  const domains: string[] = [];
  for (const address of [account.server, account.homeServer]) {
    try {
      const host = new URL(address || "").hostname;
      if (host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) continue;
      // DNS labels must match a complete provider name, never a prefix/lookalike.
      domains.push(...host.split(".").slice(0, -1));
    } catch {
      /* Invalid addresses cannot contribute an icon match. */
    }
  }
  const domain = uniqueIcon(domains, icons);
  if (domain) return result("domain", domain);
  const domainAlias = uniqueIcon(
    domains.map((n) => iconName(n).replace(/emby$/, "")),
    icons,
    true,
  );
  if (domainAlias) return result("domain", domainAlias);
  for (const name of names) {
    const direct = uniqueIcon([name], icons);
    if (direct) return result("name", direct);
  }
  // Explicit catalog aliases and the common 'OKEmby' presentation of 'Ok-emby'.
  const aliases = names.map((name) => iconName(name).replace(/emby$/, ""));
  const alias = uniqueIcon(aliases, icons, true);
  return result(alias ? "alias" : "default", alias);
}
export function resolveProviderIcon(
  account: Account,
  icons: ProviderIcon[],
  pref = readIconPreference(account),
) {
  return resolveProviderIconTrace(account, icons, pref).url;
}
let pending: Promise<ProviderIcon[]> | undefined;
let failedAt = 0;
export function loadIconCatalog(
  explicit = true,
  force = false,
): Promise<ProviderIcon[]> {
  const cache = cachedIconCatalog();
  if (cache.length && !force) return Promise.resolve(cache);
  if (pending) return pending;
  if (!explicit && failedAt && Date.now() - failedAt < 300000)
    return Promise.reject(Error("Catalog unavailable"));
  pending = (async () => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await (isTauri() ? nativeFetch : fetch)(catalogUrl, {
        signal: controller.signal,
        credentials: "omit",
        ...(isTauri() ? { maxRedirections: 0 } : {}),
      });
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > 512000
      )
        throw Error("Catalog unavailable");
      const text = await response.text();
      if (text.length > 512000) throw Error("Catalog too large");
      const icons = adaptIconCatalog(JSON.parse(text));
      if (!icons.length) throw Error("Invalid catalog");
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), icons }));
      window.dispatchEvent(new Event("miry-provider-icons"));
      failedAt = 0;
      return icons;
    } catch (error) {
      failedAt = Date.now();
      throw error;
    } finally {
      clearTimeout(timer);
      pending = undefined;
    }
  })();
  return pending;
}
