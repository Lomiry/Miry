import { describe, it, expect, vi } from "vitest";
import { ApiError, EmbyClient } from "../api/client";
import { resolveQuickPlay } from "./quickPlay";
import type { Item } from "../types/emby";
const show: Item = { Id: "show", Type: "Series", Name: "Show" };
const episode: Item = {
  Id: "ep2",
  Type: "Episode",
  Name: "Episode",
  SeriesId: "show",
  ParentId: "season",
};
function fixture() {
  const api = new EmbyClient({
    server: "https://example.com/emby",
    userId: "user",
    token: "token",
    name: "test",
    deviceId: "d",
  });
  const resume = vi
    .spyOn(api, "request")
    .mockResolvedValue({ Items: [], TotalRecordCount: 0 });
  const next = vi
    .spyOn(api, "nextUp")
    .mockResolvedValue({ Items: [episode], TotalRecordCount: 1 });
  const items = vi
    .spyOn(api, "items")
    .mockResolvedValue({ Items: [episode], TotalRecordCount: 1 });
  return { api, resume, next, items, signal: new AbortController().signal };
}
describe("One click series playback", () => {
  it("resumes the in-progress episode before checking next up", async () => {
    const f = fixture();
    const resumed = {
      ...episode,
      UserData: { PlaybackPositionTicks: 1200000000 },
    };
    f.resume.mockResolvedValue({ Items: [resumed] });
    expect(await resolveQuickPlay(f.api, show, f.signal)).toEqual(resumed);
    expect(f.next).not.toHaveBeenCalled();
    expect(f.resume.mock.calls[0][1]).toMatchObject({
      ParentId: "show",
      Limit: 1,
      Recursive: true,
    });
  });
  it("uses server next-up when no saved progress exists", async () => {
    const f = fixture();
    expect(await resolveQuickPlay(f.api, show, f.signal)).toEqual(episode);
    expect(f.next).toHaveBeenCalledWith("show", f.signal);
    expect(f.items).not.toHaveBeenCalled();
  });
  it("finds the earliest unplayed episode and falls back to first when all played", async () => {
    const f = fixture();
    f.next.mockResolvedValue({ Items: [], TotalRecordCount: 0 });
    f.items.mockResolvedValueOnce({ Items: [], TotalRecordCount: 0 });
    expect(await resolveQuickPlay(f.api, show, f.signal)).toEqual(episode);
    expect(f.items.mock.calls[0][0]).toMatchObject({
      IsPlayed: false,
      SortBy: "ParentIndexNumber,IndexNumber",
      Limit: 1,
    });
    expect(f.items.mock.calls[1][0].IsPlayed).toBeUndefined();
  });
  it("keeps season playback within the selected season", async () => {
    const f = fixture();
    await resolveQuickPlay(
      f.api,
      { Id: "season", Name: "Season", Type: "Season" },
      f.signal,
    );
    expect(f.items.mock.calls[0][0].ParentId).toBe("season");
    expect(f.next).not.toHaveBeenCalled();
  });
  it("falls back for unsupported optional endpoints but preserves auth failures", async () => {
    const f = fixture();
    f.resume.mockRejectedValue(new ApiError("unsupported", 404));
    expect(await resolveQuickPlay(f.api, show, f.signal)).toEqual(episode);
    f.resume.mockRejectedValue(new ApiError("expired", 401));
    await expect(resolveQuickPlay(f.api, show, f.signal)).rejects.toMatchObject(
      { status: 401 },
    );
  });
  it("refuses missing or foreign-series episodes and reports empty shows", async () => {
    const f = fixture();
    f.next.mockResolvedValue({
      Items: [{ ...episode, SeriesId: "other" }],
      TotalRecordCount: 1,
    });
    f.items.mockResolvedValue({
      Items: [{ ...episode, IsMissing: true }],
      TotalRecordCount: 1,
    });
    await expect(resolveQuickPlay(f.api, show, f.signal)).rejects.toThrow(
      "没有可播放",
    );
  });
  it("does not resolve folders for movies and forwards cancellation", async () => {
    const f = fixture();
    expect(
      await resolveQuickPlay(f.api, { ...episode, Type: "Movie" }, f.signal),
    ).toMatchObject({ Type: "Movie" });
    expect(f.resume).not.toHaveBeenCalled();
    f.resume.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(resolveQuickPlay(f.api, show, f.signal)).rejects.toMatchObject(
      { name: "AbortError" },
    );
  });
});
