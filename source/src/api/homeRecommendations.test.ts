// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  homeRecommendations,
  balanceRecommendations,
  type Recommendation,
} from "./homeRecommendations";
import { EmbyClient } from "./client";
import { recommendationMeta } from "../components/HomeView";
const connection = (id: string) => ({
  account: {
    server: `https://${id}.test/emby`,
    serverId: id,
    userId: "u",
    token: "t",
    name: id,
    deviceId: "d",
  },
  remember: false,
});
afterEach(() => vi.restoreAllMocks());
it("balances sources deterministically and removes duplicate server/item pairs", () => {
  const groups = ["a", "b"].map((id) =>
    Array.from({ length: 12 }, (_, i) => ({
      item: { Id: String(i), Name: "Movie", Type: "Movie" },
      connection: connection(id),
      api: new EmbyClient(connection(id).account),
      category: "电影",
    })),
  );
  const result = balanceRecommendations([...groups, groups[0]]);
  expect(result).toHaveLength(12);
  expect(
    result.filter((e) => e.connection.account.serverId === "a"),
  ).toHaveLength(6);
  expect(balanceRecommendations(groups)).toEqual(result);
});
it("requests random lists once per category and samples again on explicit reload", async () => {
  const request = vi
    .spyOn(EmbyClient.prototype, "items")
    .mockImplementation(async (q) => ({
      Items: [
        {
          Id: String(request.mock.calls.length),
          Name: "Random",
          Type: String(q.IncludeItemTypes),
        },
      ],
      TotalRecordCount: 1,
    }));
  const signal = new AbortController().signal;
  const first = await homeRecommendations([connection("a")], [], signal);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.every(([q]) => q.SortBy === "Random")).toBe(true);
  const second = await homeRecommendations([connection("a")], [], signal);
  expect(request).toHaveBeenCalledTimes(4);
  expect(second[0].item.Id).not.toBe(first[0].item.Id);
});
it("formats existing year/type/rating and omits zero or missing ratings", () => {
  expect(
    recommendationMeta({
      Id: "m",
      Name: "M",
      Type: "Movie",
      ProductionYear: 2024,
      CommunityRating: 8.2,
    }),
  ).toBe("2024 · 电影 · 8.2");
  expect(
    recommendationMeta({
      Id: "m",
      Name: "M",
      Type: "Movie",
      ProductionYear: 2024,
      CommunityRating: 0,
    }),
  ).toBe("2024 · 电影");
});
