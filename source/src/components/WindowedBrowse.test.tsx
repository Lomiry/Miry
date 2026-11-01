// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import WindowedBrowse, { browseWindow } from "./WindowedBrowse";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("does not synchronously oscillate row geometry when scrolling reveals cards with different heights", () => {
  const root = document.createElement("main");
  Object.defineProperty(root, "clientHeight", { value: 500 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const id = Number(this.dataset.row || 0);
      return {
        top: this === root ? 0 : -5000,
        height: this.dataset.row ? (id % 2 === 0 ? 100 : 200) : 100,
      } as DOMRect;
    },
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    gridTemplateColumns: "100px",
    rowGap: "0px",
  } as CSSStyleDeclaration);
  const items = Array.from({ length: 500 }, (_, id) => ({
    Id: String(id),
    Name: String(id),
    Type: "Movie",
  }));
  expect(() =>
    render(
      <WindowedBrowse
        items={items}
        root={root}
        layout={false}
        render={(visible) => (
          <div className="grid">
            {visible.map((i) => (
              <button key={i.Id} data-row={i.Id}>
                {i.Name}
              </button>
            ))}
          </div>
        )}
      />,
    ),
  ).not.toThrow();
});
it("bounds rendered rows independently of a 100,000-item collection and preserves spacer geometry", () => {
  for (const top of [0, 5000, 3000000]) {
    const range = browseWindow(100000, 6, 350, top, 900);
    expect(range.end - range.start).toBeLessThanOrEqual(60);
    expect(
      range.before +
        Math.ceil((range.end - range.start) / 6) * 350 +
        range.after,
    ).toBe(Math.ceil(100000 / 6) * 350);
  }
});
it.each([120, 500, 1000, 5200])(
  "keeps %d items browseable with bounded mounted nodes at the start, middle and end",
  async (length) => {
    const root = document.createElement("main");
    Object.defineProperty(root, "clientHeight", { value: 600 });
    let top = 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return { top: this === root ? 0 : -top, height: 100 } as DOMRect;
      },
    );
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      gridTemplateColumns: "100px 100px 100px 100px",
      rowGap: "10px",
    } as CSSStyleDeclaration);
    const items = Array.from({ length }, (_, id) => ({
      Id: String(id),
      Name: String(id),
      Type: "Movie",
    }));
    const view = render(
      <WindowedBrowse
        items={items}
        root={root}
        layout={false}
        render={(visible) => (
          <div className="grid">
            {visible.map((i) => (
              <button key={i.Id}>{i.Name}</button>
            ))}
          </div>
        )}
      />,
    );
    for (const position of [
      0,
      Math.floor(length / 8) * 110,
      Math.max(0, Math.ceil(length / 4) * 110 - 600),
    ]) {
      top = position;
      act(() => root.dispatchEvent(new Event("scroll")));
      await waitFor(() =>
        expect(
          view.container.querySelectorAll("button").length,
        ).toBeLessThanOrEqual(52),
      );
    }
    await waitFor(() =>
      expect(view.container.textContent).toContain(String(length - 1)),
    );
  },
);
it("mounts only a viewport window and responds to scroll without extra requests", async () => {
  const root = document.createElement("main");
  Object.defineProperty(root, "clientHeight", { value: 500 });
  let top = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return { top: this === root ? 0 : -top, height: 100 } as DOMRect;
    },
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    gridTemplateColumns: "100px 100px 100px 100px",
    rowGap: "10px",
  } as CSSStyleDeclaration);
  const items = Array.from({ length: 10000 }, (_, id) => ({
    Id: String(id),
    Name: String(id),
    Type: "Movie",
  }));
  const view = render(
    <WindowedBrowse
      items={items}
      root={root}
      layout={false}
      render={(visible) => (
        <div className="grid">
          {visible.map((item) => (
            <button key={item.Id}>{item.Name}</button>
          ))}
        </div>
      )}
    />,
  );
  expect(view.container.querySelectorAll("button").length).toBeLessThan(60);
  top = 5000;
  act(() => {
    root.dispatchEvent(new Event("scroll"));
  });
  await waitFor(() =>
    expect(view.container.querySelector("button")?.textContent).not.toBe("0"),
  );
  expect(view.container.querySelectorAll("button").length).toBeLessThan(60);
});
