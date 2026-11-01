// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
const fs = await vi.importActual<{
  readFileSync(p: string, encoding: "utf8"): string;
}>("node:fs");
const css = (name: string) => fs.readFileSync(`src/design/${name}.css`, "utf8");
afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.remove("player-ui-document");
});
function sheet(text: string) {
  const style = document.createElement("style");
  style.textContent = text;
  document.head.append(style);
  return style.sheet!;
}
it("scopes thin themed scrollbars to panels and avoids a nested player candidate scroller", async () => {
  const fs = await vi.importActual<{
    readFileSync(p: string, encoding: "utf8"): string;
  }>("node:fs");
  const style = document.createElement("style");
  style.textContent = fs.readFileSync("src/design/polish.css", "utf8");
  document.head.append(style);
  const host = document.createElement("section");
  host.innerHTML =
    '<main></main><div class="settings-body"></div><div class="ui-popover"></div><div class="player-danmaku-popover"><div class="player-popover-scroll"><div class="online-danmaku-candidates"></div></div></div>';
  document.body.append(host);
  try {
    for (const panel of host.querySelectorAll(
      ".settings-body,.ui-popover,.player-popover-scroll",
    )) {
      expect(getComputedStyle(panel).scrollbarWidth).toBe("thin");
      expect(getComputedStyle(panel).scrollbarColor).toContain(
        "--scrollbar-thumb",
      );
    }
    expect(
      getComputedStyle(host.querySelector("main")!).scrollbarWidth,
    ).not.toBe("thin");
    expect(
      getComputedStyle(host.querySelector(".online-danmaku-candidates")!)
        .overflow,
    ).toBe("visible");
  } finally {
    host.remove();
    style.remove();
  }
});

it("uses exactly one scrollbar renderer in WebView2 without a later equal-specificity override", () => {
  const rules = Array.from(sheet(css("polish")).cssRules);
  const support = rules.find(
    (rule) =>
      "conditionText" in rule &&
      (rule as CSSSupportsRule).conditionText ===
        "selector(::-webkit-scrollbar)",
  ) as CSSSupportsRule;
  expect(support).toBeTruthy();
  const override = Array.from(support.cssRules).find(
    (rule) =>
      "style" in rule &&
      (rule as CSSStyleRule).style.getPropertyValue("scrollbar-width"),
  ) as CSSStyleRule;
  expect(override.style.getPropertyValue("scrollbar-width")).toBe("auto");
  expect(override.style.getPropertyValue("scrollbar-color")).toBe("auto");
  for (const selector of [
    ".player-popover-scroll",
    ".online-danmaku-candidates",
    ".settings-body",
    ".ui-popover",
  ])
    expect(override.selectorText).toContain(selector);
  // desktop.css loads after polish.css. Its generic page rule must not undo
  // the panel's auto reset, which enables Chromium's WebKit pseudo-elements.
  for (const rule of Array.from(sheet(css("desktop")).cssRules)) {
    if (
      !("style" in rule) ||
      !(rule as CSSStyleRule).style.getPropertyValue("scrollbar-color")
    )
      continue;
    const selectors = (rule as CSSStyleRule).selectorText
      .split(",")
      .map((x) => x.trim());
    expect(selectors).not.toContain(".player-popover-scroll");
    expect(selectors).not.toContain(".ui-popover");
    expect(selectors).not.toContain(".settings-body");
  }
});

