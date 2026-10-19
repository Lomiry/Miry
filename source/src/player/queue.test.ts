import { expect, it, vi } from "vitest";
import { buildEpisodeQueue, PlaybackQueue, type QueueAdapter } from "./queue";
import type { Item } from "../types/emby";
import type { PlayerSnapshot } from "./playback";
const episode = (id: string, season: number, index: number): Item => ({
  Id: id,
  Name: id,
  Type: "Episode",
  SeriesId: "series",
  ParentIndexNumber: season,
  IndexNumber: index,
});
const a = episode("a", 1, 2),
  b = episode("b", 1, 3),
  c = episode("c", 2, 1);
const ended = (patch: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  active: false,
  loaded: true,
  title: "a",
  position: 10,
  duration: 10,
  paused: false,
  volume: 75,
  muted: false,
  tracks: [],
  error: "",
  syncError: "",
  finished: true,
  syncComplete: true,
  playSessionId: "session-a",
  ...patch,
});
function fixture() {
  const adapter: QueueAdapter = {
    stop: vi.fn(async () => {}),
    launch: vi.fn(async (item) => `session-${item.Id}`),
    episodes: vi.fn(async () => [c, a, b]),
    autoNext: () => true,
  };
  const update = vi.fn();
  return { adapter, queue: new PlaybackQueue(adapter, update), update };
}
it("plays an ordered collection without extending its last episode into unrelated episodes", async () => {
  const { queue, adapter } = fixture();
  const movie = { Id: "movie", Name: "Movie", Type: "Movie" };
  await queue.playCollection([movie, a, movie, { ...b, IsMissing: true }]);
  expect(queue.state.items.map((i) => i.Id)).toEqual(["movie", "a"]);
  await queue.snapshot(ended({ playSessionId: "session-movie" }));
  expect(queue.state.index).toBe(1);
  await queue.snapshot(ended());
  expect(adapter.episodes).not.toHaveBeenCalled();
  expect(queue.state.index).toBe(1);
});
it("orders episodes across seasons and removes earlier or duplicate episodes", () => {
  expect(
    buildEpisodeQueue(a, [c, b, a, b, episode("old", 1, 1)]).map((i) => i.Id),
  ).toEqual(["a", "b", "c"]);
});
it("waits for final synchronization before starting the next episode once", async () => {
  const { queue, adapter } = fixture();
  await queue.play(a);
  await queue.snapshot(ended({ syncComplete: false }));
  expect(adapter.launch).toHaveBeenCalledTimes(1);
  await Promise.all([queue.snapshot(ended()), queue.snapshot(ended())]);
  expect(adapter.launch).toHaveBeenCalledTimes(2);
  expect(adapter.launch).toHaveBeenLastCalledWith(
    b,
    true,
    expect.any(AbortSignal),
    undefined,
  );
  expect(queue.state.index).toBe(1);
});
it("does not advance after a stop, failure, disabled auto-next or stale session", async () => {
  for (const patch of [
    { finished: false },
    { error: "decode failed" },
    { syncError: "offline" },
    { playSessionId: "stale" },
  ]) {
    const { queue, adapter } = fixture();
    await queue.play(a);
    await queue.snapshot(ended(patch));
    expect(adapter.launch).toHaveBeenCalledTimes(1);
  }
  const { queue, adapter } = fixture();
  adapter.autoNext = () => false;
  await queue.play(a);
  await queue.snapshot(ended());
  expect(adapter.launch).toHaveBeenCalledTimes(1);
});
it("manual stop clears auto advancement even when an old eof snapshot arrives", async () => {
  const { queue, adapter } = fixture();
  await queue.play(a);
  await queue.stop();
  await queue.snapshot(ended());
  expect(adapter.launch).toHaveBeenCalledTimes(1);
});
it("reports queue failures without stopping the video already started", async () => {
  const { queue, adapter } = fixture();
  vi.mocked(adapter.episodes).mockRejectedValue(new Error("offline"));
  await queue.play(a);
  expect(queue.state.items).toEqual([a]);
  await vi.waitFor(() =>
    expect(queue.state.warning).toContain("当前视频仍可播放"),
  );
  expect(adapter.launch).toHaveBeenCalledOnce();
});
it("keeps the current item stable when removing earlier queue items", async () => {
  const { queue } = fixture();
  await queue.play(a);
  await queue.select(1);
  queue.remove(0);
  expect(queue.state.index).toBe(0);
  expect(queue.state.items[0].Id).toBe("b");
  queue.remove(0);
  expect(queue.state.items).toHaveLength(2);
});
it("cancels pending launch and never advances a cancelled queue", async () => {
  const { queue, adapter } = fixture();
  let complete: (s: string) => void = () => {};
  vi.mocked(adapter.launch).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = queue.play(a);
  const assertion = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.waitFor(() => expect(adapter.launch).toHaveBeenCalled());
  queue.cancelAuto();
  complete("session-a");
  await assertion;
  await queue.snapshot(ended());
  expect(adapter.launch).toHaveBeenCalledOnce();
  expect(queue.state.items).toHaveLength(0);
});
it("extends the queue at the end of a server page instead of stopping after 200 items", async () => {
  const { queue, adapter } = fixture();
  vi.mocked(adapter.episodes)
    .mockResolvedValueOnce([a])
    .mockResolvedValueOnce([a, b, c]);
  await queue.play(a);
  await queue.snapshot(ended());
  expect(queue.state.items.map((i) => i.Id)).toEqual(["a", "b", "c"]);
  expect(queue.state.index).toBe(1);
});
it("keeps playback responsive while the episode list is still loading", async () => {
  const { queue, adapter } = fixture();
  let complete: (items: Item[]) => void = () => {};
  vi.mocked(adapter.episodes).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await queue.play(a);
  expect(queue.state.busy).toBe(false);
  expect(queue.state.loading).toBe(true);
  await queue.stop();
  expect(queue.state.loading).toBe(false);
  complete([a, b]);
  await Promise.resolve();
  expect(queue.state.items).toEqual([a]);
});
it("reclaims a native launch that completes after stop before accepting the next item", async () => {
  const { queue, adapter } = fixture();
  let finish!: (session: string) => void;
  const events: string[] = [];
  vi.mocked(adapter.stop).mockImplementation(async () => {
    events.push("stop");
  });
  vi.mocked(adapter.launch)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          events.push("launch-a");
          finish = resolve;
        }),
    )
    .mockImplementation(async (item) => {
      events.push(`launch-${item.Id}`);
      return `session-${item.Id}`;
    });
  const first = queue.play(a);
  const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(events).toContain("launch-a"));
  const stopping = queue.stop();
  const second = queue.play(b);
  expect(events).not.toContain("launch-b");
  finish("session-a");
  await Promise.all([cancelled, stopping, second]);
  expect(events).toEqual([
    "stop",
    "launch-a",
    "stop",
    "stop",
    "stop",
    "launch-b",
  ]);
  expect(queue.state.items[0].Id).toBe("b");
  expect(queue.state.busy).toBe(false);
});
it("serializes fast replacement and stops a failed launch before allowing retry", async () => {
  const { queue, adapter } = fixture();
  vi.mocked(adapter.launch).mockRejectedValueOnce(new Error("IPC failed"));
  await expect(queue.play(a)).rejects.toThrow("IPC failed");
  expect(adapter.stop).toHaveBeenCalledTimes(2);
  expect(queue.state.busy).toBe(false);
  await queue.play(b);
  expect(queue.state.items[0].Id).toBe("b");
});
