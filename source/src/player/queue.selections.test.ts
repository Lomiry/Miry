import { expect, it, vi } from "vitest";
import { PlaybackQueue, type QueueAdapter } from "./queue";
import type { Item } from "../types/emby";
const episode = (Id: string, IndexNumber: number): Item => ({
  Id,
  Name: Id,
  Type: "Episode",
  SeriesId: "show",
  ParentIndexNumber: 1,
  IndexNumber,
});
it("binds detail choices to the first launch and leaves the next episode on its own policy", async () => {
  const a = episode("a", 1),
    b = episode("b", 2);
  const launch = vi.fn(async (item: Item) => item.Id);
  const adapter: QueueAdapter = {
    launch,
    stop: vi.fn(async () => {}),
    episodes: vi.fn(async () => [a, b]),
    autoNext: () => true,
  };
  const queue = new PlaybackQueue(adapter, () => {});
  const selection = { sourceId: "source-a", audioIndex: 0, subtitleIndex: -1 };
  await queue.play(a, false, "source-a", undefined, selection);
  expect(launch.mock.calls[0]).toEqual([
    a,
    false,
    expect.any(AbortSignal),
    "source-a",
    selection,
  ]);
  await queue.next();
  expect(launch.mock.calls[1]).toEqual([
    b,
    true,
    expect.any(AbortSignal),
    undefined,
  ]);
  expect(adapter.stop).toHaveBeenCalledWith(true);
});
