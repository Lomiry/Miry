import {
  normalizeSources,
  type DanmakuSource,
  type SourceSettings,
} from "./sources";
export type SourceUpdate = (current: SourceSettings) => SourceSettings;
const fields = [
  "name",
  "protocol",
  "endpoint",
  "enabled",
  "priority",
  "keyRevision",
  "anonymous",
  "allowLanHttp",
] as const;
const conflict = (): never => {
  throw "credential-stale";
};
export function changedSourceFields(
  before: DanmakuSource,
  after: DanmakuSource,
): Partial<DanmakuSource> {
  return Object.fromEntries(
    fields.filter((f) => before[f] !== after[f]).map((f) => [f, after[f]]),
  );
}
// This plan owns only its delta. It never restores a whole source/settings snapshot.
export function sourceChange(before: SourceSettings, after: SourceSettings) {
  before = normalizeSources(before);
  after = normalizeSources(after);
  return (
    current: SourceSettings,
  ): { value: SourceSettings; rollback: SourceUpdate } => {
    current = normalizeSources(current);
    const sources = [...current.sources];
    const undo: SourceUpdate[] = [];
    const desired = new Map(after.sources.map((s) => [s.id, s]));
    const removed = new Set(
      before.sources.filter((s) => !desired.has(s.id)).map((s) => s.id),
    );
    for (const old of before.sources) {
      const next = desired.get(old.id);
      const changed = next ? fields.filter((f) => old[f] !== next[f]) : [];
      if (next && !changed.length) continue;
      const index = sources.findIndex((s) => s.id === old.id),
        live = sources[index];
      if (
        !live ||
        live.endpoint !== old.endpoint ||
        live.protocol !== old.protocol
      )
        conflict();
      if (!next) {
        sources.splice(index, 1);
        undo.push((latest) => {
          if (latest.sources.some((s) => s.id === old.id)) conflict();
          const restored = [...latest.sources];
          restored.splice(Math.min(index, restored.length), 0, live);
          return { ...latest, sources: restored };
        });
      } else {
        if (changed.some((f) => live[f] !== old[f])) conflict();
        const written = { ...live, ...changedSourceFields(old, next) };
        sources[index] = written;
        undo.push((latest) => {
          const at = latest.sources.findIndex((s) => s.id === old.id),
            now = latest.sources[at];
          if (!now) conflict();
          const restore = Object.fromEntries(
            changed
              .filter((f) => now[f] === written[f])
              .map((f) => [f, live[f]]),
          );
          return {
            ...latest,
            sources: latest.sources.map((s, i) =>
              i === at ? { ...s, ...restore } : s,
            ),
          };
        });
      }
    }
    for (const added of after.sources.filter(
      (s) => !before.sources.some((old) => old.id === s.id),
    )) {
      if (sources.some((s) => s.id === added.id) || sources.length >= 12)
        conflict();
      sources.push(added);
      undo.push((latest) => {
        const now = latest.sources.find((s) => s.id === added.id);
        if (!now || fields.some((f) => now[f] !== added[f])) conflict();
        return {
          ...latest,
          sources: latest.sources.filter((s) => s.id !== added.id),
        };
      });
    }
    let mode = current.mode;
    if (before.mode !== after.mode) {
      if (removed.has(before.mode)) {
        if (mode === before.mode) mode = after.mode;
      } else {
        if (mode !== before.mode) conflict();
        mode = after.mode;
      }
    }
    const modeChanged = mode !== current.mode;
    const value = normalizeSources({ mode, sources });
    return {
      value,
      rollback: (latest) => {
        let result = normalizeSources(latest);
        for (const revert of [...undo].reverse()) result = revert(result);
        if (modeChanged && result.mode === value.mode)
          result = { ...result, mode: current.mode };
        return normalizeSources(result);
      },
    };
  };
}
