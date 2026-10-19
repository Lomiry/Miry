// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NumberField, SettingRow, SwitchField } from "./SettingField";
import Select from "./Select";
afterEach(cleanup);
it("keeps display text inert and associates control descriptions", () => {
  const change = vi.fn();
  render(
    <>
      <SwitchField
        title="开关"
        description="说明"
        checked={false}
        onChange={change}
      />
      <NumberField
        title="数值"
        description="数字说明"
        value={1}
        min={0}
        max={10}
        onChange={change}
      />
      <SettingRow title="选项">
        <Select aria-label="选项">
          <option>自动</option>
        </Select>
      </SettingRow>
    </>,
  );
  fireEvent.click(screen.getByText("开关"));
  fireEvent.click(screen.getByText("数值"));
  fireEvent.click(screen.getByText("选项"));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(document.activeElement).not.toBe(screen.getByRole("spinbutton"));
  expect(
    screen.getByRole("spinbutton").getAttribute("aria-describedby"),
  ).toBeTruthy();
  expect(document.querySelector("label.setting-row")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(change).toHaveBeenCalledWith(true);
});
