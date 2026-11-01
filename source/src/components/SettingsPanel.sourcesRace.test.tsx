// @vitest-environment jsdom
import { StrictMode, useEffect, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import SettingsPanel from "./SettingsPanel";
import {
  readSettings,
  saveSettings,
  applySettingsUpdate,
  type Settings,
} from "../stores/settings";
import { normalizeDanmaku } from "../danmaku/types";
import { normalizeSources } from "../danmaku/sources";
import userEvent from "@testing-library/user-event";
import { pickSelect } from "../testSelect";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const saveGate = () => deferred<{ state: string; transaction: string }>();
let saving = saveGate(),
  finishing = deferred<unknown>(),
  holdFinish = false;
const custom = {
  id: "custom",
  name: "LogVar",
  protocol: "logvar" as const,
  endpoint: "https://example.invalid",
  enabled: true,
  priority: 2,
  keyRevision: 1,
};
function Harness() {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    const update = () => setSettings(readSettings());
    window.addEventListener("miry-settings-changed", update);
    return () => window.removeEventListener("miry-settings-changed", update);
  }, []);
  return (
    <>
      <SettingsPanel
        api={null}
        initialSection="subtitles"
        settings={settings}
        onChange={(update) => {
          setSettings(applySettingsUpdate(update));
        }}
        onClose={() => {}}
      />
      <output data-testid="memory">{JSON.stringify(settings)}</output>
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  saving = saveGate();
  finishing = deferred();
  holdFinish = false;
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: normalizeSources({ mode: "auto", sources: [custom] }),
    }),
  });
  vi.mocked(invoke)
    .mockReset()
    .mockImplementation(async (_cmd, raw) => {
      const a = raw as { action: string };
      if (a.action === "status") return { state: "saved" };
      if (["save", "delete", "clear"].includes(a.action)) return saving.promise;
      if (a.action === "finish" && holdFinish) return finishing.promise;
      return { state: "finished" };
    });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function begin(action = "save", token?: string, strict = false) {
  render(
    strict ? (
      <StrictMode>
        <Harness />
      </StrictMode>
    ) : (
      <Harness />
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText("正在读取凭据状态…")).toBeNull(),
  );
  if (action === "delete") {
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    return;
  }
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  fireEvent.change(screen.getByLabelText("名称"), {
    target: { value: "Renamed" },
  });
  if (token)
    fireEvent.change(screen.getByLabelText("普通TOKEN（留空保留已保存密钥）"), {
      target: { value: token },
    });
  fireEvent.click(screen.getByRole("button", { name: "保存来源" }));
  expect(
    vi
      .mocked(invoke)
      .mock.calls.some(([, a]) => (a as { action: string }).action === "save"),
  ).toBe(true);
}
function concurrent(patch: Partial<NonNullable<Settings["danmaku"]>>) {
  act(() => {
    const current = readSettings();
    saveSettings({
      ...current,
      danmaku: normalizeDanmaku({ ...current.danmaku, ...patch }),
    });
  });
}
const memory = () =>
  JSON.parse(screen.getByTestId("memory").textContent || "{}");
