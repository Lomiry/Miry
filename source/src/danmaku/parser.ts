import type {
  DanmakuDocument,
  DanmakuEntry,
  DanmakuMode,
  DanmakuSettings,
} from "./types";
export const limits = {
  bytes: 8 * 1024 * 1024,
  entries: 100000,
  text: 256,
  time: 86400,
};
function clean(text: string) {
  return text
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function entry(
  time: number,
  text: string,
  mode: DanmakuMode,
  color = "#ffffff",
  duration = 8,
): DanmakuEntry | undefined {
  text = clean(text);
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    time > limits.time ||
    !text ||
    Array.from(text).length > limits.text
  )
    return;
  return {
    time,
    text,
    mode,
    color,
    duration: Math.max(1, Math.min(12, duration || 8)),
  };
}
function entities(text: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(text))
    throw Error("XML 实体无效。");
  return text.replace(/&([^;]+);/g, (_, name: string) => {
    const known: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    if (name in known) return known[name];
    const n = /^#x[0-9a-fA-F]+$/.test(name)
      ? parseInt(name.slice(2), 16)
      : /^#\d+$/.test(name)
        ? Number(name.slice(1))
        : NaN;
    if (
      !Number.isInteger(n) ||
      n <= 0 ||
      n > 0x10ffff ||
      (n >= 0xd800 && n <= 0xdfff)
    )
      throw Error("XML 实体无效。");
    return String.fromCodePoint(n);
  });
}
function xml(text: string): DanmakuDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw Error("XML 不允许 DTD 或外部实体。");
  const tokens =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][^<>]*>|[^<]+/g;
  const stack: string[] = [],
    entries: DanmakuEntry[] = [];
  let pos = 0,
    root = false,
    closed = false,
    record: { p: string; text: string } | null = null,
    seen = 0,
    skipped = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index !== pos) throw Error("XML 结构不完整。");
    const token = match[0];
    pos += token.length;
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      if (!stack.length) throw Error("XML 根节点外包含数据。");
      if (record) record.text += token.slice(9, -3);
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      if (stack.pop() !== name) throw Error("XML 标签不匹配。");
      if (name === "d" && record) {
        if (++seen > limits.entries) throw Error("弹幕数量超过 100000 条。");
        const p = record.p.split(","),
          mode =
            p[1] === "4"
              ? "bottom"
              : p[1] === "5"
                ? "top"
                : ["1", "2", "3"].includes(p[1])
                  ? "scroll"
                  : null;
        const number = Number(p[3]),
          color =
            Number.isInteger(number) && number >= 0 && number <= 0xffffff
              ? "#" + number.toString(16).padStart(6, "0")
              : "#ffffff";
        const value = mode
          ? entry(Number(p[0]), record.text, mode, color)
          : undefined;
        if (value) entries.push(value);
        else skipped++;
        record = null;
      }
      if (!stack.length) closed = true;
    } else if (token.startsWith("<")) {
      if (closed) throw Error("XML 包含多个根节点。");
      const self = token.endsWith("/>"),
        body = token.slice(1, self ? -2 : -1).trim(),
        name = body.match(/^[\w:.-]+/)?.[0];
      if (!name) throw Error("XML 标签无效。");
      if (!stack.length) {
        if (root || name !== "i") throw Error("请选择 Bilibili XML 文件。");
        root = true;
      }
      if (stack.length > 16) throw Error("XML 嵌套过深。");
      const attributes = body.slice(name.length),
        attrs: Record<string, string> = {};
      let at = 0;
      const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      for (const a of attributes.matchAll(re)) {
        if (attributes.slice(at, a.index).trim() || a[1] in attrs)
          throw Error("XML 属性无效。");
        attrs[a[1]] = entities(a[3] ?? a[4]);
        at = a.index! + a[0].length;
      }
      if (attributes.slice(at).trim()) throw Error("XML 属性须加引号。");
      if (name === "d") {
        if (record || stack.at(-1) !== "i") throw Error("XML 弹幕结构无效。");
        record = { p: attrs.p || "", text: "" };
      }
      if (!self) stack.push(name);
      else if (name === "i") closed = true;
    } else {
      if (!stack.length && token.trim()) throw Error("XML 根节点外包含文本。");
      const value = entities(token);
      if (record) record.text += value;
    }
  }
  if (pos !== text.length || stack.length || !root || !closed || record)
    throw Error("XML 文件不完整。");
  return { entries, skipped, format: "XML" };
}
function fields(text: string, count: number) {
  const result: string[] = [];
  let at = 0;
  for (let i = 0; i < count - 1; i++) {
    const n = text.indexOf(",", at);
    if (n < 0) return [];
    result.push(text.slice(at, n).trim());
    at = n + 1;
  }
  result.push(text.slice(at));
  return result;
}
function assTime(s: string) {
  const m = s.trim().match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
}
function assColor(s: string | undefined) {
  const m = s?.match(
    /&H(?:[0-9a-f]{2})?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})&?/i,
  );
  return m ? "#" + m[3] + m[2] + m[1] : "#ffffff";
}
function ass(text: string): DanmakuDocument {
  let section = "",
    eventFormat = [
      "layer",
      "start",
      "end",
      "style",
      "name",
      "marginl",
      "marginr",
      "marginv",
      "effect",
      "text",
    ],
    styleFormat: string[] = [],
    seen = 0,
    skipped = 0,
    events = false;
  const entries: DanmakuEntry[] = [],
    styles = new Map<string, { color: string; align: number }>();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      section = s.toLowerCase();
      continue;
    }
    if (s.startsWith(";") || !s) continue;
    const colon = s.indexOf(":");
    if (colon < 0) continue;
    const kind = s.slice(0, colon).toLowerCase(),
      value = s.slice(colon + 1).trim();
    if (section === "[events]") {
      events = true;
      if (kind === "format") {
        eventFormat = value
          .toLowerCase()
          .split(",")
          .map((v) => v.trim());
        if (
          !["start", "end", "text"].every((k) => eventFormat.includes(k)) ||
          eventFormat.at(-1) !== "text"
        )
          throw Error("ASS 事件格式无效。");
      }
      if (kind !== "dialogue") continue;
      if (++seen > limits.entries) throw Error("弹幕数量超过 100000 条。");
      const f = fields(value, eventFormat.length);
      if (!f.length) {
        skipped++;
        continue;
      }
      const get = (k: string) => f[eventFormat.indexOf(k)] || "",
        start = assTime(get("start")),
        end = assTime(get("end")),
        raw = get("text");
      if (/\\p[1-9]/i.test(raw) || !Number.isFinite(end) || end <= start) {
        skipped++;
        continue;
      }
      const style = styles.get(get("style")),
        align = Number(raw.match(/\\an([1-9])/i)?.[1] || style?.align || 2);
      const moving = /\\move\s*\(/i.test(raw),
        mode: DanmakuMode = moving
          ? "scroll"
          : align >= 7
            ? "top"
            : align <= 3
              ? "bottom"
              : "scroll";
      const color = assColor(
        raw.match(/\\(?:1?c)(&H[0-9a-f]+&?)/i)?.[1] || style?.color,
      );
      const result = entry(
        start,
        raw.replace(/\{[^}]*\}/g, "").replace(/\\[Nnh]/g, " "),
        mode,
        color,
        end - start,
      );
      if (result) entries.push(result);
      else skipped++;
    } else if (section === "[v4+ styles]" || section === "[v4 styles]") {
      if (kind === "format")
        styleFormat = value
          .toLowerCase()
          .split(",")
          .map((v) => v.trim());
      if (kind === "style" && styles.size < 256) {
        const f = fields(value, styleFormat.length),
          get = (k: string) => f[styleFormat.indexOf(k)];
        if (f.length && get("name"))
          styles.set(get("name"), {
            color: get("primarycolour") || "",
            align: Number(get("alignment") || 2),
          });
      }
    }
  }
  if (!events) throw Error("ASS 文件缺少 Events 数据。");
  return { entries, skipped, format: "ASS" };
}
export function parseDanmaku(text: string, name: string): DanmakuDocument {
  if (new TextEncoder().encode(text).byteLength > limits.bytes)
    throw Error("弹幕文件须小于 8 MiB。");
  const parsed = /\.xml$/i.test(name)
    ? xml(text.trimStart())
    : /\.ass$/i.test(name)
      ? ass(text)
      : (() => {
          throw Error("仅支持 XML 与 ASS。");
        })();
  parsed.entries.sort((a, b) => a.time - b.time);
  return parsed;
}
export function filterDanmaku(entries: DanmakuEntry[], s: DanmakuSettings) {
  const last = new Map<string, number>();
  return entries.filter((e) => {
    if (
      (s.blockTop && e.mode === "top") ||
      (s.blockBottom && e.mode === "bottom") ||
      (s.blockColor && e.color.toLowerCase() !== "#ffffff") ||
      (s.blockLong && Array.from(e.text).length > 80)
    )
      return false;
    if (s.deduplicate) {
      const previous = last.get(e.text);
      last.set(e.text, e.time);
      if (previous !== undefined && e.time - previous < 5) return false;
    }
    return true;
  });
}
