import type { DanmakuClock, DanmakuEntry, DanmakuSettings } from "./types";
export function lowerBound(entries: DanmakuEntry[], time: number) {
  let low = 0,
    high = entries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (entries[middle].time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}
export function playbackTime(clock: DanmakuClock, now = Date.now()) {
  if (!clock.active || !clock.loaded) return clock.position;
  // A stale native clock stops extrapolation until the next mpv sample arrives.
  const elapsed =
    clock.paused || clock.buffering
      ? 0
      : Math.min(
          1,
          1 / Math.max(0.1, clock.speed),
          Math.max(0, (now - clock.sampledAt) / 1000),
        );
  return clock.position + elapsed * clock.speed;
}
export interface ActiveDanmaku {
  entry: DanmakuEntry;
  start: number;
  end: number;
  lane: number;
  width: number;
  velocity: number;
  x: number;
  y: number;
}
export class DanmakuScheduler {
  active: ActiveDanmaku[] = [];
  index = 0;
  dropped = 0;
  processed = 0;
  private previous = NaN;
  constructor(
    private entries: DanmakuEntry[],
    private settings: DanmakuSettings,
    private width: number,
    private height: number,
    private measure: (text: string) => number,
  ) {}
  reset(time: number) {
    this.active = [];
    this.index = lowerBound(
      this.entries,
      Math.max(0, time - 24 / this.settings.speed),
    );
    this.previous = NaN;
  }
  step(time: number, force = false) {
    if (!Number.isFinite(time)) return [];
    const target = time - this.settings.offset;
    if (
      force ||
      !Number.isFinite(this.previous) ||
      target < this.previous - 0.1 ||
      target - this.previous > 1.5
    )
      this.reset(target);
    this.previous = target;
    this.active = this.active.filter((a) => a.end > target);
    const lineHeight = Math.ceil(this.settings.fontSize * 1.4),
      rows = Math.min(
        40,
        Math.max(
          1,
          Math.floor((this.height * this.settings.area - 16) / lineHeight),
        ),
      );
    let work = 0;
    while (
      this.index < this.entries.length &&
      this.entries[this.index].time <= target &&
      work++ < 500
    ) {
      const e = this.entries[this.index++];
      this.processed++;
      const duration = (2 * e.duration) / this.settings.speed,
        end = e.time + duration;
      if (end <= target || this.active.length >= this.settings.density) {
        this.dropped++;
        continue;
      }
      const width = Math.max(1, this.measure(e.text)),
        velocity = (this.width + width) / duration;
      const lanes = Array.from({ length: rows }, (_, i) =>
        e.mode === "bottom" ? rows - 1 - i : i,
      );
      let lane = -1;
      for (const candidate of lanes) {
        const previous = this.active.filter((a) => a.lane === candidate);
        if (e.mode !== "scroll") {
          if (!previous.length) {
            lane = candidate;
            break;
          }
          continue;
        }
        if (previous.some((a) => a.entry.mode !== "scroll")) continue;
        const safe = previous.every((a) => {
          const right = this.width - (e.time - a.start) * a.velocity + a.width;
          const gap = this.width - right;
          return (
            gap >= 16 &&
            (velocity <= a.velocity ||
              gap / (velocity - a.velocity) > Math.max(0, right / a.velocity))
          );
        });
        if (safe) {
          lane = candidate;
          break;
        }
      }
      if (lane < 0) {
        this.dropped++;
        continue;
      }
      this.active.push({
        entry: e,
        start: e.time,
        end,
        lane,
        width,
        velocity,
        x: 0,
        y: 8 + lane * lineHeight,
      });
    }
    if (
      this.index < this.entries.length &&
      this.entries[this.index].time <= target
    ) {
      const next = lowerBound(this.entries, target + 0.000001);
      this.dropped += next - this.index;
      this.index = next;
    }
    for (const a of this.active)
      a.x =
        a.entry.mode === "scroll"
          ? this.width - (target - a.start) * a.velocity
          : (this.width - a.width) / 2;
    return this.active;
  }
}
