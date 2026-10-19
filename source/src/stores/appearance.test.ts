// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  initializeAppearance,
  readAppearance,
  saveAppearance,
} from "./appearance";
let dispose: (() => void) | undefined;
let dark: MediaQueryList, narrow: MediaQueryList;
function media(matches = false) {
  return Object.assign(new EventTarget(), {
    matches,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: EventTarget.prototype.dispatchEvent,
  }) as unknown as MediaQueryList;
}
beforeEach(() => {
  localStorage.clear();
  dark = media(true);
  narrow = media(false);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => (query.includes("color-scheme") ? dark : narrow)),
  );
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  for (const key of ["theme", "uiSize", "sidebar"])
    delete document.documentElement.dataset[key];
});
it("keeps existing users dark and validates persisted values", () => {
  expect(readAppearance()).toEqual({
    theme: "dark",
    uiSize: "standard",
    sidebarCollapsed: null,
  });
  localStorage.setItem("miry-appearance", "null");
  expect(readAppearance().theme).toBe("dark");
  localStorage.setItem(
    "miry-appearance",
    JSON.stringify({ theme: "invalid", uiSize: 123, sidebarCollapsed: "yes" }),
  );
  expect(readAppearance()).toEqual({
    theme: "dark",
    uiSize: "standard",
    sidebarCollapsed: null,
  });
});
it("updates dark/light/system at the root and follows OS changes only in system mode", () => {
  dispose = initializeAppearance();
  const root = document.documentElement;
  saveAppearance({ theme: "light" });
  expect(root.dataset.theme).toBe("light");
  dark.dispatchEvent(new Event("change"));
  expect(root.dataset.theme).toBe("light");
  saveAppearance({ theme: "system" });
  expect(root.dataset.theme).toBe("dark");
  Object.assign(dark, { matches: false });
  dark.dispatchEvent(new Event("change"));
  expect(root.dataset.theme).toBe("light");
  Object.assign(dark, { matches: true });
  dark.dispatchEvent(new Event("change"));
  expect(root.dataset.theme).toBe("dark");
  expect(readAppearance().theme).toBe("system");
});
it.each(["standard", "larger", "large"] as const)(
  "persists %s size without replacing existing content",
  (uiSize) => {
    dispose = initializeAppearance();
    const child = document.createElement("main");
    document.body.append(child);
    saveAppearance({ uiSize });
    expect(readAppearance().uiSize).toBe(uiSize);
    expect(document.documentElement.dataset.uiSize).toBe(uiSize);
    expect(document.body.lastChild).toBe(child);
    child.remove();
  },
);
it("lets manual sidebar choice override narrow-window rules", () => {
  Object.assign(narrow, { matches: true });
  dispose = initializeAppearance();
  expect(document.documentElement.dataset.sidebar).toBe("collapsed");
  saveAppearance({ sidebarCollapsed: false });
  narrow.dispatchEvent(new Event("change"));
  expect(document.documentElement.dataset.sidebar).toBe("expanded");
});
it("synchronizes other WebViews and releases preference/media listeners", () => {
  dispose = initializeAppearance();
  localStorage.setItem("miry-appearance", JSON.stringify({ theme: "light" }));
  window.dispatchEvent(new StorageEvent("storage", { key: "miry-appearance" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  dispose();
  dispose = undefined;
  saveAppearance({ theme: "dark" });
  expect(document.documentElement.dataset.theme).toBe("light");
});
