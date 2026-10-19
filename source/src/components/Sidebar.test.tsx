// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";
import { readAppearance } from "../stores/appearance";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("collapses/expands rapidly, persists selection and preserves children", () => {
  const view = render(
    <Sidebar>
      <button className="nav">
        <span>首页</span>
      </button>
    </Sidebar>,
  );
  const child = screen.getByRole("button", { name: "首页" });
  for (let i = 0; i < 21; i++)
    fireEvent.click(
      screen.getByRole("button", { name: i % 2 ? "展开侧边栏" : "收起侧边栏" }),
    );
  expect(readAppearance().sidebarCollapsed).toBe(true);
  expect(screen.getByRole("button", { name: "首页" })).toBe(child);
  view.unmount();
  render(
    <Sidebar>
      <button className="nav">
        <span>首页</span>
      </button>
    </Sidebar>,
  );
  expect(screen.getByRole("button", { name: "展开侧边栏" })).toBeTruthy();
});
it("retains navigation actions and supplies rail hover/focus tooltips", () => {
  const go = vi.fn();
  render(
    <Sidebar>
      <button className="nav" onClick={go}>
        <span>家庭电影</span>
      </button>
    </Sidebar>,
  );
  fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
  const nav = screen.getByRole("button", { name: "家庭电影" });
  fireEvent.pointerOver(nav);
  expect(nav.dataset.tooltip).toBe("家庭电影");
  fireEvent.click(nav);
  expect(go).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));
  fireEvent.focus(nav);
  expect(nav.dataset.tooltip).toBeUndefined();
});
it("does not animate navigation under reduced motion", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("reduced-motion"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const content = document.createElement("div");
  content.className = "browse-main";
  const inner = document.createElement("div");
  inner.className = "content";
  const animate = vi.fn();
  inner.animate = animate;
  content.append(inner);
  document.body.append(content);
  const view = render(<Sidebar navigation="home">{null}</Sidebar>);
  view.rerender(<Sidebar navigation="library">{null}</Sidebar>);
  expect(animate).not.toHaveBeenCalled();
  content.remove();
});
it("cancels old navigation animations and never retains a fill transform", () => {
  const main = document.createElement("main");
  main.className = "browse-main";
  const inner = document.createElement("div");
  inner.className = "content";
  const cancel = vi.fn();
  inner.animate = vi.fn(() => ({ cancel }) as unknown as Animation);
  main.append(inner);
  document.body.append(main);
  const view = render(<Sidebar navigation="home">{null}</Sidebar>);
  view.rerender(<Sidebar navigation="library">{null}</Sidebar>);
  expect(cancel).toHaveBeenCalledOnce();
  expect(inner.animate).toHaveBeenLastCalledWith(expect.any(Array), {
    duration: 150,
    easing: "ease-out",
  });
  view.unmount();
  expect(cancel).toHaveBeenCalledTimes(2);
  main.remove();
});
