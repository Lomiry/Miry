// @vitest-environment jsdom
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { EmbyClient } from "../api/client";
import OnlineDanmakuMenu from "../components/OnlineDanmakuMenu";
import { onlineProvider } from "./dandanplay";
import useDanmaku from "./useDanmaku";
import { readProviderCounters } from "./requestDiagnostics";
vi.mock("./searchDiagnostics", async (original) => ({
  ...(await original<typeof import("./searchDiagnostics")>()),
  developmentDiagnostic: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
const api = new EmbyClient({
  server: "https://synthetic.test",
  serverId: "synthetic",
  userId: "synthetic",
  name: "Fixture",
  token: "synthetic",
  deviceId: "synthetic",
});
const item = {
  Id: "fixture",
  Name: "Movie",
  Type: "Movie",
  ProviderIds: { Tmdb: "1" },
  ProductionYear: 2021,
};
function Harness() {
  const [menu, setMenu] = useState(false);
  const d = useDanmaku(api, item, true, "fixture-playback");
  return (
    <>
      <button onClick={() => setMenu((v) => !v)}>menu</button>
      <output data-testid="online-state">{d.metadata.online?.status}</output>
      {menu && (
        <OnlineDanmakuMenu
          value={d.metadata}
          dispatch={async (a) => {
            if (a.kind === "danmaku")
              await d.action(a.command, a.patch, a.query, a.matchId);
          }}
        />
      )}
    </>
  );
}
const wire = () =>
  vi
    .mocked(invoke)
    .mock.calls.filter(([name]) => name === "danmaku_online_request");
beforeEach(() => {
  localStorage.clear();
  onlineProvider.clear();
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (name, args) => {
      if (name === "danmaku_online_status")
        return { configured: true, builtIn: true, mock: true };
      if (name !== "danmaku_online_request") return null;
      const q = (args as { query: { kind: string } }).query;
      return {
        data:
          q.kind === "comments"
            ? { comments: [{ p: "0,1,16777215,0", m: "fixture" }] }
            : {
                success: true,
                animes: [
                  {
                    animeId: "1",
                    animeTitle: "Movie",
                    type: "movie",
                    startDate: "2021-01-01",
                    episodes: [{ episodeId: "1", episodeTitle: "Movie" }],
                  },
                ],
              },
        diagnostic: {
          path:
            q.kind === "comments"
              ? "/api/v2/comment/1"
              : "/api/v2/search/episodes",
          status: 200,
          contentType: "application/json",
        },
      };
    });
});
afterEach(cleanup);
it("StrictMode, menu mount/reopen/search expansion and changing match UI add zero automatic requests", async () => {
  render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("online-state").textContent).toContain("已匹配"),
  );
  expect(wire()).toHaveLength(2);
  fireEvent.click(screen.getByText("menu"));
  fireEvent.click(screen.getByText("搜索其他弹幕"));
  fireEvent.click(screen.getByText("menu"));
  fireEvent.click(screen.getByText("menu"));
  fireEvent.click(screen.getByText("更换匹配"));
  expect(wire()).toHaveLength(2);
  expect(screen.getByLabelText("在线弹幕搜索")).toBeTruthy();
  fireEvent.submit(screen.getByLabelText("在线弹幕搜索").closest("form")!);
  await waitFor(() =>
    expect(screen.getByTestId("online-state").textContent).toContain(
      "已找到推荐匹配，请确认",
    ),
  );
  // Manual Name query differs from the previous TMDb query; one search,
  // without comments until explicitly selecting an episode.
  expect(wire()).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: /Movie · 2021/ }));
  await waitFor(() =>
    expect(screen.getByTestId("online-state").textContent).toContain("已匹配"),
  );
  expect(wire()).toHaveLength(3);
  fireEvent.click(screen.getByText("重新加载在线弹幕"));
  await waitFor(() => expect(wire()).toHaveLength(4));
  expect(readProviderCounters().at(-1)).toMatchObject({
    providerSearchRequests: 2,
    providerCommentRequests: 2,
    providerFallbackRequests: 0,
  });
});
