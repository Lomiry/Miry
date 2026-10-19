// @vitest-environment jsdom
import { it, expect } from "vitest";
import {
  defaultShortcuts,
  normalizeShortcuts,
  shortcutAction,
  keyCode,
  normalizeKey,
  blockedShortcut,
  isEditableTarget,
} from "./shortcuts";
it("protects all editing keys, nested contenteditable and forwarded body events", () => {
  for (const markup of [
    "<input />",
    "<textarea></textarea>",
    '<div contenteditable=""><span>edit</span></div>',
  ]) {
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    const target = container.querySelector("span,input,textarea")!;
    expect(isEditableTarget(target)).toBe(true);
    for (const key of [
      " ",
      "1",
      "f",
      "h",
      "Enter",
      "Backspace",
      "ArrowLeft",
      "ArrowRight",
      "a",
      "c",
      "v",
    ]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        ctrlKey: ["a", "c", "v"].includes(key),
      });
      target.dispatchEvent(event);
      expect(blockedShortcut(event)).toBe(true);
    }
    container.remove();
  }
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  expect(blockedShortcut(new KeyboardEvent("keydown", { key: " " }))).toBe(
    true,
  );
  input.remove();
  expect(
    blockedShortcut(
      new KeyboardEvent("keydown", { key: "f", isComposing: true }),
    ),
  ).toBe(true);
});
it("supports all requested actions and custom keys, retaining empty bindings", () => {
  const keys = normalizeShortcuts({
    ...defaultShortcuts,
    pause: "KeyZ",
    mute: "",
  });
  expect(
    shortcutAction(new KeyboardEvent("keydown", { code: "KeyZ" }), keys),
  ).toBe("pause");
  expect(
    shortcutAction(new KeyboardEvent("keydown", { code: "KeyM" }), keys),
  ).toBeUndefined();
  expect(shortcutAction(new KeyboardEvent("keydown", { key: "s" }))).toBe(
    "subtitle",
  );
});
it.each([
  ["KeyK", { ctrlKey: true }, "Ctrl+KeyK"],
  ["KeyS", { ctrlKey: true, shiftKey: true }, "Ctrl+Shift+KeyS"],
  ["Enter", { altKey: true }, "Alt+Enter"],
  ["ArrowLeft", { shiftKey: true }, "Shift+ArrowLeft"],
  ["KeyP", { ctrlKey: true, altKey: true }, "Ctrl+Alt+KeyP"],
])("captures and dispatches %s chord", (code, flags, chord) => {
  const event = new KeyboardEvent("keydown", { code, ...flags });
  expect(keyCode(event)).toBe(chord);
  const bindings = normalizeShortcuts({ ...defaultShortcuts, pause: chord });
  expect(shortcutAction(event, bindings)).toBe("pause");
  expect(normalizeShortcuts(bindings)).toEqual(bindings);
});
it("normalizes modifier order and rejects system shortcuts", () => {
  expect(normalizeKey("Shift+Control+S")).toBe("Ctrl+Shift+KeyS");
  for (const key of [
    "Alt+F4",
    "Ctrl+Alt+Delete",
    "Meta+KeyK",
    "Ctrl+Ctrl+KeyK",
    "Shift",
  ])
    expect(normalizeKey(key)).toBe("");
});
it("rejects duplicate and reserved keys", () => {
  expect(normalizeShortcuts({ ...defaultShortcuts, pause: "KeyF" })).toEqual(
    defaultShortcuts,
  );
  expect(normalizeShortcuts({ pause: "KeyH" }).pause).toBe("Space");
});
it("ignores repeat and modifier keys and guarded UI targets", () => {
  expect(
    shortcutAction(
      new KeyboardEvent("keydown", { code: "Space", repeat: true }),
    ),
  ).toBeUndefined();
  expect(
    shortcutAction(
      new KeyboardEvent("keydown", { code: "KeyF", ctrlKey: true }),
    ),
  ).toBeUndefined();
  for (const tag of ["input", "select", "textarea"]) {
    const t = document.createElement(tag),
      e = new KeyboardEvent("keydown", { code: "Space" });
    t.dispatchEvent(e);
    expect(shortcutAction(e)).toBeUndefined();
  }
  const button = document.createElement("button"),
    space = new KeyboardEvent("keydown", { code: "Space" }),
    f = new KeyboardEvent("keydown", { code: "KeyF" });
  button.dispatchEvent(space);
  button.dispatchEvent(f);
  expect(shortcutAction(space)).toBeUndefined();
  expect(shortcutAction(f)).toBe("fullscreen");
});
