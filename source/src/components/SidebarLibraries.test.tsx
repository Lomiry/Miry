// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";
import SidebarLibraries from "./SidebarLibraries";
import type { Item } from "../types/emby";

const libraries = Array.from({ length: 30 }, (_, i) => ({
  Id: String(i),
  Name: `Library ${i}`,
  Type: "CollectionFolder",
})) as Item[];
beforeEach(() => localStorage.clear());
afterEach(cleanup);
function setup(activeId = "2") {
  const navigate = vi.fn();
  const view = render(
    <Sidebar>
      <SidebarLibraries
        libraries={libraries}
        activeId={activeId}
        onNavigate={navigate}
      />
      <main data-testid="page">page</main>
    </Sidebar>,
  );
  return { navigate, ...view };
}
it("aggregates thirty libraries into one active rail entry without navigating or replacing the page", () => {
  const { navigate } = setup();
  const page = screen.getByTestId("page");
  const expanded = screen.getByRole("button", { name: "Library 2" });
  fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
  expect(screen.queryByRole("button", { name: "Library 2" })).toBeNull();
  const trigger = screen.getByRole("button", { name: "媒体库" });
  expect(trigger.getAttribute("aria-current")).toBe("page");
  expect(trigger.dataset.tooltip).toBe("媒体库 · Library 2");
  fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));
  expect(screen.getByRole("button", { name: "Library 2" })).toBe(expanded);
  expect(screen.getByTestId("page")).toBe(page);
  expect(navigate).not.toHaveBeenCalled();
});
it("shows every library, identifies the current one, and navigates once from the flyout", () => {
  const { navigate } = setup();
  fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
  fireEvent.click(screen.getByRole("button", { name: "媒体库" }));
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(30);
  expect(
    screen
      .getByRole("menuitemradio", { name: "Library 2" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Library 29" }));
  expect(navigate).toHaveBeenCalledExactlyOnceWith(libraries[29]);
  expect(screen.queryByRole("menu")).toBeNull();
});
it("closes via Esc, outside pointer and expanding without navigating", () => {
  const { navigate } = setup();
  fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
  const trigger = screen.getByRole("button", { name: "媒体库" });
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});
it("does not mark the aggregate entry active on unrelated routes", () => {
  setup("missing");
  fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
  expect(
    screen.getByRole("button", { name: "媒体库" }).getAttribute("aria-current"),
  ).toBeNull();
});
