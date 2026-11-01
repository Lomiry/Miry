// @vitest-environment jsdom
import { Profiler } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Artwork } from "./Artwork";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("does not commit a second render when fallback artwork has no image state to synchronize", () => {
  const committed = vi.fn();
  render(
    <Profiler id="artwork" onRender={committed}>
      <Artwork sources={[]} fallback={<span>Missing cover</span>} />
    </Profiler>,
  );
  expect(screen.getByText("Missing cover")).toBeTruthy();
  expect(committed).toHaveBeenCalledTimes(1);
});

it("preserves image load, fallback and source replacement state", () => {
  const view = render(
    <Artwork
      sources={["/first.png", "/fallback.png"]}
      alt="Cover"
      fallback={<span>Missing cover</span>}
    />,
  );
  expect(screen.getByAltText("Cover").className).toContain("art-loading");
  fireEvent.error(screen.getByAltText("Cover"));
  expect(screen.getByAltText("Cover").getAttribute("src")).toBe(
    "/fallback.png",
  );
  fireEvent.load(screen.getByAltText("Cover"));
  expect(screen.getByAltText("Cover").className).toContain("art-loaded");
  view.rerender(<Artwork sources={["/replacement.png"]} alt="Cover" />);
  expect(screen.getByAltText("Cover").getAttribute("src")).toBe(
    "/replacement.png",
  );
  expect(screen.getByAltText("Cover").className).toContain("art-loading");
  view.rerender(<Artwork sources={[]} fallback={<span>Missing cover</span>} />);
  expect(screen.queryByAltText("Cover")).toBeNull();
  expect(screen.getByText("Missing cover")).toBeTruthy();
  view.rerender(<Artwork sources={["/first.png"]} alt="Cover" />);
  expect(screen.getByAltText("Cover").className).toContain("art-loading");
});

it("synchronizes an already cached portrait and still exhausts failed sources", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    100,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    150,
  );
  render(
    <Artwork
      sources={["/cached.png"]}
      alt="Cover"
      fallback={<span>Missing cover</span>}
    />,
  );
  expect(screen.getByAltText("Cover").className).toContain("art-loaded");
  expect(screen.getByAltText("Cover").className).toContain("art-portrait");
  fireEvent.error(screen.getByAltText("Cover"));
  expect(screen.queryByAltText("Cover")).toBeNull();
  expect(screen.getByText("Missing cover")).toBeTruthy();
});

it("ignores late load and error events from a replaced image", () => {
  const view = render(<Artwork sources={["/old.png"]} alt="Old media" />);
  const oldImage = screen.getByAltText("Old media");
  view.rerender(<Artwork sources={["/new.png"]} alt="New media" />);
  const newImage = screen.getByAltText("New media");
  expect(newImage).not.toBe(oldImage);
  fireEvent.load(oldImage);
  fireEvent.error(oldImage);
  expect(screen.getByAltText("New media")).toBe(newImage);
  expect(newImage.className).toContain("art-loading");
  fireEvent.load(newImage);
  fireEvent.error(oldImage);
  expect(newImage.className).toContain("art-loaded");
  expect(newImage.getAttribute("src")).toBe("/new.png");
});

it("keeps an exhausted source chain bounded and permits retry after remount", () => {
  const view = render(
    <Artwork
      sources={[undefined, "/failed.png", "/failed.png"]}
      alt="Cover"
      fallback={<span>Missing cover</span>}
    />,
  );
  fireEvent.error(screen.getByAltText("Cover"));
  view.rerender(
    <Artwork
      sources={["/failed.png"]}
      alt="Cover"
      fallback={<span>Missing cover</span>}
    />,
  );
  expect(screen.queryByAltText("Cover")).toBeNull();
  expect(screen.getByText("Missing cover")).toBeTruthy();
  view.unmount();
  render(<Artwork sources={["/failed.png"]} alt="Cover" />);
  expect(screen.getByAltText("Cover").className).toContain("art-loading");
  fireEvent.load(screen.getByAltText("Cover"));
  expect(screen.getByAltText("Cover").className).toContain("art-loaded");
});

it("detaches image events when the source is removed or the component unmounts", () => {
  const committed = vi.fn();
  const view = render(
    <Profiler id="artwork" onRender={committed}>
      <Artwork sources={["/removed.png"]} alt="Cover" />
    </Profiler>,
  );
  const removedImage = screen.getByAltText("Cover");
  view.rerender(
    <Profiler id="artwork" onRender={committed}>
      <Artwork sources={[]} fallback={<span>Missing cover</span>} />
    </Profiler>,
  );
  committed.mockClear();
  fireEvent.load(removedImage);
  fireEvent.error(removedImage);
  expect(committed).not.toHaveBeenCalled();
  expect(screen.getByText("Missing cover")).toBeTruthy();
  view.rerender(
    <Profiler id="artwork" onRender={committed}>
      <Artwork sources={["/unmounted.png"]} alt="Cover" />
    </Profiler>,
  );
  const unmountedImage = screen.getByAltText("Cover");
  view.unmount();
  committed.mockClear();
  fireEvent.load(unmountedImage);
  fireEvent.error(unmountedImage);
  expect(committed).not.toHaveBeenCalled();
});
