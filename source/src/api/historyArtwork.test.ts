// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import type { Item } from "../types/emby";
import type { EmbyClient } from "./client";
import { recordHistory, readHistory, removeHistory } from "../stores/history";
import { recoverHistoryArtwork } from "./historyArtwork";
const account = {
  server: "https://a.test/emby",
  userId: "u",
  token: "secret",
  deviceId: "d",
  name: "A",
};
beforeEach(() => localStorage.clear());
it("bounds parallel work, preserves local resume and never re-adds deleted items", async () => {
  for (let n = 0; n < 5; n++)
    recordHistory(account, { Id: String(n), Name: "Movie", Type: "Movie" }, 30);
  const pending: Array<(i: Item) => void> = [];
  const item = vi.fn(
    (id: string) =>
      new Promise<Item>((resolve) =>
        pending.push((i) => resolve({ ...i, Id: id })),
      ),
  );
  const update = vi.fn();
  const run = recoverHistoryArtwork(
    { item } as unknown as EmbyClient,
    account,
    new AbortController().signal,
    update,
  );
  expect(item).toHaveBeenCalledTimes(3);
  removeHistory(account, "4");
  pending.shift()!({
    Id: "4",
    Name: "fresh",
    Type: "Movie",
    BackdropImageTags: ["wide"],
    UserData: { PlaybackPositionTicks: 0 },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(item).toHaveBeenCalledTimes(4);
  while (pending.length) {
    pending.shift()!({
      Id: "",
      Name: "fresh",
      Type: "Movie",
      BackdropImageTags: ["wide"],
    });
    await Promise.resolve();
    await Promise.resolve();
  }
  await run;
  expect(readHistory(account)).toHaveLength(4);
  expect(
    readHistory(account).every(
      (e) => e.item.UserData?.PlaybackPositionTicks === 300000000,
    ),
  ).toBe(true);
  expect(
    readHistory(account).every((e) => e.item.BackdropImageTags?.[0] === "wide"),
  ).toBe(true);
});
it("does not patch history after navigation cancels a request", async () => {
  recordHistory(account, { Id: "1", Name: "Movie", Type: "Movie" });
  let done: (i: Item) => void = () => {};
  const controller = new AbortController(),
    update = vi.fn();
  const item = vi.fn(
    () =>
      new Promise<Item>((resolve) => {
        done = resolve;
      }),
  );
  const run = recoverHistoryArtwork(
    { item } as unknown as EmbyClient,
    account,
    controller.signal,
    update,
  );
  controller.abort();
  done({ Id: "1", Name: "fresh", Type: "Movie", BackdropImageTags: ["wide"] });
  await run;
  expect(update).not.toHaveBeenCalled();
  expect(readHistory(account)[0].item.BackdropImageTags).toBeUndefined();
});
