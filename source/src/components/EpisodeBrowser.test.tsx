import { pickSelect } from "../testSelect";
// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EpisodeBrowser from "./EpisodeBrowser";
import { EmbyClient } from "../api/client";
const api = new EmbyClient({
  server: "https://example.com/emby",
  userId: "u",
  token: "t",
  name: "t",
  deviceId: "d",
});
const parent = { Id: "show", Name: "Show", Type: "Series" };
const seasons = [
  { Id: "s1", Name: "第一季", Type: "Season" },
  { Id: "s2", Name: "第二季", Type: "Season" },
];
it("restores the second season's episode page and merges a final local playback position", async () => {
  const items = vi.spyOn(api, "items").mockResolvedValue({
    Items: [
      {
        Id: "e57",
        Name: "第57集",
        Type: "Episode",
        IndexNumber: 57,
        RunTimeTicks: 1000000000,
      },
    ],
    TotalRecordCount: 60,
  });
  const onPageChange = vi.fn();
  const user = userEvent.setup();
  render(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      initialSeasonId="s2"
      initialPage={1}
      onPageChange={onPageChange}
      onPlay={vi.fn()}
      onDetail={vi.fn()}
      progressItems={[
        {
          Id: "e57",
          Name: "第57集",
          Type: "Episode",
          UserData: { PlaybackPositionTicks: 500000000 },
        },
      ]}
    />,
  );
  await screen.findByText("第57集");
  expect(screen.getByText(/已看 50%/)).toBeTruthy();
  expect(items).toHaveBeenCalledWith(
    expect.objectContaining({ ParentId: "s2", StartIndex: 50 }),
    expect.any(AbortSignal),
  );
  await user.click(screen.getByRole("button", { name: "上一页" }));
  expect(onPageChange).toHaveBeenCalledWith("s2", 0);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("restores the selected season after a page refresh remount", async () => {
  const items = vi.spyOn(api, "items").mockResolvedValue({
    Items: [{ Id: "episode", Name: "新的故事", Type: "Episode" }],
    TotalRecordCount: 1,
  });
  let remembered: string | undefined;
  const props = {
    api,
    parent,
    seasons,
    onPlay: vi.fn(),
    onDetail: vi.fn(),
    onSeasonChange: (id: string) => {
      remembered = id;
    },
  };
  const first = render(<EpisodeBrowser {...props} />);
  await screen.findByText("新的故事");
  await pickSelect(userEvent.setup(), screen.getByLabelText("选择季"), "s2");
  await screen.findByText("新的故事");
  first.unmount();
  render(<EpisodeBrowser {...props} initialSeasonId={remembered} />);
  await screen.findByText("新的故事");
  expect(screen.getByLabelText("选择季").getAttribute("data-value")).toBe("s2");
  expect(items).toHaveBeenLastCalledWith(
    expect.objectContaining({ ParentId: "s2" }),
    expect.any(AbortSignal),
  );
});
it("distinguishes the playing episode, next episode, watched status and tick progress", async () => {
  const items = vi.spyOn(api, "items").mockResolvedValue({
    Items: [
      {
        Id: "e1",
        Name: "上一集",
        Type: "Episode",
        IndexNumber: 1,
        UserData: { Played: true },
      },
      {
        Id: "e2",
        Name: "正在追的故事",
        Type: "Episode",
        IndexNumber: 2,
        RunTimeTicks: 1000000000,
        UserData: { PlaybackPositionTicks: 400000000 },
      },
      { Id: "e3", Name: "下一个故事", Type: "Episode", IndexNumber: 3 },
    ],
    TotalRecordCount: 3,
  });
  const view = render(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      currentId="e2"
      onPlay={vi.fn()}
      onDetail={vi.fn()}
    />,
  );
  await screen.findByText("正在播放");
  expect(
    screen
      .getByText("正在追的故事")
      .closest("article")
      ?.getAttribute("aria-current"),
  ).toBe("true");
  expect(
    screen.getByText("下一个故事").closest("article")?.className,
  ).toContain("is-next");
  expect(screen.getByText("上一集").closest("article")?.className).toContain(
    "is-watched",
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "40",
  );
  view.rerender(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      currentId="e3"
      onPlay={vi.fn()}
      onDetail={vi.fn()}
    />,
  );
  expect(
    screen
      .getByText("下一个故事")
      .closest("article")
      ?.getAttribute("aria-current"),
  ).toBe("true");
  expect(items).toHaveBeenCalledTimes(1);
});
it("ignores old season results after switching and does not refetch on parent rerender", async () => {
  let finish: (value: {
    Items: { Id: string; Name: string; Type: string }[];
    TotalRecordCount: number;
  }) => void = () => {};
  const items = vi
    .spyOn(api, "items")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({
      Items: [{ Id: "new", Name: "新季剧集", Type: "Episode" }],
      TotalRecordCount: 1,
    });
  const user = userEvent.setup(),
    onPlay = vi.fn(),
    onDetail = vi.fn();
  const view = render(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      onPlay={onPlay}
      onDetail={onDetail}
    />,
  );
  await pickSelect(user, screen.getByLabelText("选择季"), "s2");
  await screen.findByRole("button", { name: /新季剧集/ });
  finish({
    Items: [{ Id: "old", Name: "过期剧集", Type: "Episode" }],
    TotalRecordCount: 1,
  });
  view.rerender(
    <EpisodeBrowser
      api={api}
      parent={{ ...parent }}
      seasons={[...seasons]}
      onPlay={onPlay}
      onDetail={onDetail}
    />,
  );
  await waitFor(() => expect(items).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("过期剧集")).toBeNull();
  expect(items.mock.calls[0][1]?.aborted).toBe(true);
});
it("paginates a long season with bounded requests", async () => {
  const items = vi.spyOn(api, "items").mockResolvedValue({
    Items: [{ Id: "e", Name: "Episode", Type: "Episode" }],
    TotalRecordCount: 80,
  });
  const user = userEvent.setup();
  render(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      onPlay={vi.fn()}
      onDetail={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: /Episode/ });
  await user.click(screen.getByRole("button", { name: "下一页" }));
  await waitFor(() =>
    expect(items.mock.calls[1][0]).toMatchObject({
      ParentId: "s1",
      StartIndex: 50,
      Limit: 50,
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "下一页" })).toHaveProperty(
      "disabled",
      true,
    ),
  );
});

it("reaches episodes beyond the first page when the server reports a zero total", async () => {
  const first = Array.from({ length: 50 }, (_, n) => ({
    Id: `ep-${n}`,
    Name: `剧集 ${n + 1}`,
    Type: "Episode",
  }));
  const items = vi
    .spyOn(api, "items")
    .mockResolvedValueOnce({ Items: first, TotalRecordCount: 0 })
    .mockResolvedValueOnce({
      Items: [{ Id: "last", Name: "最后一集", Type: "Episode" }],
      TotalRecordCount: 0,
    });
  const user = userEvent.setup();
  render(
    <EpisodeBrowser
      api={api}
      parent={parent}
      seasons={seasons}
      onPlay={vi.fn()}
      onDetail={vi.fn()}
    />,
  );
  await screen.findByText("第 1 页");
  await user.click(screen.getByRole("button", { name: "下一页" }));
  await screen.findByRole("button", { name: /最后一集/ });
  expect(items.mock.calls[1][0]).toMatchObject({ StartIndex: 50, Limit: 50 });
  expect(screen.getByText("第 2 页 / 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "下一页" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("button", { name: "上一页" })).toHaveProperty(
    "disabled",
    false,
  );
});
