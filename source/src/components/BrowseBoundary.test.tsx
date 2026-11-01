// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BrowseBoundary from "./BrowseBoundary";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("isolates a list error, retains the shell and retries without reloading or changing route", () => {
  let fail = true;
  const Bad = () => {
    if (fail) throw Error("controlled list failure");
    return <p>library content</p>;
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(
    <>
      <header>shell remains</header>
      <BrowseBoundary resetKey="movies">
        <Bad />
      </BrowseBoundary>
    </>,
  );
  expect(screen.getByText("shell remains")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByText("错误详情"));
  expect(screen.getByText(/controlled list failure/)).toBeTruthy();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "重试当前列表" }));
  expect(screen.getByText("library content")).toBeTruthy();
  fail = true;
  view.rerender(
    <>
      <header>shell remains</header>
      <BrowseBoundary resetKey="series">
        <Bad />
      </BrowseBoundary>
    </>,
  );
  expect(screen.getByText("shell remains")).toBeTruthy();
});
