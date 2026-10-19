import { isTauri } from "@tauri-apps/api/core";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
export interface PreviewFrame {
  time: number;
  dataUrl?: string;
  kind?: "thumbnail" | "chapter";
}
type Thumbnail = { PositionTicks: number; ImageTag: string };
export function thumbnailIndex(raw: unknown): Thumbnail[] {
  const value = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ("Thumbnails" in raw && raw.Thumbnails) ||
        ("ThumbnailSet" in raw && raw.ThumbnailSet) ||
        ("Items" in raw && raw.Items) ||
        []
      : [];
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 20000)
    .filter(
      (t): t is Thumbnail =>
        !!t &&
        Number.isSafeInteger(t.PositionTicks) &&
        t.PositionTicks >= 0 &&
        typeof t.ImageTag === "string" &&
        /^[\w-]{1,128}$/.test(t.ImageTag),
    )
    .sort((a, b) => a.PositionTicks - b.PositionTicks);
}
export function previewPath(
  item: Item,
  sourceId: string | undefined,
  index: Thumbnail[],
  time: number,
) {
  const ticks = Math.round(Math.max(0, time) * 1e7),
    thumb = index.filter((t) => t.PositionTicks <= ticks).at(-1);
  const q = new URLSearchParams({
    MaxWidth: "320",
    Quality: "75",
    ...(sourceId ? { MediaSourceId: sourceId } : {}),
  });
  if (thumb) {
    q.set("Tag", thumb.ImageTag);
    q.set("PositionTicks", String(thumb.PositionTicks));
    return {
      path: `/Items/${encodeURIComponent(item.Id)}/Images/Thumbnail?${q}`,
      kind: "thumbnail" as const,
    };
  }
  const c = (item.Chapters || [])
    .map((c, i) => ({ ...c, index: c.ChapterIndex ?? i }))
    .filter(
      (c) =>
        c.ImageTag &&
        Number.isFinite(c.StartPositionTicks) &&
        c.StartPositionTicks <= ticks,
    )
    .sort((a, b) => a.StartPositionTicks - b.StartPositionTicks)
    .at(-1);
  if (c && Number.isInteger(c.index) && c.index >= 0 && c.index < 20000) {
    q.set("Tag", c.ImageTag!);
    return {
      path: `/Items/${encodeURIComponent(item.Id)}/Images/Chapter/${c.index}?${q}`,
      kind: "chapter" as const,
    };
  }
}
export async function fetchPreviewImage(
  api: EmbyClient,
  path: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await (isTauri() ? nativeFetch : fetch)(
    api.account.server + path,
    {
      signal,
      headers: {
        "X-Emby-Token": api.account.token,
        Accept: "image/jpeg,image/png,image/webp",
      },
    },
  );
  if (
    !response.ok ||
    !/^image\/(jpeg|png|webp)(?:;|$)/i.test(
      response.headers.get("content-type") || "",
    )
  )
    throw Error("no preview");
  const cap = 256 * 1024;
  if (Number(response.headers.get("content-length")) > cap)
    throw Error("preview too large");
  const reader = response.body?.getReader();
  if (!reader) throw Error("no preview body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > cap) throw Error("preview too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let encoded = "";
  for (let i = 0; i < bytes.length; i += 8192)
    encoded += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${response.headers.get("content-type")!.split(";")[0]};base64,${btoa(encoded)}`;
}
// One active request, latest hover wins; no seeking, frame generation or media reads.
export class PreviewLoader {
  private controller?: AbortController;
  private index?: Thumbnail[];
  private metadata?: Promise<Thumbnail[]>;
  private metadataController?: AbortController;
  private metadataFallbackAttempted = false;
  private sequence = 0;
  private lastRequest = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private cache = new Map<string, string>();
  private dead = false;
  constructor(
    private api: EmbyClient,
    private item: Item,
    private sourceId: string | undefined,
    private publish: (p: PreviewFrame | null) => void,
    private image = fetchPreviewImage,
  ) {}
  request(time: number | null) {
    const seq = ++this.sequence;
    clearTimeout(this.timer);
    this.controller?.abort();
    if (time === null || !Number.isFinite(time) || time < 0) {
      this.publish(null);
      return;
    }
    this.publish({ time });
    this.timer = setTimeout(
      () => void this.load(time, seq),
      Math.max(100, 150 - (Date.now() - this.lastRequest)),
    );
  }
  private async load(time: number, seq: number) {
    if (this.dead || seq !== this.sequence) return;
    this.lastRequest = Date.now();
    const controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      if (!this.index) {
        if (!this.metadata) {
          this.metadataController = new AbortController();
          const metadataTimer = setTimeout(
            () => this.metadataController?.abort(),
            1800,
          );
          this.metadata = this.api
            .request<unknown>(
              `/Items/${encodeURIComponent(this.item.Id)}/ThumbnailSet`,
              { Width: 320, MediaSourceId: this.sourceId },
              undefined,
              this.metadataController.signal,
            )
            .then(thumbnailIndex)
            .catch(() => [])
            .finally(() => clearTimeout(metadataTimer));
        }
        this.index = await this.metadata;
        if (
          !this.index.length &&
          this.sourceId &&
          !this.metadataFallbackAttempted
        ) {
          this.metadataFallbackAttempted = true;
          this.metadataController?.abort();
          this.metadataController = new AbortController();
          const fallbackTimer = setTimeout(
            () => this.metadataController?.abort(),
            1800,
          );
          this.metadata = this.api
            .request<unknown>(
              `/Items/${encodeURIComponent(this.item.Id)}/ThumbnailSet`,
              { Width: 320 },
              undefined,
              this.metadataController.signal,
            )
            .then(thumbnailIndex)
            .catch(() => [])
            .finally(() => clearTimeout(fallbackTimer));
          this.index = await this.metadata;
        }
      }
      if (seq !== this.sequence || this.dead || controller.signal.aborted)
        return;
      let candidate = previewPath(this.item, this.sourceId, this.index, time);
      if (!candidate) return;
      let data = this.cache.get(candidate.path);
      if (!data) {
        try {
          data = await this.image(this.api, candidate.path, controller.signal);
        } catch {
          if (controller.signal.aborted) return;
          candidate = previewPath(this.item, this.sourceId, [], time);
          if (!candidate) return;
          data =
            this.cache.get(candidate.path) ||
            (await this.image(this.api, candidate.path, controller.signal));
        }
        this.cache.set(candidate.path, data);
        if (this.cache.size > 24)
          this.cache.delete(this.cache.keys().next().value!);
      }
      if (seq === this.sequence && !this.dead && !controller.signal.aborted)
        this.publish({ time, dataUrl: data, kind: candidate.kind });
    } catch {
      /* Metadata and thumbnails are optional; time stays available. */
    } finally {
      clearTimeout(timer);
    }
  }
  dispose() {
    this.dead = true;
    ++this.sequence;
    clearTimeout(this.timer);
    this.controller?.abort();
    this.metadataController?.abort();
    this.cache.clear();
  }
}
