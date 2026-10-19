// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});
it("renders a real library response with requested fields through App page mapping without per-card requests", async () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(
    "miry-account",
    JSON.stringify({
      server: "https://chain.test/emby",
      userId: "u",
      token: "secret",
      name: "QA",
      deviceId: "d",
    }),
  );
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    let result: unknown = { Items: [], TotalRecordCount: 0 };
    if (url.pathname.endsWith("/Views"))
      result = {
        Items: [
          {
            Id: "lib",
            Name: "真实电影库",
            Type: "CollectionFolder",
            CollectionType: "movies",
          },
        ],
      };
    else if (url.pathname.endsWith("/Items")) {
      const item: Record<string, unknown> = {
        Id: "actual",
        Name: "真实列表电影",
        Type: "Movie",
      };
      const requested = new Set(
        (url.searchParams.get("Fields") || "").split(","),
      );
      for (const [key, value] of Object.entries({
        ProductionYear: 2024,
        Genres: ["剧情", "犯罪"],
        CommunityRating: 8.5,
      }))
        if (requested.has(key)) item[key] = value;
      result = { Items: [item], TotalRecordCount: 1 };
    }
    return new Response(JSON.stringify(result));
  });
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "真实电影库" }));
  await waitFor(() =>
    expect(document.querySelector(".poster-metadata")?.textContent).toBe(
      "2024 · 剧情 / 犯罪 · 8.5",
    ),
  );
  const urls = fetch.mock.calls.map(([input]) => new URL(String(input)));
  expect(urls.some((url) => url.searchParams.get("ParentId") === "lib")).toBe(
    true,
  );
  expect(
    urls.some(
      (url) =>
        url.pathname.includes("PlaybackInfo") ||
        url.pathname.endsWith("/Items/actual"),
    ),
  ).toBe(false);
});