it("uses 6px rounded thumbs, transparent tracks/corners and no native arrow buttons", () => {
  const support = Array.from(sheet(css("polish")).cssRules).find(
    (rule) =>
      "conditionText" in rule &&
      (rule as CSSSupportsRule).conditionText ===
        "selector(::-webkit-scrollbar)",
  ) as CSSSupportsRule;
  const ruleFor = (suffix: string) =>
    (
      Array.from(support.cssRules).find(
        (rule) =>
          "selectorText" in rule &&
          (rule as CSSStyleRule).selectorText.endsWith(suffix),
      ) as CSSStyleRule
    ).style;
  expect(ruleFor("::-webkit-scrollbar").getPropertyValue("width")).toBe("6px");
  expect(ruleFor("::-webkit-scrollbar").getPropertyValue("height")).toBe("6px");
  expect(
    ruleFor("::-webkit-scrollbar-track").getPropertyValue("background"),
  ).toBe("var(--scrollbar-track)");
  expect(
    ruleFor("::-webkit-scrollbar-track").getPropertyValue("margin-block"),
  ).toBe("var(--space-1)");
  expect(
    ruleFor("::-webkit-scrollbar-thumb").getPropertyValue("background"),
  ).toBe("var(--scrollbar-thumb)");
  expect(
    ruleFor("::-webkit-scrollbar-thumb").getPropertyValue("border-radius"),
  ).toBe("var(--radius-sm)");
  expect(
    ruleFor("::-webkit-scrollbar-thumb:hover").getPropertyValue("background"),
  ).toBe("var(--scrollbar-thumb-hover)");
  expect(
    ruleFor("::-webkit-scrollbar-button").getPropertyValue("display"),
  ).toBe("none");
  expect(
    parseFloat(
      ruleFor("::-webkit-scrollbar-button").getPropertyValue("height"),
    ),
  ).toBe(0);
  expect(
    ruleFor("::-webkit-scrollbar-corner").getPropertyValue("background"),
  ).toBe("transparent");
});

it.each(["light", "dark"])(
  "keeps transparent panel tracks and correct local colors when the app theme is %s",
  (theme) => {
    document.documentElement.dataset.theme = theme;
    sheet(css("tokens") + css("polish") + css("desktop"));
    document.body.innerHTML =
      '<div class="ui-popover"></div><div class="player-chrome"><div class="player-popover"><div class="player-popover-scroll"></div></div></div>';
    const root = getComputedStyle(document.documentElement);
    expect(root.getPropertyValue("--scrollbar-thumb").trim()).toBe(
      theme === "light" ? "#98a39d80" : "#89958e55",
    );
    const player = getComputedStyle(document.querySelector(".player-popover")!);
    expect(player.colorScheme).toBe("dark");
    expect(player.getPropertyValue("--scrollbar-track").trim()).toBe(
      "transparent",
    );
    expect(player.getPropertyValue("--scrollbar-thumb").trim()).toBe(
      "#89958e55",
    );
    expect(player.getPropertyValue("--scrollbar-thumb-hover").trim()).toBe(
      "#a6b2ab88",
    );
    expect(
      getComputedStyle(document.querySelector(".ui-popover")!)
        .getPropertyValue("--scrollbar-track")
        .trim(),
    ).toBe("transparent");
  },
);

it("keeps the original scroll owner inside clipped rounded panels, with inset space and no nested candidate scroller", () => {
  sheet(css("player") + css("polish") + css("desktop"));
  document.body.innerHTML =
    '<div class="player-chrome"><div class="player-popover player-danmaku-popover"><header></header><div class="player-popover-scroll"><div class="online-danmaku-candidates"><button>Last candidate</button></div></div></div></div>';
  const panel = document.querySelector(".player-popover")!;
  const scroller = document.querySelector(".player-popover-scroll")!;
  const candidate = document.querySelector(".online-danmaku-candidates")!;
  expect(getComputedStyle(panel).overflow).toBe("hidden");
  expect(getComputedStyle(panel).borderRadius).toBe("12px");
  expect(getComputedStyle(scroller).overflow).toBe("auto");
  expect(parseFloat(getComputedStyle(scroller).minHeight)).toBe(0);
  expect(getComputedStyle(scroller).marginRight).toBe("4px");
  expect(getComputedStyle(scroller).marginBottom).toBe("4px");
  expect(getComputedStyle(scroller).overscrollBehavior).toBe("contain");
  expect(getComputedStyle(candidate).overflow).toBe("visible");
  expect(getComputedStyle(candidate).maxHeight).toBe("none");
  expect(scroller.querySelector("button")?.textContent).toBe("Last candidate");
});
