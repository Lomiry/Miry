import { limits } from "./parser";
import type { DanmakuDocument } from "./types";
import type { DanmakuComment } from "./online";
export function parseComments(value: unknown): DanmakuDocument {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { comments?: unknown }).comments)
  )
    throw Error("format");
  const comments = (value as { comments: unknown[] }).comments,
    entries: DanmakuComment[] = [];
  let skipped = Math.max(0, comments.length - limits.entries);
  for (const raw of comments.slice(0, limits.entries)) {
    if (!raw || typeof raw !== "object") {
      skipped++;
      continue;
    }
    const { p, m } = raw as { p?: unknown; m?: unknown };
    if (
      typeof p !== "string" ||
      p.length > 256 ||
      typeof m !== "string" ||
      m.length > limits.text * 2
    ) {
      skipped++;
      continue;
    }
    const pieces = p.split(","),
      time = Number(pieces[0]),
      mode = Number(pieces[1]),
      color = Number(pieces[2]);
    const text = m
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (
      pieces.length < 3 ||
      !pieces.slice(0, 3).every((x) => x.trim()) ||
      !Number.isFinite(time) ||
      time < 0 ||
      time > limits.time ||
      !Number.isInteger(color) ||
      color < 0 ||
      color > 16777215 ||
      !text ||
      Array.from(text).length > limits.text ||
      ![1, 4, 5, 6].includes(mode)
    ) {
      skipped++;
      continue;
    }
    entries.push({
      time,
      text,
      mode: mode === 4 ? "bottom" : mode === 5 ? "top" : "scroll",
      color: "#" + color.toString(16).padStart(6, "0"),
      duration: 8,
      source: "dandanplay",
    });
  }
  entries.sort((a, b) => a.time - b.time);
  return { format: "Online", entries, skipped };
}
