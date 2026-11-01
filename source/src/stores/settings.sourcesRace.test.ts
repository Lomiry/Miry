// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { applySettingsUpdate, readSettings, saveSettings } from "./settings";
import { normalizeDanmaku } from "../danmaku/types";
import { normalizeSources } from "../danmaku/sources";
import { sourceChange } from "../danmaku/sourceUpdates";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
it.each([false, true])(
  "interleaved source metadata operations merge against persisted state (reverse=%s)",
  async (reverse) => {
    const entries = ["first", "second"].map((id, priority) => ({
      id,
      name: id,
      protocol: "logvar" as const,
      endpoint: `https://${id}.invalid`,
      priority,
      enabled: true,
      keyRevision: 1,
    }));
    saveSettings({
      ...readSettings(),
      volume: 0,
      autoNext: false,
      danmaku: normalizeDanmaku({
        sources: normalizeSources({ mode: "auto", sources: entries }),
        opacity: 0,
        deduplicate: false,
      }),
    });
    const initial = normalizeSources(readSettings().danmaku?.sources),
      gates = [deferred(), deferred()];
    let memory = readSettings();
    const operations = entries.map((entry, index) => {
      const plan = sourceChange(initial, {
        ...initial,
        sources: initial.sources.map((s) =>
          s.id === entry.id
            ? { ...s, name: `updated-${entry.id}`, keyRevision: 2 }
            : s,
        ),
      });
      return gates[index].promise.then(() => {
        memory = applySettingsUpdate((current) => ({
          ...current,
          danmaku: normalizeDanmaku({
            ...current.danmaku,
            sources: plan(normalizeSources(current.danmaku?.sources)).value,
          }),
        }));
      });
    });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const order = reverse ? [1, 0] : [0, 1];
    gates[order[0]].resolve();
    await operations[order[0]];
    gates[order[1]].resolve();
    await operations[order[1]];
    const restored = readSettings();
    expect(restored).toEqual(memory);
    expect(restored).toMatchObject({
      volume: 0,
      autoNext: false,
      danmaku: { opacity: 0, deduplicate: false },
    });
    expect(
      restored.danmaku?.sources?.sources
        .filter((s) => s.protocol === "logvar")
        .map((s) => s.name),
    ).toEqual(["updated-first", "updated-second"]);
    expect(
      restored.danmaku?.sources?.sources.some((s) => s.id === "dandanplay"),
    ).toBe(true);
    expect(writes).toHaveBeenCalledTimes(2);
  },
);
it("failed persistence publishes no change event and leaves existing storage intact", () => {
  saveSettings({ ...readSettings(), volume: 0 });
  const raw = localStorage.getItem("miry-settings"),
    changed = vi.fn();
  window.addEventListener("miry-settings-changed", changed);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage unavailable");
  });
  expect(() =>
    applySettingsUpdate((current) => ({ ...current, volume: 100 })),
  ).toThrow();
  expect(localStorage.getItem("miry-settings")).toBe(raw);
  expect(changed).not.toHaveBeenCalled();
  window.removeEventListener("miry-settings-changed", changed);
});
it("a delayed failed confirmation rolls back only its source after another save commits", async () => {
  const sources = ["first", "second"].map((id) => ({
    id,
    name: id,
    protocol: "logvar" as const,
    endpoint: `https://${id}.invalid`,
    enabled: true,
    priority: 1,
    keyRevision: 1,
  }));
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({ sources: { mode: "auto", sources } }),
  });
  const initial = normalizeSources(readSettings().danmaku?.sources),
    confirmations = [deferred(), deferred()];
  let memory = readSettings();
  const commit = (update: (value: typeof initial) => typeof initial) => {
    memory = applySettingsUpdate((current) => ({
      ...current,
      danmaku: normalizeDanmaku({
        ...current.danmaku,
        sources: update(normalizeSources(current.danmaku?.sources)),
      }),
    }));
  };
  const operations = sources.map((source, index) => {
    const plan = sourceChange(initial, {
      ...initial,
      sources: initial.sources.map((s) =>
        s.id === source.id
          ? { ...s, name: `updated-${s.id}`, keyRevision: 2 }
          : s,
      ),
    });
    let undo!: ReturnType<typeof plan>["rollback"];
    commit((live) => {
      const change = plan(live);
      undo = change.rollback;
      return change.value;
    });
    return confirmations[index].promise.then(() => {
      if (index === 0) commit(undo);
    });
  });
  confirmations[1].resolve();
  await operations[1];
  confirmations[0].resolve();
  await operations[0];
  expect(readSettings()).toEqual(memory);
  expect(
    memory.danmaku?.sources?.sources.filter((s) => s.protocol === "logvar"),
  ).toMatchObject([
    { name: "first", keyRevision: 1 },
    { name: "updated-second", keyRevision: 2 },
  ]);
});
