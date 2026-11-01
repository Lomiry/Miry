// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  catalogs,
  formatDate,
  formatMessage,
  formatNumber,
  getLanguage,
  initializeLanguage,
  languageKey,
  localizeMessage,
  readLanguage,
  setLanguage,
  t,
} from "./core";
import { useI18n } from "./react";
import { readSettings } from "../stores/settings";
import { displayError } from "../privacy";

beforeEach(() => {
  localStorage.clear();
  setLanguage("zh-CN", false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("zh-CN", false);
});
it("keeps absent errors absent and wraps unknown external errors without translating technical detail", () => {
  expect(displayError("")).toBe("");
  expect(displayError("ECONNRESET")).toBe("操作未完成。ECONNRESET");
  setLanguage("en-US");
  expect(displayError("ECONNRESET")).toBe(
    "The action could not be completed. ECONNRESET",
  );
  expect(displayError("未知提供方错误")).toBe(
    "The action could not be completed. 未知提供方错误",
  );
  expect(displayError("Added to favorites")).toBe("Added to favorites");
});

it("defaults existing users to Chinese and safely handles invalid or corrupt values", () => {
  expect(readLanguage()).toBe("zh-CN");
  for (const value of ["en", "null", "{", "ja-JP", '"en-US"']) {
    localStorage.setItem(languageKey, value);
    expect(readLanguage()).toBe("zh-CN");
  }
  setLanguage("unexpected");
  expect(getLanguage()).toBe("zh-CN");
});
it("switches both ways immediately without remounting subscribers", () => {
  const view = renderHook(() => ({
    language: useI18n(),
    title: t("library.home"),
  }));
  expect(view.result.current.title).toBe("首页");
  act(() => setLanguage("en-US"));
  expect(view.result.current).toEqual({ language: "en-US", title: "Home" });
  act(() => setLanguage("zh-CN"));
  expect(view.result.current.title).toBe("首页");
});
it("restores language on restart and sets the HTML accessibility language", () => {
  setLanguage("en-US");
  setLanguage("zh-CN", false);
  const dispose = initializeLanguage();
  expect(getLanguage()).toBe("en-US");
  expect(document.documentElement.lang).toBe("en-US");
  dispose();
});
it("falls back on unavailable storage while keeping an in-session choice usable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("unavailable");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("unavailable");
  });
  expect(readLanguage()).toBe("zh-CN");
  expect(() => setLanguage("en-US")).not.toThrow();
  expect(getLanguage()).toBe("en-US");
});
it("handles cross-WebView storage notifications without overwriting preferences", () => {
  const dispose = initializeLanguage();
  localStorage.setItem(languageKey, "en-US");
  window.dispatchEvent(new StorageEvent("storage", { key: "miry-settings" }));
  expect(getLanguage()).toBe("zh-CN");
  window.dispatchEvent(new StorageEvent("storage", { key: languageKey }));
  expect(getLanguage()).toBe("en-US");
  dispose();
  localStorage.setItem(languageKey, "zh-CN");
  window.dispatchEvent(new StorageEvent("storage", { key: languageKey }));
  expect(getLanguage()).toBe("en-US");
});
it("preserves old settings, speed schema2, appearance, routes, server and window keys exactly", () => {
  const saved = {
    "miry-settings": JSON.stringify({
      volume: 43,
      danmaku: { speed: 1.37, speedSchema: 2, opacity: 0.35 },
    }),
    "miry-appearance": '{"theme":"light","uiSize":"large"}',
    "miry-server": "https://emby.example.com",
    "miry-routes:fixture": "[]",
    "miry-window-state": '{"maximized":true}',
  };
  for (const [key, value] of Object.entries(saved))
    localStorage.setItem(key, value);
  const old = readSettings();
  const normalized = localStorage.getItem("miry-settings");
  setLanguage("en-US");
  setLanguage("zh-CN");
  expect(readSettings()).toEqual(old);
  expect(localStorage.getItem("miry-settings")).toBe(normalized);
  for (const [key, value] of Object.entries(saved).filter(
    ([key]) => key !== "miry-settings",
  ))
    expect(localStorage.getItem(key)).toBe(value);
});
it("formats singular, plural and zero quantities and keeps placeholders paired", () => {
  setLanguage("en-US");
  expect(t("library.items_count", { count: 1 })).toBe("1 item");
  expect(t("library.items_count", { count: 0 })).toBe("0 items");
  expect(t("library.favorites_count", { count: 2 })).toBe("2 favorites");
  expect(t("library.results_count_minimum", { count: 1234 })).toBe(
    "At least 1,234 results",
  );
  expect(
    formatMessage("{name}: {count}", { name: "$& {literal}", count: 5 }),
  ).toBe("$& {literal}: 5");
  setLanguage("zh-CN");
  expect(t("library.items_count", { count: 2 })).toBe("2 个内容");
});
it("formats dates, numbers and percentages using the current locale", () => {
  setLanguage("en-US");
  expect(formatNumber(1234.5)).toBe("1,234.5");
  expect(formatNumber(0.35, { style: "percent" })).toBe("35%");
  const date = Date.UTC(2026, 9, 12);
  expect(
    formatDate(date, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  ).toBe("October 12, 2026");
  setLanguage("zh-CN");
  expect(
    formatDate(date, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  ).toContain("2026年10月12日");
});
it("retranslates retained status and nested native errors while retaining technical codes", () => {
  setLanguage("en-US");
  expect(localizeMessage("已加入收藏")).toBe("Added to favorites");
  expect(
    displayError("直接播放失败：服务器拒绝播放，请检查权限 · HTTP 403"),
  ).toContain("Direct Play failed:");
  expect(displayError("主字幕和次字幕不能使用同一轨道")).toBe(
    "Primary and secondary subtitles cannot use the same track",
  );
  setLanguage("zh-CN");
  expect(localizeMessage("Added to favorites")).toBe("已加入收藏");
});
it("never changes interpolation values such as media names, URLs or subtitle text", () => {
  setLanguage("en-US");
  const title = "首页 · 第 1 季 · 字幕";
  expect(t("library.view_details_for", { p0: title })).toBe(
    `View details for ${title}`,
  );
  expect(title).toBe("首页 · 第 1 季 · 字幕");
  expect(localizeMessage("陌生影视标题与字幕正文")).toBe(
    "陌生影视标题与字幕正文",
  );
});
it("has bounded catalogs with corresponding non-empty entries", () => {
  expect(Object.keys(catalogs["en-US"])).toEqual(
    Object.keys(catalogs["zh-CN"]),
  );
  expect(Object.values(catalogs["en-US"]).every((value) => value.trim())).toBe(
    true,
  );
});
