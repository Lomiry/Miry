// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppearanceSettings from "./AppearanceSettings";
import { readAppearance } from "../stores/appearance";
import { pickSelect } from "../testSelect";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("changes and restores theme and size using shared setting fields", async () => {
  const user = userEvent.setup();
  const view = render(<AppearanceSettings />);
  await pickSelect(user, screen.getByLabelText("外观"), "light");
  await pickSelect(user, screen.getByLabelText("界面字号"), "large");
  expect(readAppearance()).toMatchObject({ theme: "light", uiSize: "large" });
  expect(
    screen.getByLabelText("外观").closest(".setting-control"),
  ).toBeTruthy();
  view.unmount();
  render(<AppearanceSettings />);
  expect(screen.getByLabelText("外观").textContent).toBe("浅色");
  expect(screen.getByLabelText("界面字号").textContent).toBe("大");
});
