import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
export async function pickSelect(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  value: string | { name: string },
) {
  await user.click(trigger);
  const option =
    typeof value === "string"
      ? screen
          .getAllByRole("option")
          .find((node) => node.dataset.value === value)
      : screen.getByRole("option", value);
  if (!option) throw Error("Missing select value " + value);
  await user.click(option);
}
