// @vitest-environment jsdom
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SettingsPanel from "../components/SettingsPanel";
import DanmakuSettings from "../components/DanmakuSettings";
import DanmakuLayer from "../danmaku/DanmakuLayer";
import { danmakuDefaults, type DanmakuDocument } from "../danmaku/types";
import {
  defaults,
  readSettings,
  saveSettings,
  type Settings,
} from "./settings";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const key = "miry-settings";
function seed(opacity: number) {
  const value = {
    ...defaults,
    volume: 42,
    danmaku: { ...danmakuDefaults, opacity },
  };
  localStorage.setItem(key, JSON.stringify(value));
  return localStorage.getItem(key);
}

it.each([0, 0.25, 0.3, 0.37, 0.5, 0.85, 1])(
  "round-trips persisted opacity %s without using its complement",
  (opacity) => {
    seed(opacity);
    saveSettings(readSettings());
    expect(JSON.parse(localStorage.getItem(key)!).danmaku.opacity).toBe(
      opacity,
    );
    expect(readSettings().danmaku?.opacity).toBe(opacity);
    expect(readSettings().volume).toBe(42);
  },
);

it.each([
  [undefined, 0.25],
  [1, 0.3],
  [undefined, 0.37],
])(
  "migrates old speed schema %s once while retaining opacity %s",
  (schema, opacity) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        volume: 42,
        danmaku: { speed: 0.5, speedSchema: schema, opacity },
      }),
    );
    const writes = vi.spyOn(Storage.prototype, "setItem");
    expect(readSettings().danmaku).toMatchObject({
      speed: 1,
      speedSchema: 2,
      opacity,
    });
    const migrated = localStorage.getItem(key);
    expect(JSON.parse(migrated!).danmaku.opacity).toBe(opacity);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(readSettings().danmaku?.opacity).toBe(opacity);
    expect(readSettings().danmaku?.opacity).toBe(opacity);
    expect(localStorage.getItem(key)).toBe(migrated);
    expect(writes).toHaveBeenCalledTimes(1);
  },
);

it("uses the missing-key default in memory without persisting defaults", () => {
  const writes = vi.spyOn(Storage.prototype, "setItem");
  expect(readSettings().danmaku?.opacity).toBe(0.85);
  expect(localStorage.getItem(key)).toBeNull();
  expect(writes).not.toHaveBeenCalled();
});

it("uses a missing opacity default without overwriting the stored object", () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      volume: 42,
      danmaku: { speed: 1, speedSchema: 2 },
    }),
  );
  const raw = localStorage.getItem(key);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  expect(readSettings().danmaku?.opacity).toBe(0.85);
  expect(localStorage.getItem(key)).toBe(raw);
  expect(writes).not.toHaveBeenCalled();
});

it("preserves the existing value and raw bytes across repeated startup reads", async () => {
  const raw = seed(0.37);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  for (let n = 0; n < 3; n++) {
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.readSettings().danmaku?.opacity).toBe(0.37);
    expect(localStorage.getItem(key)).toBe(raw);
  }
  expect(writes).not.toHaveBeenCalled();
});

it.each([0, 0.25, 0.37, 0.5, 0.85, 1])(
  "maps opacity %s to its UI percent without inversion",
  (opacity) => {
    render(
      <DanmakuSettings
        value={{ ...danmakuDefaults, opacity }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("slider", { name: "弹幕透明度" })).toHaveProperty(
      "value",
      String(opacity),
    );
    expect(screen.getByText(`${Math.round(opacity * 100)}%`)).toBeTruthy();
  },
);

function SettingsPage() {
  const [settings, update] = useState(readSettings);
  const change = (value: Settings) => {
    update(value);
    saveSettings(value);
  };
  return (
    <SettingsPanel
      api={null}
      initialSection="subtitles"
      settings={settings}
      onChange={change}
      onClose={() => {}}
    />
  );
}

it("mounts, closes and reopens the settings page without writing defaults", () => {
  const raw = seed(0.25);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const first = render(<SettingsPage />);
  expect(screen.getByText("25%")).toBeTruthy();
  first.unmount();
  render(<SettingsPage />);
  expect(screen.getByText("25%")).toBeTruthy();
  expect(localStorage.getItem(key)).toBe(raw);
  expect(writes).not.toHaveBeenCalled();
});

it.each([0, 0.25, 0.37, 0.5, 0.85, 1])(
  "renders opacity %s as Canvas alpha, without percent inversion",
  (opacity) => {
    let tick: FrameRequestCallback = () => {};
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const context = {
      globalAlpha: 1,
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      measureText: () => ({ width: 80 }),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as never,
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({ width: 800, height: 450 } as DOMRect);
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const document: DanmakuDocument = {
      format: "XML",
      entries: [
        {
          time: 1,
          duration: 8,
          mode: "scroll",
          color: "#ffffff",
          text: "opacity test",
        },
      ],
      skipped: 0,
    };
    render(
      <DanmakuLayer
        document={document}
        settings={{ ...danmakuDefaults, opacity }}
        clock={{
          position: 1,
          sampledAt: 1000,
          session: "opacity-test",
          paused: true,
          speed: 1,
          active: true,
          loaded: true,
          buffering: false,
        }}
      />,
    );
    act(() => tick(0));
    expect(context.globalAlpha).toBe(opacity);
    expect(context.fillText).toHaveBeenCalled();
  },
);

it("exposes 1 percent steps and updates the label and storage during drag", () => {
  render(<SettingsPage />);
  const slider = screen.getByRole("slider", { name: "弹幕透明度" });
  expect(slider.getAttribute("min")).toBe("0");
  expect(slider.getAttribute("max")).toBe("1");
  expect(slider.getAttribute("step")).toBe("0.01");
  fireEvent.pointerDown(slider);
  for (const opacity of [0, 0.25, 0.5, 1, 0.37]) {
    fireEvent.change(slider, { target: { value: String(opacity) } });
    expect(screen.getByText(`${Math.round(opacity * 100)}%`)).toBeTruthy();
    expect(readSettings().danmaku?.opacity).toBe(opacity);
  }
});
