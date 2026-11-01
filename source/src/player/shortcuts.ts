import { t } from "../i18n/core";
export const defaultShortcuts = {
  pause: "Space",
  backward: "ArrowLeft",
  forward: "ArrowRight",
  fullscreen: "KeyF",
  mute: "KeyM",
  subtitle: "KeyS",
  audio: "KeyA",
  next: "KeyN",
  previous: "KeyP",
};
export type ShortcutAction = keyof typeof defaultShortcuts;
export type Shortcuts = Record<ShortcutAction, string>;
export const shortcutLabels: Record<ShortcutAction, string> = {
  get pause() {
    return t("player.play_pause");
  },
  get backward() {
    return t("player.rewind_10_seconds");
  },
  get forward() {
    return t("player.forward_10_seconds");
  },
  get fullscreen() {
    return t("danmaku.fullscreen");
  },
  get mute() {
    return t("player.mute");
  },
  get subtitle() {
    return t("player.subtitle_menu");
  },
  get audio() {
    return t("player.audio_menu");
  },
  get next() {
    return t("library.next_episode");
  },
  get previous() {
    return t("player.previous_episode");
  },
};
export function validKey(code: string) {
  return !!normalizeKey(code);
}
export function normalizeKey(value: string): string {
  const parts = value.split("+");
  let code = parts.pop() || "";
  if (/^[a-z]$/i.test(code)) code = `Key${code.toUpperCase()}`;
  if (/^[0-9]$/.test(code)) code = `Digit${code}`;
  const modifiers = new Set(parts.map((p) => (p === "Control" ? "Ctrl" : p)));
  if (
    parts.length !== modifiers.size ||
    [...modifiers].some((p) => !["Ctrl", "Alt", "Shift"].includes(p))
  )
    return "";
  const normalized = [
    ...["Ctrl", "Alt", "Shift"].filter((p) => modifiers.has(p)),
    code,
  ].join("+");
  if (
    !/^(Space|Enter|Tab|Escape|Backspace|Delete|Home|End|PageUp|PageDown|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|F(?:[1-9]|1[0-2])|Key[A-Z]|Digit[0-9])$/.test(
      code,
    )
  )
    return "";
  if (
    normalized === "KeyH" ||
    normalized === "Alt+F4" ||
    normalized === "Ctrl+Alt+Delete"
  )
    return "";
  return normalized;
}
export function keyCode(
  event: Pick<KeyboardEvent, "key" | "code"> &
    Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">>,
) {
  const code =
    event.code ||
    (event.key === " "
      ? "Space"
      : /^[a-z]$/i.test(event.key)
        ? `Key${event.key.toUpperCase()}`
        : event.key);
  return [
    event.ctrlKey && "Ctrl",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    event.metaKey && "Meta",
    code,
  ]
    .filter(Boolean)
    .join("+");
}
export function normalizeShortcuts(raw: unknown): Shortcuts {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = { ...defaultShortcuts };
  for (const action of Object.keys(result) as ShortcutAction[]) {
    const code = value[action];
    if (typeof code === "string" && (code === "" || validKey(code)))
      result[action] = normalizeKey(code);
  }
  const keys = Object.values(result).filter(Boolean);
  return new Set(keys).size === keys.length ? result : { ...defaultShortcuts };
}
export function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
    )
  );
}
export function isComposingKey(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">,
) {
  return event.isComposing || event.keyCode === 229;
}
export function shouldIgnorePlayerShortcut(event: KeyboardEvent) {
  return (
    isComposingKey(event) ||
    isEditableTarget(event.target) ||
    isEditableTarget(document.activeElement)
  );
}
export function blockedShortcut(event: KeyboardEvent) {
  return (
    shouldIgnorePlayerShortcut(event) ||
    event.defaultPrevented ||
    event.repeat ||
    event.metaKey ||
    ["Alt", "Control", "Shift", "Meta"].includes(event.key) ||
    ["Alt+F4", "Ctrl+Alt+Delete"].includes(keyCode(event)) ||
    (event.target instanceof Element &&
      !!event.target.closest(
        "[role=slider],[role=menu],[role=dialog],[data-ui-overlay]",
      )) ||
    (keyCode(event) === "Space" &&
      event.target instanceof Element &&
      !!event.target.closest("button"))
  );
}
export function shortcutAction(event: KeyboardEvent, shortcuts?: Shortcuts) {
  if (blockedShortcut(event)) return;
  const code = keyCode(event);
  return (Object.keys(defaultShortcuts) as ShortcutAction[]).find(
    (action) => (shortcuts || defaultShortcuts)[action] === code,
  );
}
