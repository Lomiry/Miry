import type { Item } from "../types/emby";
import type { PlayerSnapshot } from "./playback";
export function buildEpisodeQueue(current: Item, episodes: Item[]): Item[] {
  const sorted = [...episodes]
    .filter(
      (i) =>
        i.Type === "Episode" &&
        (!current.SeriesId || !i.SeriesId || i.SeriesId === current.SeriesId),
    )
    .sort(
      (a, b) =>
        (a.ParentIndexNumber ?? 0) - (b.ParentIndexNumber ?? 0) ||
        (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0),
    );
  const index = sorted.findIndex((i) => i.Id === current.Id);
  const later =
    index >= 0
      ? sorted.slice(index + 1)
      : sorted.filter(
          (i) =>
            i.ParentIndexNumber !== undefined &&
            i.IndexNumber !== undefined &&
            current.ParentIndexNumber !== undefined &&
            current.IndexNumber !== undefined &&
            (i.ParentIndexNumber > current.ParentIndexNumber ||
              (i.ParentIndexNumber === current.ParentIndexNumber &&
                i.IndexNumber > current.IndexNumber)),
        );
  return [
    current,
    ...later.filter(
      (i, n, all) =>
        i.Id !== current.Id && all.findIndex((a) => a.Id === i.Id) === n,
    ),
  ];
}
export interface QueueState {
  items: Item[];
  index: number;
  busy: boolean;
  error: string;
  warning: string;
  loading?: boolean;
}
export interface QueueAdapter {
  launch: (
    item: Item,
    fromStart: boolean,
    signal: AbortSignal,
    sourceId?: string,
  ) => Promise<string>;
  stop: () => Promise<void>;
  episodes: (item: Item, signal: AbortSignal) => Promise<Item[]>;
  autoNext: () => boolean;
}
export class PlaybackQueue {
  state: QueueState = {
    items: [],
    index: 0,
    busy: false,
    error: "",
    warning: "",
  };
  private session = "";
  private controller: AbortController | null = null;
  private epoch = 0;
  private handled = new Set<string>();
  private queueFetch: Promise<void> | null = null;
  private collection = false;
  private operations: Promise<unknown> = Promise.resolve();
  constructor(
    private adapter: QueueAdapter,
    private update: (state: QueueState) => void,
  ) {}
  private publish(patch: Partial<QueueState>) {
    this.state = { ...this.state, ...patch };
    this.update(this.state);
  }
  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const pending = this.operations.then(action, action);
    this.operations = pending.catch(() => {});
    return pending;
  }
  private launch(
    item: Item,
    fromStart: boolean,
    controller: AbortController,
    epoch: number,
    sourceId?: string,
  ) {
    return this.serialize(async () => {
      await this.adapter.stop();
      if (epoch !== this.epoch || controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      try {
        const session = await this.adapter.launch(
          item,
          fromStart,
          controller.signal,
          sourceId,
        );
        if (epoch !== this.epoch || controller.signal.aborted)
          throw new DOMException("Aborted", "AbortError");
        return session;
      } catch (e) {
        // A native launch can finish after cancellation; reclaim it before another launch.
        await this.adapter.stop();
        throw e;
      }
    });
  }
  async play(
    item: Item,
    fromStart = false,
    sourceId?: string,
    signal?: AbortSignal,
  ) {
    const epoch = ++this.epoch;
    this.collection = false;
    this.controller?.abort();
    this.queueFetch = null;
    this.controller = new AbortController();
    const controller = this.controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    this.publish({ busy: true, error: "", warning: "", loading: false });
    this.session = "";
    try {
      const session = await this.launch(
        item,
        fromStart,
        controller,
        epoch,
        sourceId,
      );
      this.session = session;
      this.handled.clear();
      this.publish({ items: [item], index: 0 });
      if (item.Type === "Episode") {
        this.publish({ loading: true });
        this.queueFetch = this.adapter
          .episodes(item, controller.signal)
          .then((episodes) => {
            if (epoch === this.epoch && !controller.signal.aborted)
              this.publish({ items: buildEpisodeQueue(item, episodes) });
          })
          .catch(() => {
            if (epoch === this.epoch && !controller.signal.aborted)
              this.publish({
                warning: "剧集队列暂时无法加载，当前视频仍可播放。",
              });
          })
          .finally(() => {
            if (epoch === this.epoch) {
              this.queueFetch = null;
              this.controller = null;
              this.publish({ loading: false });
            }
          });
      }
    } catch (e) {
      if (epoch === this.epoch)
        this.publish({
          error:
            (e as Error).name === "AbortError"
              ? "已取消播放。"
              : String(e instanceof Error ? e.message : e),
        });
      throw e;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (epoch === this.epoch) {
        if (!this.queueFetch) this.controller = null;
        this.publish({ busy: false });
      }
    }
  }
  async select(index: number, fromStart = false) {
    if (this.state.busy || index < 0 || index >= this.state.items.length)
      return;
    const items = this.state.items;
    const epoch = ++this.epoch;
    this.controller?.abort();
    this.queueFetch = null;
    const controller = new AbortController();
    this.controller = controller;
    this.session = "";
    this.publish({ busy: true, error: "", loading: false });
    try {
      const session = await this.launch(
        items[index],
        fromStart,
        controller,
        epoch,
      );
      if (epoch !== this.epoch) return;
      this.session = session;
      this.publish({ index });
    } catch (e) {
      if (epoch === this.epoch)
        this.publish({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      if (epoch === this.epoch) {
        this.controller = null;
        this.publish({ busy: false });
      }
    }
  }
  async playCollection(items: Item[]) {
    const list = items
      .filter(
        (item, i, all) =>
          ["Movie", "Episode"].includes(item.Type) &&
          !item.IsMissing &&
          !item.IsVirtual &&
          all.findIndex((a) => a.Id === item.Id) === i,
      )
      .slice(0, 200);
    if (!list.length) throw new Error("片单中没有可播放的视频。");
    await this.play(list[0]);
    ++this.epoch;
    this.collection = true;
    this.controller?.abort();
    this.controller = null;
    this.queueFetch = null;
    this.publish({ items: list, index: 0, loading: false });
  }
  async snapshot(snapshot: PlayerSnapshot) {
    if (
      !snapshot.playSessionId ||
      snapshot.playSessionId !== this.session ||
      this.state.busy ||
      snapshot.active ||
      !snapshot.syncComplete ||
      !snapshot.finished ||
      snapshot.error ||
      snapshot.syncError ||
      !this.adapter.autoNext() ||
      this.handled.has(snapshot.playSessionId)
    )
      return;
    this.handled.add(snapshot.playSessionId);
    await this.next(true);
  }
  async next(fromStart = true) {
    if (this.state.busy) return;
    const requestEpoch = this.epoch;
    if (this.queueFetch) await this.queueFetch;
    if (requestEpoch !== this.epoch || this.state.busy) return;
    if (this.state.index + 1 >= this.state.items.length) {
      const current = this.state.items[this.state.index];
      if (!current || current.Type !== "Episode" || this.collection) return;
      const epoch = this.epoch;
      const controller = new AbortController();
      this.controller = controller;
      this.publish({ busy: true, error: "" });
      try {
        const episodes = await this.adapter.episodes(
          current,
          controller.signal,
        );
        if (epoch !== this.epoch || controller.signal.aborted) return;
        const more = buildEpisodeQueue(current, episodes)
          .slice(1)
          .filter((i) => !this.state.items.some((a) => a.Id === i.Id));
        this.publish({ items: [...this.state.items, ...more] });
      } catch (e) {
        if (epoch === this.epoch)
          this.publish({ error: "下一集暂时无法加载，请检查连接后重试。" });
        return;
      } finally {
        if (epoch === this.epoch) {
          this.controller = null;
          this.publish({ busy: false });
        }
      }
    }
    if (this.state.index + 1 < this.state.items.length)
      await this.select(this.state.index + 1, fromStart);
  }
  async stop() {
    const epoch = ++this.epoch;
    this.session = "";
    this.controller?.abort();
    this.controller = null;
    this.queueFetch = null;
    this.publish({ busy: true, error: "", loading: false });
    try {
      await this.serialize(() => this.adapter.stop());
    } catch (e) {
      this.publish({ error: String(e) });
      throw e;
    } finally {
      if (epoch === this.epoch) this.publish({ busy: false });
    }
  }
  remove(index: number) {
    if (this.state.busy || index === this.state.index) return;
    const items = this.state.items.filter((_, i) => i !== index);
    this.publish({
      items,
      index: index < this.state.index ? this.state.index - 1 : this.state.index,
    });
  }
  cancelAuto() {
    this.session = "";
    this.controller?.abort();
    ++this.epoch;
    this.queueFetch = null;
    this.publish({ busy: false, items: [], index: 0, loading: false });
  }
}
