import { expect, it } from "vitest";
import { parseComments } from "./onlineParser";
import { limits } from "./parser";
it("parses rolling/top/bottom Unicode, emoji and pure text with RGB", () => {
  const d = parseComments({
    comments: [
      { p: "2,1,16711680,user", m: "<script>中文😀</script>" },
      { p: "0,5,255", m: "顶部" },
      { p: "1,4,0", m: "底部" },
      { p: "3,6,16777215", m: "reverse downgraded" },
    ],
  });
  expect(d.entries.map((e) => e.mode)).toEqual([
    "top",
    "bottom",
    "scroll",
    "scroll",
  ]);
  expect(d.entries[2]).toMatchObject({
    color: "#ff0000",
    text: "<script>中文😀</script>",
  });
});
it("rejects malformed schema and invalid/nonfinite time/color/modes/long text", () => {
  expect(() => parseComments({ comments: "bad" })).toThrow();
  const bad = [
    "NaN,1,0",
    "Infinity,1,0",
    "-1,1,0",
    "999999,1,0",
    "1,7,0",
    "1,1,abc",
    "1,1,16777216",
    "1,1,-1",
    "1,1,0.2",
    ",1,0",
  ].map((p) => ({ p, m: "bad" }));
  const d = parseComments({
    comments: [
      ...bad,
      { p: "1,1,0", m: "😀".repeat(257) },
      null,
      { p: "1,1,0", m: 5 },
    ],
  });
  expect(d.entries).toHaveLength(0);
  expect(d.skipped).toBe(bad.length + 3);
});
it("bounds huge count deterministically, preserves raw payload and stable order", () => {
  const row = { p: "1,1,0", m: "hello" },
    comments = Array(limits.entries + 3).fill(row),
    d = parseComments({ comments });
  expect(d.entries).toHaveLength(limits.entries);
  expect(d.skipped).toBe(3);
  expect(row.p).toBe("1,1,0");
});
