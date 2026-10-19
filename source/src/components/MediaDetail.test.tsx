// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MediaDetail from "./MediaDetail";
afterEach(cleanup);
it("keeps resume as primary action, expands long descriptions and cleans server HTML", () => {
  const overview =
    "<p>" + "可以阅读的简介。".repeat(30) + "</p><script>injected()</script>";
  render(
    <MediaDetail
      item={{
        Id: "movie",
        Name: "测试影片",
        Type: "Movie",
        Overview: overview,
        UserData: { PlaybackPositionTicks: 1200000000 },
      }}
      api={null}
      saved={false}
      onPlay={vi.fn()}
      onLater={vi.fn()}
      onChange={vi.fn()}
      onPerson={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "继续播放 · 02:00" })).toBeTruthy();
  expect(screen.queryByText(/injected/)).toBeNull();
  const expand = screen.getByRole("button", { name: "展开简介" });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expand);
  expect(
    screen
      .getByRole("button", { name: "收起简介" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});
