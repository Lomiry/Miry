// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "./core";
import { videoFitLabels } from "../player/videoFit";
import SecondarySubtitlePosition from "../components/SecondarySubtitlePosition";

afterEach(() => {
  cleanup();
  setLanguage("zh-CN", false);
});

it("translates current video-fit choices without recreating their stable values", () => {
  expect(videoFitLabels.fill).toBe("填充屏幕");
  setLanguage("en-US", false);
  expect(videoFitLabels.fit).toBe("Fit (default)");
  expect(videoFitLabels.fill).toBe("Fill");
  expect(videoFitLabels.stretch).toBe("Stretch");
});

it("keeps the subtitle position and focused handle when changing language", () => {
  const send = vi.fn().mockResolvedValue(undefined);
  render(
    <SecondarySubtitlePosition value={37} send={send} onClose={vi.fn()} />,
  );
  const slider = screen.getByRole("slider", { name: "次字幕垂直位置" });
  act(() => setLanguage("en-US", false));
  expect(
    screen.getByRole("slider", {
      name: "Secondary subtitle vertical position",
    }),
  ).toBe(slider);
  expect(slider.getAttribute("aria-valuenow")).toBe("37");
  expect(document.activeElement).toBe(slider);
  expect(send).not.toHaveBeenCalled();
});
