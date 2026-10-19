// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount } from "./stores/account";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const page = (name?: string) => ({
  Items: name ? [{ Id: name, Name: name, Type: "Movie" }] : [],
  TotalRecordCount: name ? 1 : 0,
});
it("submits media search through Items, rejects late responses, shows empty/error states, and clears back to browsing", async () => {
  saveAccount(
    {
      server: "https://search.test/emby",
      userId: "fixture",
      name: "Fixture",
      token: "synthetic",
      deviceId: "fixture",
    },
    false,
  );
  let finishOld!: (response: Response) => void;
  let oldSignal: AbortSignal | undefined;
  const fetch = vi.fn(async (address: string, init?: RequestInit) => {
    const url = new URL(address),
      query = url.searchParams.get("SearchTerm");
    if (query === "old") {
      oldSignal = init?.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        finishOld = resolve;
      });
    }
    if (query === "error")
      return new Response("fixture failure", { status: 500 });
    const data = query === "沙丘 Dune 2021" ? page("最新结果") : page();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByLabelText("搜索媒体");
  await user.type(input, "old");
  expect(fetch.mock.calls.some(([url]) => url.includes("SearchTerm"))).toBe(
    false,
  );
  await user.keyboard("{Enter}");
  await waitFor(() => expect(finishOld).toBeTypeOf("function"));
  await user.clear(input);
  await user.type(input, "沙丘 Dune 2021");
  await user.click(screen.getByLabelText("提交媒体搜索"));
  await screen.findByRole("button", { name: "快速播放 最新结果" });
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => {
    finishOld(new Response(JSON.stringify(page("旧结果"))));
  });
  expect(screen.queryByText("旧结果")).toBeNull();
  const searchRequests = () =>
    fetch.mock.calls.filter(([url]) =>
      new URL(url).searchParams.has("SearchTerm"),
    );
  expect(searchRequests()).toHaveLength(2);
  const query = new URL(searchRequests()[1][0]);
  expect(query.searchParams.get("Recursive")).toBe("true");
  expect(query.searchParams.get("IncludeItemTypes")).toBe(
    "Movie,Series,Episode",
  );
  await user.clear(input);
  await user.type(input, "empty{Enter}");
  await waitFor(() => expect(searchRequests()).toHaveLength(3));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "快速播放 最新结果" }),
    ).toBeNull(),
  );
  await user.clear(input);
  await user.type(input, "error{Enter}");
  await screen.findByText(/服务器暂时无法处理请求/);
  await user.click(screen.getByLabelText("清空搜索关键词"));
  await waitFor(() =>
    expect(screen.queryByText(/服务器暂时无法处理请求/)).toBeNull(),
  );
  expect(input).toHaveProperty("value", "");
  await user.keyboard("{Enter}");
  expect(searchRequests()).toHaveLength(4);
  expect(fetch.mock.calls.some(([url]) => url.includes("PlaybackInfo"))).toBe(
    false,
  );
});
