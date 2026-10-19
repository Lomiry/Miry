import { it, expect, vi, afterEach } from "vitest";
import {
  PreviewLoader,
  previewPath,
  thumbnailIndex,
  fetchPreviewImage,
} from "./preview";
import { EmbyClient } from "../api/client";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const item = {
  Id: "m",
  Name: "m",
  Type: "Movie",
  Chapters: [{ StartPositionTicks: 0, ImageTag: "chapter", ChapterIndex: 2 }],
};
const api = () =>
  new EmbyClient({
    server: "https://qa.test/emby",
    userId: "u",
    token: "private",
    deviceId: "d",
    name: "QA",
  });
it("reads the real ThumbnailSet schema and uses timestamp plus source, then chapter or time fallback", () => {
  const index = thumbnailIndex({
    Thumbnails: [
      { PositionTicks: 20e7, ImageTag: "same" },
      { PositionTicks: 0, ImageTag: "same" },
      { PositionTicks: -1, ImageTag: "bad" },
      { PositionTicks: 1, ImageTag: "https://bad" },
    ],
  });
  expect(index).toHaveLength(2);
  expect(previewPath(item, "version", index, 25)?.path).toContain(
    "PositionTicks=200000000",
  );
  expect(previewPath(item, "version", [], 25)?.path).toContain(
    "/Images/Chapter/2",
  );
  expect(
    previewPath({ ...item, Chapters: [] }, undefined, [], 25),
  ).toBeUndefined();
});
it("accepts wrapped and direct Trickplay thumbnail responses", () => {
  const sample = { PositionTicks: 0, ImageTag: "tag" };
  expect(thumbnailIndex([sample])).toEqual([sample]);
  expect(thumbnailIndex({ ThumbnailSet: [sample] })).toEqual([sample]);
  expect(thumbnailIndex({ Items: [sample] })).toEqual([sample]);
});
it("retries ThumbnailSet once without a media source for older Emby responses", async () => {
  vi.useFakeTimers();
  const a = api();
  const request = vi
    .spyOn(a, "request")
    .mockResolvedValueOnce({ Thumbnails: [] })
    .mockResolvedValueOnce({
      ThumbnailSet: [{ PositionTicks: 0, ImageTag: "tag" }],
    });
  const image = vi.fn().mockResolvedValue("data:image/jpeg;base64,eA==");
  const loader = new PreviewLoader(a, item, "source", vi.fn(), image);
  loader.request(1);
  await vi.advanceTimersByTimeAsync(200);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][1]).toMatchObject({ MediaSourceId: "source" });
  expect(request.mock.calls[1][1]).not.toHaveProperty("MediaSourceId");
  loader.dispose();
});
it("coalesces a rapid sweep, caches one request, and never seeks video", async () => {
  vi.useFakeTimers();
  const a = api(),
    metadata = vi.spyOn(a, "request").mockResolvedValue({
      Thumbnails: [{ PositionTicks: 0, ImageTag: "tag" }],
    }),
    image = vi.fn().mockResolvedValue("data:image/jpeg;base64,eA=="),
    publish = vi.fn();
  const loader = new PreviewLoader(a, item, "source", publish, image);
  for (let i = 0; i < 100; i++) loader.request(i / 10);
  await vi.advanceTimersByTimeAsync(200);
  expect(image).toHaveBeenCalledOnce();
  expect(metadata).toHaveBeenCalledOnce();
  expect(publish).toHaveBeenLastCalledWith({
    time: 9.9,
    dataUrl: "data:image/jpeg;base64,eA==",
    kind: "thumbnail",
  });
  loader.request(8);
  await vi.advanceTimersByTimeAsync(200);
  expect(image).toHaveBeenCalledOnce();
  loader.dispose();
});
it("aborts slow obsolete images and ignores a late response after dispose", async () => {
  vi.useFakeTimers();
  const a = api();
  vi.spyOn(a, "request").mockResolvedValue({
    Thumbnails: [
      { PositionTicks: 0, ImageTag: "a" },
      { PositionTicks: 20e7, ImageTag: "b" },
    ],
  });
  let finish!: (v: string) => void;
  const signals: AbortSignal[] = [];
  const image = vi.fn((_a, _p, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>((r) => (finish = r));
    }),
    publish = vi.fn();
  const loader = new PreviewLoader(a, item, undefined, publish, image);
  loader.request(1);
  await vi.advanceTimersByTimeAsync(150);
  loader.request(25);
  expect(signals[0].aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(150);
  loader.dispose();
  finish("data:image/jpeg;base64,eA==");
  await vi.advanceTimersByTimeAsync(0);
  expect(signals[1].aborted).toBe(true);
  expect(publish.mock.calls.every(([v]) => !v?.dataUrl)).toBe(true);
});
it("falls back to chapter after an unsupported server API", async () => {
  vi.useFakeTimers();
  const a = api();
  vi.spyOn(a, "request").mockRejectedValue(Error("404"));
  const publish = vi.fn(),
    image = vi.fn().mockResolvedValue("data:image/jpeg;base64,eA=="),
    loader = new PreviewLoader(a, item, undefined, publish, image);
  loader.request(15);
  await vi.advanceTimersByTimeAsync(200);
  expect(publish).toHaveBeenLastCalledWith({
    time: 15,
    dataUrl: "data:image/jpeg;base64,eA==",
    kind: "chapter",
  });
  loader.dispose();
});
it("limits image bytes and sends credentials only in headers", async () => {
  const transport = vi.fn().mockResolvedValue(
    new Response(new Uint8Array(256 * 1024 + 1), {
      headers: { "content-type": "image/jpeg" },
    }),
  );
  vi.stubGlobal("fetch", transport);
  await expect(
    fetchPreviewImage(
      api(),
      "/Items/m/Images/Thumbnail",
      new AbortController().signal,
    ),
  ).rejects.toThrow("too large");
  expect(transport.mock.calls[0][0]).not.toContain("private");
  expect(transport.mock.calls[0][1].headers["X-Emby-Token"]).toBe("private");
});
it("caps the preview cache and cancels a hovered image after its timeout", async () => {
  vi.useFakeTimers();
  const a = api();
  vi.spyOn(a, "request").mockResolvedValue({
    Thumbnails: Array.from({ length: 30 }, (_, i) => ({
      PositionTicks: i * 1e7,
      ImageTag: "same",
    })),
  });
  const image = vi.fn().mockResolvedValue("data:image/jpeg;base64,eA=="),
    loader = new PreviewLoader(a, item, undefined, vi.fn(), image);
  for (let i = 0; i < 25; i++) {
    loader.request(i);
    await vi.advanceTimersByTimeAsync(200);
  }
  loader.request(0);
  await vi.advanceTimersByTimeAsync(200);
  expect(image).toHaveBeenCalledTimes(26);
  loader.dispose();
  let signal!: AbortSignal;
  const stalled = new PreviewLoader(
    a,
    item,
    undefined,
    vi.fn(),
    (_a, _p, s) => {
      signal = s;
      return new Promise(() => {});
    },
  );
  stalled.request(0);
  await vi.advanceTimersByTimeAsync(2000);
  expect(signal.aborted).toBe(true);
  stalled.dispose();
});
