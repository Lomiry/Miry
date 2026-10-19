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
it("renders all-server favorites with separate users and refetches a changed non-current server", async () => {
  const accounts = ["a", "b"].map((host, i) => ({
    server: `https://${host}.test/emby`,
    serverId: host,
    userId: `u${i}`,
    token: `token${i}`,
    deviceId: "d",
    name: host,
  }));
  localStorage.setItem("miry-account", JSON.stringify(accounts[0]));
  localStorage.setItem("miry-connections", JSON.stringify(accounts));
  let otherFavorite = true;
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requests.push(url);
      let result: unknown = { Items: [], TotalRecordCount: 0 };
      if (url.pathname.includes("/FavoriteItems/")) {
        otherFavorite = false;
        result = { IsFavorite: false };
      } else if (
        url.pathname.endsWith("/Items") &&
        url.searchParams.get("IsFavorite") === "true"
      ) {
        expect(url.pathname).toContain(
          url.hostname === "a.test" ? "/Users/u0/Items" : "/Users/u1/Items",
        );
        const present = url.hostname === "a.test" || otherFavorite;
        result = {
          Items: present
            ? [
                {
                  Id: "same",
                  Name: url.hostname,
                  Type: "Movie",
                  ProductionYear: 2024,
                  Genres: ["剧情"],
                  CommunityRating: 8.5,
                  UserData: { IsFavorite: true },
                },
              ]
            : [],
          TotalRecordCount: present ? 1 : 0,
        };
      }
      return new Response(JSON.stringify(result));
    }),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "收藏" }));
  await screen.findByRole("button", { name: "取消收藏 a.test" });
  await user.click(screen.getByRole("checkbox", { name: "全部服务器" }));
  await screen.findByRole("button", { name: "取消收藏 b.test" });
  expect(document.querySelectorAll(".search-group")).toHaveLength(2);
  expect(document.querySelectorAll(".poster-metadata")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "取消收藏 b.test" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "取消收藏 b.test" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("button", { name: "取消收藏 a.test" })).toBeTruthy();
  expect(
    requests.filter(
      (u) =>
        u.hostname === "b.test" && u.searchParams.get("IsFavorite") === "true",
    ),
  ).toHaveLength(2);
  expect(
    requests.some(
      (u) =>
        u.pathname.endsWith("/Items/same") ||
        u.pathname.includes("PlaybackInfo"),
    ),
  ).toBe(false);
});
it("refetches a saved empty Favorites page after a detail mutation and removes an unfavorited mounted card", async () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(
    "miry-account",
    JSON.stringify({
      server: "https://favorite.test/emby",
      serverId: "s",
      userId: "u",
      token: "secret",
      deviceId: "d",
      name: "QA",
    }),
  );
  let favorite = false;
  let favoritesRequests = 0;
  const item = () => ({
    Id: "m",
    Name: "收藏测试电影",
    Type: "Movie",
    ProductionYear: 2024,
    Genres: ["剧情"],
    CommunityRating: 8.5,
    UserData: { IsFavorite: favorite },
  });
  const fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      let result: unknown = { Items: [], TotalRecordCount: 0 };
      if (url.pathname.includes("/FavoriteItems/")) {
        favorite = !url.pathname.endsWith("/Delete");
        result = { IsFavorite: favorite };
      } else if (url.pathname.endsWith("/Views"))
        result = {
          Items: [
            {
              Id: "lib",
              Name: "测试库",
              Type: "CollectionFolder",
              CollectionType: "movies",
            },
          ],
        };
      else if (url.pathname.endsWith("/Items/m")) result = item();
      else if (url.pathname.endsWith("/Items")) {
        const fav =
          url.searchParams.get("IsFavorite") === "true" ||
          url.searchParams.get("Filters") === "IsFavorite";
        if (fav) favoritesRequests++;
        result = {
          Items: fav && !favorite ? [] : [item()],
          TotalRecordCount: fav && !favorite ? 0 : 1,
        };
      }
      return new Response(JSON.stringify(result));
    },
  );
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "收藏" }));
  await screen.findByText("还没有收藏");
  expect(favoritesRequests).toBe(1);
  await user.click(screen.getByRole("button", { name: "测试库" }));
  await user.click(
    await screen.findByRole("button", {
      name: "查看详情 收藏测试电影",
    }),
  );
  await waitFor(() =>
    expect(document.querySelector(".item-actions")).not.toBeNull(),
  );
  await user.click(
    document.querySelector(
      ".item-actions button:last-of-type",
    ) as HTMLButtonElement,
  );
  await screen.findByRole("button", { name: "取消收藏" });
  await user.click(screen.getByRole("button", { name: "收藏" }));
  await waitFor(() =>
    expect(document.querySelector(".poster-metadata")?.textContent).toBe(
      "2024 · 剧情 · 8.5",
    ),
  );
  expect(favoritesRequests).toBe(2);
  await user.click(
    screen.getByRole("button", { name: "取消收藏 收藏测试电影" }),
  );
  await screen.findByText("还没有收藏");
  expect(favoritesRequests).toBe(3);
  expect(
    fetch.mock.calls.filter(([url]) => String(url).includes("PlaybackInfo")),
  ).toHaveLength(0);
});
