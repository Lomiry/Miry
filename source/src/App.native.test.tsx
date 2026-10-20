// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => ({ active: false, title: "" })),
}));
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(async () => new Response("unauthorized", { status: 401 })),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
it("stops native playback when the server revokes the account", async () => {
  localStorage.setItem(
    "miry-settings",
    JSON.stringify({ autoCheckUpdates: false, volume: 42 }),
  );
  sessionStorage.setItem(
    "miry-account",
    JSON.stringify({
      server: "https://host.test/emby",
      userId: "user",
      token: "secret",
      name: "Test",
      deviceId: "device",
    }),
  );
  render(<App />);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("check_release"));
  expect(
    await screen.findByRole("heading", { name: "连接你的媒体库" }),
  ).toBeTruthy();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("player_stop"));
  expect(sessionStorage.getItem("miry-account")).toBeNull();
});
