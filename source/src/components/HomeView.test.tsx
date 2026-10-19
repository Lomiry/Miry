// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import HomeView from "./HomeView";
afterEach(cleanup);
const base = {
  api: null,
  later: [],
  nextUp: [],
  views: [],
  onPlay: vi.fn(),
  onDetail: vi.fn(),
  onLater: vi.fn(),
  onCatalog: vi.fn(),
  onLibrary: vi.fn(),
};
it("prioritizes resume content and keeps category shelves distinct", () => {
  const items = Array.from({ length: 18 }, (_, n) => ({
    Id: `m${n}`,
    Name: `影片 ${n}`,
    Type: n % 2 ? "Series" : "Movie",
  }));
  const resumed = {
    Id: "resumed",
    Name: "上次看的电影",
    Type: "Movie",
    UserData: { PlaybackPositionTicks: 1200000000 },
  };
  render(<HomeView {...base} items={items} resume={[resumed]} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    resumed.Name,
  );
  expect(screen.getAllByRole("button", { name: /快速播放 影片/ })).toHaveLength(
    18,
  );
  expect(
    within(screen.getByRole("group", { name: "最近加入内容" })).getAllByRole(
      "button",
      { name: /快速播放/ },
    ),
  ).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "详情" }));
  expect(base.onDetail).toHaveBeenCalledWith(resumed);
});
it("keeps library navigation available when there are no media titles", () => {
  const view = { Id: "lib", Name: "家庭电影", Type: "CollectionFolder" };
  const open = vi.fn();
  render(
    <HomeView
      {...base}
      items={[]}
      resume={[]}
      views={[view]}
      onLibrary={open}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "打开媒体库 家庭电影" }));
  expect(open).toHaveBeenCalledWith(view);
  expect(
    screen.getByRole("heading", { name: "媒体库还没有内容" }),
  ).toBeTruthy();
});
it("does not leave an empty next-up shelf when its only episode is featured", () => {
  render(
    <HomeView
      {...base}
      items={[]}
      resume={[]}
      nextUp={[{ Id: "next", Name: "下一集", Type: "Episode" }]}
    />,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("下一集");
  expect(
    screen.queryByRole("heading", { level: 2, name: "接着追剧" }),
  ).toBeNull();
});

it("keeps demo feature content usable with the built-in artwork fallback", () => {
  const item = { Id: "d1", Name: "Demo Feature", Type: "Movie" };
  const detail = vi.fn();
  render(
    <HomeView
      {...base}
      api={null}
      items={[item]}
      resume={[]}
      nextUp={[]}
      onDetail={detail}
    />,
  );

  expect(
    screen.getByRole("img", { name: "Demo Feature · 默认封面" }),
  ).toBeTruthy();
  expect(screen.queryByRole("img", { name: /d1\.jpg/ })).toBeNull();
  expect(document.querySelector('img[src*="/demo/"]')).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "查看详情 Demo Feature" }),
  );
  expect(detail).toHaveBeenCalledWith(item);
});
