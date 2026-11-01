// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import MediaDetail from "./MediaDetail";
import SettingsPanel from "./SettingsPanel";
import { EmbyClient } from "../api/client";
import {
  applySettingsUpdate,
  readSettings,
  saveSettings,
} from "../stores/settings";
import type { Item } from "../types/emby";
import { pickSelect } from "../testSelect";
import { setLanguage, t } from "../i18n/core";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
const client = new EmbyClient({
  server: "https://fixture.test",
  userId: "u",
  token: "fictional",
  name: "Fixture",
  deviceId: "d",
});
const item: Item = {
  Id: "movie",
  Name: "Fixture movie",
  Type: "Movie",
  MediaSources: [
    {
      Id: "small",
      Name: "HD",
      Bitrate: 40000000,
      MediaStreams: [
        { Type: "Video", Index: 0, Height: 1080 },
        { Type: "Audio", Index: 8, DisplayTitle: "HD Audio" },
      ],
    },
    {
      Id: "large",
      Name: "UHD",
      Bitrate: 20000000,
      MediaStreams: [
        { Type: "Video", Index: 0, Height: 2160 },
        { Type: "Audio", Index: 1, DisplayTitle: "Audio A" },
        { Type: "Audio", Index: 2, DisplayTitle: "Audio B" },
        { Type: "Subtitle", Index: 0, DisplayTitle: "Sub A" },
      ],
    },
  ],
};
beforeEach(() => {
  localStorage.clear();
  setLanguage("zh-CN", false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function detail(media = item, onPlay = vi.fn().mockResolvedValue(undefined)) {
  return {
    onPlay,
    ...render(
      <MediaDetail
        key={media.Id}
        item={media}
        api={client}
        saved={false}
        onPlay={onPlay}
        onLater={vi.fn()}
        onChange={vi.fn()}
        onPerson={vi.fn()}
      />,
    ),
  };
}
it("mounts three independent selectors above the primary play action", () => {
  detail();
  for (const key of [
    "detail.source",
    "detail.subtitle",
    "detail.audio",
  ] as const)
    expect(screen.getByRole("combobox", { name: t(key) })).toBeTruthy();
  expect(
    screen.getByRole("combobox", { name: t("detail.source") }).textContent,
  ).toContain("UHD");
  const controls = screen.getByRole("group", {
    name: t("detail.playback_choices"),
  });
  expect(
    controls.compareDocumentPosition(
      screen.getByRole("button", { name: t("library.play") }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it("disables unavailable choices without blocking default playback", async () => {
  const { onPlay } = detail({ ...item, MediaSources: [] });
  for (const control of screen.getAllByRole("combobox"))
    expect((control as HTMLButtonElement).disabled).toBe(true);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: t("library.play") }));
  expect(onPlay).toHaveBeenCalledWith(
    expect.objectContaining({ Id: item.Id }),
    false,
    undefined,
    expect.any(AbortSignal),
  );
});
it("applies actual clicked audio/subtitle choices to the current source", async () => {
  const { onPlay } = detail();
  const user = userEvent.setup();
  await pickSelect(
    user,
    screen.getByRole("combobox", { name: t("detail.audio") }),
    "2",
  );
  await pickSelect(
    user,
    screen.getByRole("combobox", { name: t("detail.subtitle") }),
    "0",
  );
  expect(screen.getByText(t("detail.selection_ready"))).toBeTruthy();
  await user.click(screen.getByRole("button", { name: t("library.play") }));
  expect(onPlay).toHaveBeenCalledWith(
    item,
    false,
    "large",
    expect.any(AbortSignal),
    { sourceId: "large", audioIndex: 2, subtitleIndex: 0 },
  );
});
it("manual source overrides automatic ranking and resets incompatible track choices", async () => {
  const { onPlay } = detail();
  const user = userEvent.setup();
  await pickSelect(
    user,
    screen.getByRole("combobox", { name: t("detail.audio") }),
    "2",
  );
  await pickSelect(
    user,
    screen.getByRole("combobox", { name: t("detail.source") }),
    "small",
  );
  expect(
    screen
      .getByRole("combobox", { name: t("detail.audio") })
      .getAttribute("data-value"),
  ).toBe("");
  await user.click(screen.getByRole("button", { name: t("library.play") }));
  expect(onPlay).toHaveBeenCalledWith(
    item,
    false,
    "small",
    expect.any(AbortSignal),
  );
});
it("locks only the preparation controls, prevents duplicate starts, and reports failure", async () => {
  let reject!: (e: Error) => void;
  const onPlay = vi.fn(() => new Promise<void>((_, r) => (reject = r)));
  detail(item, onPlay);
  const user = userEvent.setup();
  await user.dblClick(screen.getByRole("button", { name: t("library.play") }));
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(
    (
      screen.getByRole("combobox", {
        name: t("detail.source"),
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  reject(new Error("Controlled preparation failure"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Controlled preparation failure",
    ),
  );
  expect(
    (
      screen.getByRole("combobox", {
        name: t("detail.source"),
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
it("persists the selected source policy and retains unrelated false/zero settings", async () => {
  saveSettings({ ...readSettings(), volume: 0, autoNext: false });
  function Harness() {
    const [settings, setSettings] = useState(readSettings);
    return (
      <SettingsPanel
        api={null}
        settings={settings}
        onChange={(update) => setSettings(applySettingsUpdate(update))}
        onClose={() => {}}
      />
    );
  }
  render(<Harness />);
  await pickSelect(
    userEvent.setup(),
    screen.getByRole("combobox", { name: t("detail.best_source_policy") }),
    "bitrate",
  );
  expect(readSettings()).toMatchObject({
    sourcePreference: "bitrate",
    volume: 0,
    autoNext: false,
  });
  cleanup();
  detail();
  expect(
    screen.getByRole("combobox", { name: t("detail.source") }).textContent,
  ).toContain("HD");
});
it("new media starts with fresh source-bound track choices", async () => {
  const { unmount, onPlay } = detail();
  const user = userEvent.setup();
  await pickSelect(
    user,
    screen.getByRole("combobox", { name: t("detail.subtitle") }),
    "-1",
  );
  unmount();
  detail({ ...item, Id: "movie-b" }, onPlay);
  expect(
    screen
      .getByRole("combobox", { name: t("detail.subtitle") })
      .getAttribute("data-value"),
  ).toBe("");
});
