// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaCard from "./MediaCard";
import { mediaProgress } from "./MediaProgress";
import { EmbyClient } from "../api/client";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const item = {
  Id: "film",
  Name: "测试电影",
  Type: "Movie",
  RunTimeTicks: 1000000000,
  UserData: { PlaybackPositionTicks: 500000000 },
};
it("does not override the server's unchanged favorite state", async () => {
  const api = new EmbyClient({
    server: "https://truth.test",
    userId: "u",
    token: "t",
    deviceId: "d",
    name: "QA",
  });
  vi.spyOn(api, "setFavorite").mockResolvedValue({ IsFavorite: false });
  const data = vi.fn();
  render(
    <MediaCard item={item} api={api} onDetail={vi.fn()} onUserData={data} />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "收藏 测试电影" }));
  expect(data).toHaveBeenCalledWith(item, { IsFavorite: false });
});
it("keeps details, favorites and watch later as independent actions and falls back to tick progress", async () => {
  const detail = vi.fn(),
    later = vi.fn(),
    data = vi.fn(),
    user = userEvent.setup();
  render(
    <MediaCard
      item={item}
      api={null}
      saved={false}
      onDetail={detail}
      onLater={later}
      onPlay={vi.fn()}
      onUserData={data}
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "50",
  );
  await user.click(screen.getByRole("button", { name: "收藏 测试电影" }));
  expect(data).toHaveBeenCalledWith(
    item,
    expect.objectContaining({ IsFavorite: true }),
  );
  expect(detail).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "加入待看 测试电影" }));
  expect(later).toHaveBeenCalledWith(item);
  await user.click(screen.getByRole("button", { name: "查看详情 测试电影" }));
  expect(detail).toHaveBeenCalledWith(item);
});
it("keeps a failed favorite request visible and does not claim success", async () => {
  const api = new EmbyClient({
    server: "https://example.test",
    userId: "u",
    token: "t",
    deviceId: "d",
    name: "QA",
  });
  const favorite = vi
      .spyOn(api, "setFavorite")
      .mockRejectedValue(new Error("连接失败")),
    update = vi.fn();
  render(
    <MediaCard
      item={item}
      api={api}
      saved={false}
      onDetail={vi.fn()}
      onLater={vi.fn()}
      onPlay={vi.fn()}
      onUserData={update}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "收藏 测试电影" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "连接失败",
  );
  expect(favorite).toHaveBeenCalledWith("film", true);
  expect(update).not.toHaveBeenCalled();
});
it("bounds incomplete progress metadata without inventing a runtime", () => {
  expect(mediaProgress({ ...item, UserData: { PlayedPercentage: 999 } })).toBe(
    100,
  );
  expect(mediaProgress({ ...item, RunTimeTicks: undefined })).toBe(0);
  expect(mediaProgress({ ...item, UserData: { PlayedPercentage: NaN } })).toBe(
    0,
  );
});
