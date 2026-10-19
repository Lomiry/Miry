import { afterEach, it, expect, vi } from "vitest";
import { aggregateSearch } from "./aggregate";
import { EmbyClient } from "./client";
const connections = ["a", "b"].map((host) => ({
  remember: false,
  account: {
    server: `https://${host}.test/emby`,
    userId: "u",
    token: host,
    name: host,
    deviceId: "d",
  },
}));
afterEach(() => vi.restoreAllMocks());
it("keeps server identity and pagination when media IDs collide", async () => {
  const items = vi.spyOn(EmbyClient.prototype, "items").mockResolvedValue({
    Items: [{ Id: "same-id", Name: "Movie", Type: "Movie" }],
    TotalRecordCount: 100,
  });
  const groups = await aggregateSearch(
    connections,
    "Movie",
    2,
    new AbortController().signal,
  );
  expect(groups).toHaveLength(2);
  expect(groups[0].connection.account.server).not.toBe(
    groups[1].connection.account.server,
  );
  expect(items.mock.calls[0][0]).toMatchObject({
    SearchTerm: "Movie",
    StartIndex: 60,
  });
});
it("keeps successful results when another server fails", async () => {
  vi.spyOn(EmbyClient.prototype, "items")
    .mockRejectedValueOnce(new Error("离线"))
    .mockResolvedValueOnce({
      Items: [{ Id: "1", Name: "Movie", Type: "Movie" }],
      TotalRecordCount: 1,
    });
  const groups = await aggregateSearch(
    connections,
    "Movie",
    0,
    new AbortController().signal,
  );
  expect(groups[0].error).toBe("离线");
  expect(groups[1].items).toHaveLength(1);
});
it("propagates cancellation instead of reporting a server failure", async () => {
  const controller = new AbortController();
  controller.abort();
  vi.spyOn(EmbyClient.prototype, "items").mockRejectedValue(
    new DOMException("Aborted", "AbortError"),
  );
  await expect(
    aggregateSearch(connections, "Movie", 0, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
it("passes search filters, order and custom server paging to every account", async () => {
  const items = vi
    .spyOn(EmbyClient.prototype, "items")
    .mockResolvedValue({ Items: [], TotalRecordCount: 1703 });
  const groups = await aggregateSearch(
    connections,
    "Movie",
    2,
    new AbortController().signal,
    {
      Limit: 73,
      SortBy: "Runtime,SortName",
      SortOrder: "Descending",
      Genres: "Drama",
      IsPlayed: false,
    },
  );
  expect(items).toHaveBeenCalledTimes(2);
  for (const [q] of items.mock.calls)
    expect(q).toMatchObject({
      SearchTerm: "Movie",
      Limit: 73,
      StartIndex: 146,
      SortBy: "Runtime,SortName",
      SortOrder: "Descending",
      Genres: "Drama",
      IsPlayed: false,
    });
  expect(groups.every((g) => g.hasMore && g.total === 1703)).toBe(true);
});
