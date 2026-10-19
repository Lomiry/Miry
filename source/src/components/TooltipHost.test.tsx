// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import TooltipHost from "./TooltipHost";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each(["首页", "媒体库", "账号"])(
  "anchors collapsed %s tooltip 10px from the icon and vertically centered",
  (name) => {
    vi.useFakeTimers();
    render(
      <>
        <aside className="sidebar" data-collapsed="true">
          <button data-tooltip={name}>
            <svg />
          </button>
        </aside>
        <TooltipHost />
      </>,
    );
    const button = document.querySelector("button")!;
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 90,
      width: 40,
      height: 36,
    } as DOMRect);
    vi.spyOn(
      button.querySelector("svg")!,
      "getBoundingClientRect",
    ).mockReturnValue({ right: 40, top: 98, height: 20 } as DOMRect);
    fireEvent.pointerOver(button);
    act(() => vi.advanceTimersByTime(350));
    const tip = screen.getByRole("tooltip");
    expect(tip.style.left).toBe("50px");
    expect(tip.style.top).toBe("108px");
    expect(tip.style.transform).toBe("translateY(-50%)");
    expect(tip.parentElement).toBe(document.body);
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByRole("tooltip")).toBeNull();
  },
);

it("preserves ordinary tooltip positioning outside the collapsed sidebar", () => {
  vi.useFakeTimers();
  render(
    <>
      <button data-tooltip="播放" />
      <TooltipHost />
    </>,
  );
  const button = document.querySelector("button")!;
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    left: 300,
    top: 100,
    width: 40,
    height: 36,
  } as DOMRect);
  fireEvent.focusIn(button);
  act(() => vi.advanceTimersByTime(350));
  const tip = screen.getByRole("tooltip");
  expect(tip.style.left).toBe("320px");
  expect(tip.style.top).toBe("92px");
  expect(tip.style.transform).toBe("translate(-50%, -100%)");
});
