// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemActions from "./ItemActions";
import { EmbyClient } from "../api/client";
const api = new EmbyClient({
  server: "https://host.test/emby",
  userId: "user",
  token: "secret",
  name: "Test",
  deviceId: "device",
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("marks an item unplayed using the documented POST delete endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"Played":false}'));
  vi.stubGlobal("fetch", fetch);
  const onChange = vi.fn();
  render(
    <ItemActions
      api={api}
      item={{
        Id: "movie",
        Name: "Movie",
        Type: "Movie",
        UserData: { Played: true },
      }}
      onChange={onChange}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "标为未看" }));
  expect(fetch.mock.calls[0][0]).toContain("/PlayedItems/movie/Delete");
  expect(fetch.mock.calls[0][1].method).toBe("POST");
  expect(onChange).toHaveBeenCalledWith({ Played: false });
});
it("retains server state when a favorite mutation fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
  );
  const onChange = vi.fn();
  render(
    <ItemActions
      api={api}
      item={{ Id: "movie", Name: "Movie", Type: "Movie" }}
      onChange={onChange}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "收藏" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
it("retains the existing favorite when unfavorite fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
  );
  const onChange = vi.fn();
  render(
    <ItemActions
      api={api}
      item={{
        Id: "movie",
        Name: "Movie",
        Type: "Movie",
        UserData: { IsFavorite: true },
      }}
      onChange={onChange}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "取消收藏" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "取消收藏" })).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
