// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MediaListRow from "./MediaListRow";
afterEach(cleanup);
it("shows useful row metadata, watched percentage and separate detail/save actions", async () => {
  const item = {
    Id: "movie",
    Name: "列表影片",
    Type: "Movie",
    ProductionYear: 2024,
    CommunityRating: 8.5,
    RunTimeTicks: 72000000000,
    UserData: { PlaybackPositionTicks: 36000000000 },
    Genres: ["剧情"],
  };
  const detail = vi.fn(),
    save = vi.fn(),
    user = userEvent.setup();
  render(
    <MediaListRow item={item} api={null} onDetail={detail} onLater={save} />,
  );
  expect(screen.getByText("2024")).toBeTruthy();
  expect(screen.getByText("120 分钟")).toBeTruthy();
  expect(screen.getByLabelText("评分 8.5")).toBeTruthy();
  expect(screen.getByText("已看 50%")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "加入待看 列表影片" }));
  expect(save).toHaveBeenCalledWith(item);
  expect(detail).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "查看详情 列表影片" }));
  expect(detail).toHaveBeenCalledWith(item);
});
it("keeps nonplayable aggregated rows free of playback and save actions", () => {
  render(
    <MediaListRow
      item={{
        Id: "m",
        Name: "其他服务器影片",
        Type: "Movie",
        UserData: { Played: true },
      }}
      api={null}
      onDetail={vi.fn()}
      onPlay={vi.fn()}
      onLater={vi.fn()}
      playable={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /快速播放|加入待看/ }),
  ).toBeNull();
  expect(screen.getByText("已看")).toBeTruthy();
});
