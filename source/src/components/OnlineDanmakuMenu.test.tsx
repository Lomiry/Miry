// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import OnlineDanmakuMenu from "./OnlineDanmakuMenu";
import userEvent from "@testing-library/user-event";
import { danmakuDefaults, type DanmakuPresentation } from "../danmaku/types";
afterEach(cleanup);
it("focuses search, edits Chinese/English/cursors/clipboard and prevents IME or empty submission", async () => {
  const dispatch = vi.fn(async () => {}),
    user = userEvent.setup();
  render(<OnlineDanmakuMenu value={value} dispatch={dispatch} />);
  await user.click(screen.getByText("搜索其他弹幕"));
  const input = screen.getByLabelText("在线弹幕搜索");
  expect(document.activeElement).toBe(input);
  await user.clear(input);
  fireEvent.submit(input.closest("form")!);
  expect(dispatch).not.toHaveBeenCalled();
  await user.type(input, "沙丘 Dune 2021");
  await user.keyboard("{ArrowLeft}{ArrowRight}{Backspace}1");
  await user.keyboard("{Control>}a{/Control}{Control>}c{/Control}");
  await user.paste("沙丘 Dune 2021");
  expect(input).toHaveProperty("value", "沙丘 Dune 2021");
  fireEvent.compositionStart(input);
  await user.keyboard("{Enter}");
  fireEvent.submit(input.closest("form")!);
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await user.keyboard("{Enter}");
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    kind: "danmaku",
    command: "search",
    query: "沙丘 Dune 2021",
  });
});
it("shows shared recommendation and reason without hiding other selectable results", () => {
  const dispatch = vi.fn(async () => {});
  render(
    <OnlineDanmakuMenu
      value={{
        ...value,
        online: {
          ...value.online!,
          candidates: [
            {
              ...value.online!.candidates[0],
              recommended: true,
              reason: "剧名、S02E05一致",
            },
            {
              ...value.online!.candidates[0],
              id: "2",
              title: "另一个结果",
              reason: "集数不同",
            },
          ],
        },
      }}
      dispatch={dispatch}
    />,
  );
  expect(screen.getByText("推荐")).toBeTruthy();
  expect(screen.getByText("剧名、S02E05一致")).toBeTruthy();
  fireEvent.click(screen.getByText("另一个结果"));
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "select",
    matchId: "2",
  });
});
const value: DanmakuPresentation = {
  name: "",
  count: 0,
  skipped: 0,
  status: "",
  offset: 0,
  bound: false,
  settings: danmakuDefaults,
  online: {
    configured: true,
    mock: true,
    status: "请选择在线弹幕",
    loading: false,
    query: "Anime S02E05",
    candidates: [
      {
        provider: "dandanplay",
        id: "1",
        animeId: "1",
        title: "Anime Season 2",
        episodeTitle: "Episode 5",
        season: 2,
        episode: 5,
        movie: false,
      },
    ],
  },
};
it("search prefills series coordinates, submits explicit query and selects bounded labeled result", () => {
  const dispatch = vi.fn(async () => {});
  render(<OnlineDanmakuMenu value={value} dispatch={dispatch} />);
  fireEvent.click(screen.getByText("搜索其他弹幕"));
  expect(
    (screen.getByLabelText("在线弹幕搜索") as HTMLInputElement).value,
  ).toBe("Anime S02E05");
  fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "search",
    query: "Anime S02E05",
  });
  fireEvent.click(screen.getByText("Anime Season 2"));
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "select",
    matchId: "1",
  });
  expect(screen.getByText(/S02E05/)).toBeTruthy();
});
it("offers native credential file picker and no secret input when unconfigured", () => {
  const dispatch = vi.fn(async () => {});
  render(
    <OnlineDanmakuMenu
      value={{
        ...value,
        online: {
          ...value.online!,
          configured: false,
          status: "未配置在线弹幕服务",
        },
      }}
      dispatch={dispatch}
    />,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByText("配置已授权的服务凭据"));
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "configure",
  });
});
it("keeps built-in service usable without exposing credential controls", () => {
  const dispatch = vi.fn(async () => {});
  render(
    <OnlineDanmakuMenu
      value={{
        ...value,
        online: { ...value.online!, mock: false, builtIn: true },
      }}
      dispatch={dispatch}
    />,
  );
  expect(screen.queryByText("服务配置")).toBeNull();
  expect(screen.queryByText("更换凭据")).toBeNull();
  expect(screen.queryByText("清除本次运行凭据")).toBeNull();
  expect(screen.queryByText("配置已授权的服务凭据")).toBeNull();
  fireEvent.click(screen.getByText("搜索其他弹幕"));
  fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
  expect(dispatch).toHaveBeenCalledWith({
    kind: "danmaku",
    command: "search",
    query: "Anime S02E05",
  });
});
