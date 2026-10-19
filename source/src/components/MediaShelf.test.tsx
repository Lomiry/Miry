// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MediaShelf from "./MediaShelf";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("supports paging by keyboard and arrows, updates end controls and leaves child keys alone", () => {
  let callback: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  render(
    <MediaShelf title="最近加入">
      <button>影片</button>
    </MediaShelf>,
  );
  const rail = screen.getByRole("group", { name: "最近加入内容" });
  Object.defineProperties(rail, {
    clientWidth: { value: 400 },
    scrollWidth: { value: 1200 },
  });
  const scrollBy = vi.fn(),
    scrollTo = vi.fn();
  rail.scrollBy = scrollBy;
  rail.scrollTo = scrollTo;
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  fireEvent.scroll(rail);
  expect(
    screen.getByRole("button", { name: "最近加入向左滚动" }),
  ).toHaveProperty("disabled", true);
  fireEvent.keyDown(rail, { key: "ArrowRight" });
  expect(scrollBy).toHaveBeenCalledWith({ left: 340, behavior: "instant" });
  fireEvent.keyDown(screen.getByRole("button", { name: "影片" }), {
    key: "ArrowRight",
  });
  expect(scrollBy).toHaveBeenCalledTimes(1);
  rail.scrollLeft = 800;
  fireEvent.scroll(rail);
  expect(
    screen.getByRole("button", { name: "最近加入向右滚动" }),
  ).toHaveProperty("disabled", true);
  fireEvent.keyDown(rail, { key: "Home" });
  expect(scrollTo).toHaveBeenCalledWith({ left: 0 });
  callback();
});
it("releases size observers when leaving a page", () => {
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  const view = render(
    <MediaShelf title="电影">
      <button>影片</button>
    </MediaShelf>,
  );
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
