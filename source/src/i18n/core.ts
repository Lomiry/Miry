import { zhCN, type MessageKey } from "./zh-CN";
import { enUS } from "./en-US";

export type Language = "zh-CN" | "en-US";
export const languageKey = "miry-language";
export const languageEvent = "miry-language-changed";
export const catalogs = { "zh-CN": zhCN, "en-US": enUS };
export type Params = Record<string, string | number | null | undefined>;

export function normalizeLanguage(value: unknown): Language {
  return value === "en-US" ? "en-US" : "zh-CN";
}
export function readLanguage(): Language {
  try {
    return normalizeLanguage(localStorage.getItem(languageKey));
  } catch {
    return "zh-CN";
  }
}
let language = readLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setLanguage(value: unknown, persist = true) {
  const next = normalizeLanguage(value);
  if (persist) {
    try {
      localStorage.setItem(languageKey, next);
    } catch {
      /* Session preference still works. */
    }
  }
  if (next === language) return;
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(languageEvent));
}
export function initializeLanguage() {
  setLanguage(readLanguage(), false);
  document.documentElement.lang = language;
  const storage = (event: StorageEvent) => {
    if (event.key === languageKey || event.key === null)
      setLanguage(readLanguage(), false);
  };
  window.addEventListener("storage", storage);
  return () => window.removeEventListener("storage", storage);
}
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale = language,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}
export function formatDate(
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
  locale = language,
) {
  return new Intl.DateTimeFormat(locale, options).format(value);
}
export function formatMessage(
  text: string,
  params: Params = {},
  locale = language,
) {
  const plurals = text.replace(
    /\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/g,
    (_, name: string, one: string, other: string) =>
      new Intl.PluralRules(locale).select(Number(params[name])) === "one"
        ? one
        : other,
  );
  return plurals.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined || value === null
      ? placeholder
      : typeof value === "number"
        ? formatNumber(value, undefined, locale)
        : String(value);
  });
}
export function t(key: MessageKey, params?: Params, locale = language): string {
  return formatMessage(catalogs[locale][key] || zhCN[key], params, locale);
}

// Retranslate existing presentation messages after a language change. Call only
// for app-owned status/error/diagnostic text, never media names or user input.
const messagePatterns = Object.entries(catalogs).flatMap(([locale, catalog]) =>
  Object.entries(catalog)
    .filter(([, text]) => !text.includes(", plural,"))
    .map(([key, text]) => {
      const names: string[] = [];
      const escaped = text
        .split(/(\{\w+\})/g)
        .map((part) => {
          if (/^\{\w+\}$/.test(part)) {
            names.push(part.slice(1, -1));
            return "([\\s\\S]*?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return {
        key: key as MessageKey,
        locale,
        names,
        pattern: new RegExp("^" + escaped + "$"),
      };
    })
    .sort((a, b) => a.names.length - b.names.length),
);
export function isAppMessage(text: string): boolean {
  return messagePatterns.some((entry) => entry.pattern.test(text));
}
export function localizeMessage(text: string, depth = 0): string {
  if (!text) return text;
  if (depth > 3) return text;
  for (const entry of messagePatterns) {
    const match = entry.pattern.exec(text);
    if (!match) continue;
    const params = Object.fromEntries(
      entry.names.map((name, i) => [
        name,
        name === "detail"
          ? localizeMessage(match[i + 1], depth + 1)
          : match[i + 1],
      ]),
    );
    return t(entry.key, params);
  }
  return text;
}
