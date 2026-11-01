import { expect, it } from "vitest";
import { normalizeSources } from "./sources";
import { sourceChange } from "./sourceUpdates";
const source = {
  id: "custom",
  name: "LogVar",
  protocol: "logvar" as const,
  endpoint: "https://example.invalid",
  priority: 2,
  enabled: true,
  keyRevision: 1,
};
const initial = () => normalizeSources({ mode: "custom", sources: [source] });
it("rejects a changed endpoint rather than submitting an old credential binding", () => {
  const before = initial(),
    plan = sourceChange(before, {
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, name: "Renamed" } : s,
      ),
    });
  expect(() =>
    plan({
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, endpoint: "https://other.invalid" } : s,
      ),
    }),
  ).toThrow("credential-stale");
});
it("same-field conflict preserves the newer source instead of overwriting it", () => {
  const before = initial(),
    plan = sourceChange(before, {
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, priority: 1 } : s,
      ),
    });
  expect(() =>
    plan({
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, priority: 0 } : s,
      ),
    }),
  ).toThrow("credential-stale");
});
it("rollback never resurrects a subsequently removed source", () => {
  const before = initial(),
    change = sourceChange(before, {
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, name: "Renamed" } : s,
      ),
    })(before);
  expect(() => change.rollback(normalizeSources(undefined))).toThrow(
    "credential-stale",
  );
});
it("rollback of a failed deletion restores the latest removed record but keeps later mode and other sources", () => {
  const before = initial(),
    live = {
      ...before,
      sources: before.sources.map((s) =>
        s.id === source.id ? { ...s, priority: 0 } : s,
      ),
    };
  const change = sourceChange(before, normalizeSources(undefined))(live);
  const result = change.rollback({
    ...change.value,
    mode: "auto",
    sources: change.value.sources.map((s) => ({ ...s, enabled: false })),
  });
  expect(result.mode).toBe("auto");
  expect(result.sources.find((s) => s.id === source.id)?.priority).toBe(0);
  expect(result.sources.find((s) => s.id === "dandanplay")?.enabled).toBe(
    false,
  );
});
