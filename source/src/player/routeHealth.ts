import type { PlayerSnapshot } from "./playback";
export class RouteHealth {
  private bufferingSince?: number;
  private slowSince?: number;
  private lastError = "";
  private timeouts: number[] = [];
  private nativeTimeouts = 0;
  update(s: PlayerSnapshot, now: number, bitrate?: number) {
    this.timeouts = this.timeouts.filter((t) => now - t < 120000);
    const error = s.error || s.syncError;
    if (Number.isFinite(s.syncTimeouts)) {
      const count = s.syncTimeouts!;
      for (
        let n = 0;
        n < Math.min(3, Math.max(0, count - this.nativeTimeouts));
        n++
      )
        this.timeouts.push(now);
      this.nativeTimeouts = count;
    }
    if (
      error &&
      error !== this.lastError &&
      s.syncTimeouts === undefined &&
      /timeout|timed out|超时/i.test(error)
    )
      this.timeouts.push(now);
    this.lastError = error;
    if (!s.loaded || !s.active || s.paused) {
      this.bufferingSince = undefined;
      this.slowSince = undefined;
      return this.timeouts.length >= 3 ? "连续多次请求超时" : undefined;
    }
    if (s.buffering) {
      this.bufferingSince ??= now;
    } else this.bufferingSince = undefined;
    if (
      bitrate &&
      s.inputRateBps &&
      s.inputRateBps * 8 < bitrate * 0.8 &&
      (s.bufferSeconds ?? Infinity) < 3
    ) {
      this.slowSince ??= now;
    } else this.slowSince = undefined;
    if (this.bufferingSince !== undefined && now - this.bufferingSince >= 15000)
      return "缓冲已持续超过 15 秒";
    if (this.slowSince !== undefined && now - this.slowSince >= 20000)
      return "持续输入吞吐低于媒体码率，缓冲不足";
    return this.timeouts.length >= 3 ? "连续多次请求超时" : undefined;
  }
}
