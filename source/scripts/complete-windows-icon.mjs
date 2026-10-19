// Keep Tauri's ICO frames and add the extra DPI sizes rendered by Tauri itself.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../src-tauri/icons/", import.meta.url);
const existing = readFileSync(new URL("icon.ico", root));
const frames = new Map();
for (let i = 0; i < existing.readUInt16LE(4); i++) {
  const at = 6 + i * 16;
  const size = existing[at] || 256;
  const length = existing.readUInt32LE(at + 8),
    offset = existing.readUInt32LE(at + 12);
  if (offset + length > existing.length) throw new Error("Invalid ICO frame");
  frames.set(size, existing.subarray(offset, offset + length));
}
for (const size of [20, 40, 128]) {
  const png = readFileSync(new URL(`windows/${size}x${size}.png`, root));
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size)
    throw new Error("Invalid PNG size");
  frames.set(size, png);
}
const sizes = [...frames.keys()].sort((a, b) => a - b);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [i, size] of sizes.entries()) {
  const at = 6 + i * 16,
    frame = frames.get(size);
  header[at] = header[at + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(frame.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += frame.length;
}
writeFileSync(
  new URL("icon.ico", root),
  Buffer.concat([header, ...sizes.map((size) => frames.get(size))]),
);
console.log(`Windows ICO: ${sizes.join(", ")} px`);
