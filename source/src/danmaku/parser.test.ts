import { expect, it } from "vitest";
import { filterDanmaku, limits, parseDanmaku } from "./parser";
import { danmakuDefaults } from "./types";
const d = (time: number, mode = 1, text = "弹幕", color = 16777215) =>
  `<d p="${time},${mode},25,${color},0,0,0,0">${text}</d>`;
it("reads XML scroll/top/bottom, entities, colors and sorts by media time", () => {
  const result = parseDanmaku(
    "<i>" + d(3, 4) + d(1, 5, "A &amp; B &#x4E2D;", 16711680) + d(2) + "</i>",
    "LOCAL.XML",
  );
  expect(result.entries.map((e) => [e.time, e.mode])).toEqual([
    [1, "top"],
    [2, "scroll"],
    [3, "bottom"],
  ]);
  expect(result.entries[0]).toMatchObject({
    text: "A & B 中",
    color: "#ff0000",
  });
});
it("ignores unsupported advanced modes, invalid times and overlong text", () => {
  const result = parseDanmaku(
    "<i>" + d(-1) + d(0, 7) + d(1, 1, "a".repeat(257)) + d(2) + "</i>",
    "a.xml",
  );
  expect(result.entries).toHaveLength(1);
  expect(result.skipped).toBe(3);
});
it.each([
  "<!DOCTYPE i [<!ENTITY x SYSTEM 'file:///local'>]><i/>",
  "<i><d></i>",
  "<i/><i/>",
  "<i>",
  "<wrong/>",
  "<i a=1/>",
  "<i>" + d(1, 1, "&#x12G;") + "</i>",
  "<i>" + d(1, 1, "A & B") + "</i>",
  "<![CDATA[x]]><i/>",
])("rejects malformed XML/DTD/entities: %s", (input) =>
  expect(() => parseDanmaku(input, "a.xml")).toThrow(),
);
it("handles CDATA as text without markup execution", () =>
  expect(
    parseDanmaku(
      "<i>" + d(1, 1, "<![CDATA[<script>text</script>]]>") + "</i>",
      "a.xml",
    ).entries[0].text,
  ).toBe("<script>text</script>"));
it("rejects byte and record limits, including unsupported records", () => {
  expect(() => parseDanmaku("a".repeat(limits.bytes + 1), "a.xml")).toThrow(
    /8 MiB/,
  );
  expect(() =>
    parseDanmaku("<i>" + d(1, 7).repeat(limits.entries + 1) + "</i>", "a.xml"),
  ).toThrow(/100000/);
});
it("reads ASS timing, fixed alignment, scrolling moves, override/style BGR colors and commas", () => {
  const result = parseDanmaku(
    String.raw`[V4+ Styles]
Format: Name, PrimaryColour, Alignment
Style: Top,&H000000FF,8
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:06.00,Top,,0,0,0,,顶部,文字
Dialogue: 0,0:00:02.00,0:00:10.00,Default,,0,0,0,,{\move(100,0,0,0)\c&H00FF00&}滚动\N文字
Dialogue: 0,0:00:03.00,0:00:08.00,Default,,0,0,0,,{\an2}底部
Dialogue: 0,0:00:04.00,0:00:09.00,Default,,0,0,0,,{\p1}m 0 0 l 1 1`,
    "a.ass",
  );
  expect(
    result.entries.map((e) => [e.mode, e.color, e.text, e.duration]),
  ).toEqual([
    ["top", "#FF0000", "顶部,文字", 5],
    ["scroll", "#00FF00", "滚动 文字", 8],
    ["bottom", "#ffffff", "底部", 5],
  ]);
  expect(result.skipped).toBe(1);
});
it.each(["[Script Info]\nTitle: empty", "[Events]\nFormat: Start, Text, End"])(
  "rejects invalid ASS event formats",
  (s) => expect(() => parseDanmaku(s, "a.ass")).toThrow(),
);
it("filters duplicates within five seconds, colors, fixed types and long text independently", () => {
  const entries = parseDanmaku(
    "<i>" +
      d(0) +
      d(1) +
      d(7) +
      d(8, 5, "top") +
      d(9, 4, "bottom") +
      d(10, 1, "color", 1) +
      d(11, 1, "x".repeat(90)) +
      "</i>",
    "a.xml",
  ).entries;
  expect(
    filterDanmaku(entries, {
      ...danmakuDefaults,
      blockTop: true,
      blockBottom: true,
      blockColor: true,
    }),
  ).toHaveLength(2);
  expect(
    filterDanmaku(entries, {
      ...danmakuDefaults,
      deduplicate: false,
      blockLong: false,
    }),
  ).toHaveLength(7);
});
