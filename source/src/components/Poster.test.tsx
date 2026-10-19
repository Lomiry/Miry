// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Poster } from "./Poster";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const item = { Id: "movie", Name: "测试影片", Type: "Movie" };
it("reveals a cached image that completed before its load handler", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    600,
  );
  render(<Poster item={item} url="/cached.jpg" />);
  expect(screen.getByRole("img").className).toBe("art-loaded");
});
it("falls back after an unavailable image and shows a clear empty state only after all sources fail", () => {
  render(
    <Poster
      item={item}
      url="/broken.jpg"
      fallbackUrls={["/series.jpg"]}
      onClick={() => {}}
    />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").getAttribute("src")).toBe("/series.jpg");
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("img").className).toBe("art-loaded");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
    "默认封面",
  );
  expect(screen.getByText("暂无封面")).toBeTruthy();
});
it("shows a new image after changing an item that had no working cover", () => {
  const view = render(<Poster item={item} url="/a.jpg" />);
  fireEvent.error(screen.getByRole("img"));
  view.rerender(<Poster item={{ ...item, Id: "new" }} url="/b.jpg" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("/b.jpg");
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("img").className).toBe("art-loaded");
});
