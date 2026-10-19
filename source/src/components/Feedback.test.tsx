// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import TooltipHost from "./TooltipHost";
import Toast from "./Toast";
import RoutePanel from "./RoutePanel";
import { saveRoute } from "../stores/routes";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("delays icon tooltips, clamps to the viewport and dismisses on interaction", () => {
  vi.useFakeTimers();
  render(
    <>
      <TooltipHost />
      <button aria-label="刷新">
        <svg />
      </button>
    </>,
  );
  const button = screen.getByRole("button", { name: "刷新" });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    left: 1000,
    top: 10,
    bottom: 42,
    width: 32,
  } as DOMRect);
  fireEvent.pointerOver(button);
  act(() => vi.advanceTimersByTime(349));
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("tooltip").style.left).toBe("892px");
  expect(screen.getByRole("tooltip").style.top).toBe("50px");
  fireEvent.pointerDown(button);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
it("uses error semantics and does not restart its timeout when the callback changes", () => {
  vi.useFakeTimers();
  const dismissed = vi.fn();
  const view = render(
    <Toast message="同步失败" tone="error" onDismiss={vi.fn()} />,
  );
  expect(screen.getByRole("alert")).toBeTruthy();
  act(() => vi.advanceTimersByTime(3000));
  view.rerender(
    <Toast message="同步失败" tone="error" onDismiss={dismissed} />,
  );
  act(() => vi.advanceTimersByTime(3000));
  expect(dismissed).toHaveBeenCalledOnce();
});
it("closes a nested route Select before its dialog and returns focus on dialog dismissal", async () => {
  const closed = vi.fn(),
    account = {
      server: "https://local.test/emby",
      userId: "u",
      token: "fixture",
      name: "验收",
      deviceId: "d",
      serverId: "s",
    };
  saveRoute(account, {
    name: "backup",
    url: "https://backup.test/emby",
    serverId: "s",
    userId: "u",
  });
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const view = render(
    <RoutePanel account={account} onClose={closed} onSwitch={vi.fn()} />,
  );
  const select = screen.getByRole("combobox", { name: "线路选择" });
  fireEvent.click(select);
  const list = await screen.findByRole("listbox");
  fireEvent.keyDown(list, { key: "Escape" });
  expect(closed).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(select);
  fireEvent.keyDown(select, { key: "Escape" });
  expect(view.container.querySelector(".is-closing")).toBeTruthy();
  await waitFor(() => expect(closed).toHaveBeenCalledOnce());
  view.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
