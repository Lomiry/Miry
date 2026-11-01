// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ControlLayoutSettings from "./ControlLayoutSettings";
import {
  normalizeControlLayout,
  type ControlLayout,
} from "../player/controlLayout";
import { setLanguage } from "../i18n/core";
import { pickSelect } from "../testSelect";
import userEvent from "@testing-library/user-event";
afterEach(() => {
  cleanup();
  setLanguage("zh-CN", false);
});
it("hides, reorders and restores a preset using the same saved configuration", async () => {
  const change = vi.fn();
  function Editor() {
    const [value, setValue] = useState(normalizeControlLayout(undefined));
    return (
      <ControlLayoutSettings
        value={value}
        disabled={false}
        change={(next) => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("checkbox", { name: "音轨" }));
  expect(change).toHaveBeenLastCalledWith({
    preset: "custom",
    buttons: ["volume", "subtitle", "mini", "fullscreen"],
  });
  fireEvent.click(screen.getByRole("button", { name: "上移字幕" }));
  expect(change.mock.lastCall![0].buttons.slice(0, 2)).toEqual([
    "subtitle",
    "volume",
  ]);
  await pickSelect(
    userEvent.setup(),
    screen.getByRole("combobox", { name: "控制栏布局" }),
    "minimal",
  );
  expect(change).toHaveBeenLastCalledWith({
    preset: "minimal",
    buttons: ["volume", "fullscreen"],
  });
});
it.each(["zh-CN", "en-US"] as const)(
  "shows localized configuration and disables editing in %s",
  (language) => {
    setLanguage(language, false);
    const change = vi.fn();
    render(
      <ControlLayoutSettings
        value={{ preset: "custom", buttons: [] } as ControlLayout}
        disabled
        change={change}
      />,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(
      screen
        .getAllByRole("checkbox")
        .every((box) => (box as HTMLInputElement).disabled),
    ).toBe(true);
    expect(
      screen.getByRole("combobox", {
        name: language === "zh-CN" ? "控制栏布局" : "Control layout",
      }),
    ).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
  },
);
