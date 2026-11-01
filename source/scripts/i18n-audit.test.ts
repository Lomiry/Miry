import { expect, it } from "vitest";
// @ts-expect-error JavaScript audit intentionally runs directly in Node.
import { auditI18n, placeholders } from "./i18n-audit.mjs";
it("checks catalog parity, duplicate keys, placeholders, call sites and classified source text", () => {
  const result = auditI18n();
  expect(result.keys).toBeGreaterThan(700);
  expect(result.issues).toEqual([]);
  expect(
    result.exceptions.every((entry: { reason?: string }) => entry.reason),
  ).toBe(true);
});
it("recognizes plural syntax without treating literal plural forms as parameters", () => {
  expect(
    placeholders(
      "{count} {count, plural, one {item} other {items}} for {name}",
    ),
  ).toEqual(["count", "name"]);
});
