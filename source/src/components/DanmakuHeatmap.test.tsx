// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DanmakuHeatmap from "./DanmakuHeatmap";
import PlayerSlider from "./PlayerSlider";
afterEach(cleanup);
it("has no focus target, leaves the slider functional, and clears stale duration data", () => {
  const commit = vi.fn();
  const view = render(
    <div>
      <DanmakuHeatmap
        value={{ duration: 100, bins: [0, 1, 0.5] }}
        duration={100}
      />
      <PlayerSlider
        label="Seek"
        max={100}
        value={10}
        disabled={false}
        commit={commit}
      />
    </div>,
  );
  expect(view.container.querySelectorAll("rect")).toHaveLength(2);
  expect(view.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
    "true",
  );
  const slider = screen.getByRole("slider");
  fireEvent.pointerDown(slider);
  fireEvent.change(slider, { target: { value: "45" } });
  fireEvent.pointerUp(slider);
  expect(commit).toHaveBeenCalledExactlyOnceWith(45);
  view.rerender(
    <DanmakuHeatmap value={{ duration: 100, bins: [1] }} duration={200} />,
  );
  expect(view.container.querySelector("svg")).toBeNull();
  view.rerender(<DanmakuHeatmap duration={100} />);
  expect(view.container.querySelector("svg")).toBeNull();
});
