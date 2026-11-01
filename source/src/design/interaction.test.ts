// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
const { readFileSync } = await vi.importActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

const shared = readFileSync("src/design/interaction.css", "utf8");
afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

it.each(["hover", "active", "focus-visible"])(
  "scopes shared %s feedback to the current target across controls and themes",
  (state) => {
    const style = document.createElement("style");
    style.textContent = shared;
    document.head.append(style);
    for (const theme of ["light", "dark"]) {
      document.documentElement.dataset.theme = theme;
      document.body.innerHTML = `<div class="player-chrome"><div class="player-setting-row"><span id="label">画面模式</span><button role="combobox" id="fit">适应</button><button id="other">字幕</button></div></div><div class="view-switch"><button id="segment">Grid</button></div><button id="home">Play</button><button role="menuitem" id="menu">Item</button><button disabled id="disabled">Disabled</button>`;
      const selectors = Array.from(style.sheet!.cssRules)
        .filter(
          (rule): rule is CSSStyleRule =>
            "selectorText" in rule &&
            (rule as CSSStyleRule).selectorText.includes(`:${state}`),
        )
        .map((rule) =>
          rule.selectorText.replaceAll(`:${state}`, ".fixture-target"),
        );
      for (const id of [
        "fit",
        "other",
        "segment",
        "home",
        "menu",
        "label",
        "disabled",
      ]) {
        const target = document.getElementById(id)!;
        target.classList.add("fixture-target");
        const matches = selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector)),
        );
        expect(matches).toEqual(
          id === "label" || id === "disabled" ? [] : [target],
        );
        target.classList.remove("fixture-target");
      }
    }
    delete document.documentElement.dataset.theme;
  },
);

it("rounds the whole home browsing surface, keeps one bottom gutter and avoids legacy shelf gaps", () => {
  document.body.innerHTML =
    '<div class="shell"><aside class="sidebar"></aside><main class="browse-main route-home"><header class="topbar"></header><div class="content"><div class="home-view"><section class="media-shelf"></section></div></div></main></div>';
  const style = document.createElement("style");
  style.textContent =
    ".content section { margin-bottom: 34px }" +
    readFileSync("src/design/layout.css", "utf8");
  document.head.append(style);
  expect(
    getComputedStyle(document.querySelector(".browse-main")!)
      .borderStartStartRadius,
  ).toBe("var(--space-6)");
  expect(
    getComputedStyle(document.querySelector(".browse-main")!)
      .borderEndStartRadius,
  ).toBe("var(--space-6)");
  // jsdom cannot resolve var() padding shorthands with browser specificity.
  // Check the scoped declaration; physical scroll/layout remains manual QA.
  const bottom = Array.from(style.sheet!.cssRules).find(
    (rule) =>
      "selectorText" in rule &&
      (rule as CSSStyleRule).selectorText === ".route-home > .content",
  ) as CSSStyleRule;
  expect(bottom.style.getPropertyValue("padding-bottom")).toBe(
    "var(--space-8)",
  );
  expect(
    getComputedStyle(document.querySelector(".home-view")!).paddingBottom,
  ).toBe("0px");
  expect(
    getComputedStyle(document.querySelector(".media-shelf")!).marginBottom,
  ).toBe("0px");
});