it("real sibling controls retain density and opacity while source saving awaits IPC", async () => {
  await begin();
  await pickSelect(
    userEvent.setup(),
    screen.getByLabelText("同屏弹幕密度"),
    "24",
  );
  fireEvent.change(screen.getByRole("slider", { name: "弹幕透明度" }), {
    target: { value: "0" },
  });
  await complete();
  expect(readSettings().danmaku).toMatchObject({ density: 24, opacity: 0 });
  expect(memory().danmaku).toMatchObject({ density: 24, opacity: 0 });
});
it("a failed metadata write does not undo previously persisted concurrent settings", async () => {
  await begin();
  concurrent({ density: 24, blockColor: true });
  const raw = localStorage.getItem("miry-settings");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage unavailable");
  });
  await complete();
  expect(localStorage.getItem("miry-settings")).toBe(raw);
  expect(memory().danmaku).toMatchObject({ density: 24, blockColor: true });
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "rollback" }),
  );
  expect(screen.getByText(/来源保存失败：本地设置不可写/)).toBeTruthy();
});
it("preserves density changed while the native source save is pending in memory and storage", async () => {
  await begin();
  concurrent({ density: 24 });
  await act(async () => {
    saving.resolve({ state: "saved", transaction: crypto.randomUUID() });
  });
  expect(readSettings().danmaku?.density).toBe(24);
  expect(memory().danmaku.density).toBe(24);
  expect(
    readSettings().danmaku?.sources?.sources.find((s) => s.id === "custom")
      ?.name,
  ).toBe("Renamed");
});
const sourcesNow = () => normalizeSources(readSettings().danmaku?.sources);
const currentSource = () => sourcesNow().sources.find((s) => s.id === "custom");
async function complete() {
  await act(async () => {
    saving.resolve({ state: "saved", transaction: crypto.randomUUID() });
  });
}
it("retains a priority update committed while saving", async () => {
  await begin();
  concurrent({
    sources: normalizeSources({
      ...sourcesNow(),
      sources: sourcesNow().sources.map((s) =>
        s.id === "custom" ? { ...s, priority: 0 } : s,
      ),
    }),
  });
  await complete();
  expect(currentSource()).toMatchObject({ name: "Renamed", priority: 0 });
  expect(
    memory().danmaku.sources.sources.find(
      (s: { id: string }) => s.id === "custom",
    ).priority,
  ).toBe(0);
});
it.each(["auto", "custom", "dandanplay"])(
  "retains mode %s selected while saving",
  async (mode) => {
    const initial = sourcesNow();
    saveSettings({
      ...readSettings(),
      danmaku: normalizeDanmaku({
        ...readSettings().danmaku,
        sources: { ...initial, mode: mode === "auto" ? "custom" : "auto" },
      }),
    });
    await begin();
    concurrent({ sources: normalizeSources({ ...sourcesNow(), mode }) });
    await complete();
    expect(sourcesNow().mode).toBe(mode);
    expect(memory().danmaku.sources.mode).toBe(mode);
    expect(currentSource()?.name).toBe("Renamed");
  },
);
it("retains consecutive filtering, density, explicit false and zero writes", async () => {
  await begin();
  concurrent({ density: 24, deduplicate: true });
  concurrent({ density: 96, blockLong: true });
  concurrent({ deduplicate: false, opacity: 0, blockColor: true });
  act(() =>
    applySettingsUpdate((current) => ({
      ...current,
      volume: 0,
      autoNext: false,
    })),
  );
  await complete();
  for (const state of [readSettings(), memory()]) {
    expect(state).toMatchObject({
      volume: 0,
      autoNext: false,
      danmaku: {
        density: 96,
        deduplicate: false,
        opacity: 0,
        blockLong: true,
        blockColor: true,
      },
    });
  }
  cleanup();
  render(<Harness />);
  expect(memory()).toMatchObject({
    volume: 0,
    autoNext: false,
    danmaku: { density: 96, opacity: 0, blockLong: true, deduplicate: false },
  });
});
it("preserves concurrent settings when native credential saving fails", async () => {
  await begin();
  concurrent({ density: 24, blockColor: true });
  await act(async () => {
    saving.reject("credential-encrypt");
  });
  for (const state of [readSettings(), memory()])
    expect(state.danmaku).toMatchObject({ density: 24, blockColor: true });
  expect(currentSource()?.name).toBe("LogVar");
  expect(screen.getByText(/Windows用户级加密失败/)).toBeTruthy();
});
it("replaces TOKEN without persisting it or losing concurrent filters", async () => {
  const token = crypto.randomUUID();
  await begin("save", token);
  concurrent({ blockLong: true, opacity: 0 });
  await complete();
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "save", token }),
  );
  expect(readSettings().danmaku).toMatchObject({ blockLong: true, opacity: 0 });
  expect(memory().danmaku).toMatchObject({ blockLong: true, opacity: 0 });
  expect(localStorage.getItem("miry-settings")).not.toContain(token);
  expect(screen.getByTestId("memory").textContent).not.toContain(token);
});
it("deleting a source preserves concurrent mode and filtering changes", async () => {
  const initial = sourcesNow();
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      ...readSettings().danmaku,
      sources: { ...initial, mode: "custom" },
    }),
  });
  await begin("delete");
  concurrent({
    density: 24,
    blockLong: true,
    sources: normalizeSources({ ...sourcesNow(), mode: "auto" }),
  });
  await complete();
  expect(currentSource()).toBeUndefined();
  expect(sourcesNow().mode).toBe("auto");
  for (const state of [readSettings(), memory()])
    expect(state.danmaku).toMatchObject({
      density: 24,
      blockLong: true,
      sources: { mode: "auto" },
    });
  expect(sourcesNow().sources.some((s) => s.id === "dandanplay")).toBe(true);
});
it("rollback restores only owned fields after later priority changes", async () => {
  holdFinish = true;
  await begin();
  await complete();
  concurrent({
    density: 24,
    sources: normalizeSources({
      ...sourcesNow(),
      mode: "dandanplay",
      sources: sourcesNow().sources.map((s) =>
        s.id === "custom" ? { ...s, priority: 0, enabled: false } : s,
      ),
    }),
  });
  await act(async () => {
    finishing.reject("credential-write");
  });
  expect(currentSource()).toMatchObject({
    name: "LogVar",
    priority: 0,
    enabled: false,
    keyRevision: 1,
  });
  expect(readSettings().danmaku?.density).toBe(24);
  expect(memory().danmaku.sources.mode).toBe("dandanplay");
});
it("StrictMode resolves a settings operation once and writes once", async () => {
  await begin("save", undefined, true);
  const write = vi.spyOn(Storage.prototype, "setItem");
  await complete();
  expect(
    write.mock.calls.filter(([key]) => key === "miry-settings"),
  ).toHaveLength(1);
  expect(currentSource()?.name).toBe("Renamed");
});
it("rollback after native confirmation failure preserves later density and mode changes", async () => {
  holdFinish = true;
  await begin();
  await act(async () => {
    saving.resolve({ state: "saved", transaction: crypto.randomUUID() });
  });
  concurrent({
    density: 96,
    sources: normalizeSources({
      ...readSettings().danmaku?.sources,
      mode: "dandanplay",
    }),
  });
  await act(async () => {
    finishing.reject("credential-write");
  });
  expect(readSettings().danmaku?.density).toBe(96);
  expect(memory().danmaku.density).toBe(96);
  expect(readSettings().danmaku?.sources?.mode).toBe("dandanplay");
  expect(
    readSettings().danmaku?.sources?.sources.find((s) => s.id === "custom")
      ?.name,
  ).toBe("LogVar");
});
it("LAN HTTP consent and concurrent settings survive credential confirmation rollback", async () => {
  const current = readSettings();
  saveSettings({
    ...current,
    danmaku: normalizeDanmaku({
      ...current.danmaku,
      sources: normalizeSources({
        mode: "auto",
        sources: [
          {
            ...custom,
            endpoint: "http://192.168.50.1:9321/proxy",
            allowLanHttp: true,
          },
        ],
      }),
    }),
  });
  holdFinish = true;
  await begin("save", crypto.randomUUID());
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "save", allowLanHttp: true }),
  );
  await complete();
  concurrent({ density: 24, blockColor: true });
  await act(async () => {
    finishing.reject("credential-write");
  });
  for (const state of [readSettings(), memory()]) {
    expect(state.danmaku).toMatchObject({ density: 24, blockColor: true });
    expect(
      state.danmaku.sources.sources.find(
        (s: { id: string }) => s.id === "custom",
      ),
    ).toMatchObject({
      allowLanHttp: true,
      name: "LogVar",
      endpoint: "http://192.168.50.1:9321/proxy",
    });
  }
});
