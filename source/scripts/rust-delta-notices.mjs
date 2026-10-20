import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function rustDeltaNotices(root = sourceRoot, { check = true } = {}) {
  const relative = "tools/mpv/licenses/rust-v107";
  const directory = path.join(root, relative);
  const sourcesBytes = fs.readFileSync(path.join(directory, "SOURCES.json"));
  const sources = JSON.parse(sourcesBytes);
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const lock = fs.readFileSync(path.join(root, "src-tauri/Cargo.lock"));
  if (
    sources.version !== pkg.version ||
    config.version !== pkg.version ||
    sha256(lock) !== sources.cargo_lock_sha256 ||
    config.bundle?.resources?.["../tools/mpv/"] !== "tools/mpv/"
  )
    throw Error(
      "Rust notices: version, lockfile or bundled resource mapping changed",
    );

  const sections = lock.toString("utf8").split("[[package]]");
  const allowed = new Set([".gitattributes", "SOURCES.json"]);
  const chunks = [
    Buffer.from(
      `Miry v${pkg.version} supplemental Windows Rust notices\n` +
        "Read together with ../rust-v106/NOTICE.txt and the original files.\n" +
        "Upstream original bytes and file-level exceptions are preserved below.\n" +
        "This supplement does not grant rights over other Miry materials.\n\n",
    ),
  ];
  const records = [];
  const hashes = [["SOURCES.json", sha256(sourcesBytes)]];
  let offset = chunks[0].length;
  for (const component of sources.components) {
    const section = sections.find(
      (value) =>
        /^name = "([^"]+)"/m.exec(value)?.[1] === component.name &&
        /^version = "([^"]+)"/m.exec(value)?.[1] === component.version,
    );
    if (
      !section ||
      /^checksum = "([^"]+)"/m.exec(section)?.[1] !== component.archive_sha256
    )
      throw Error(
        `Rust notices: locked archive mismatch for ${component.name}`,
      );
    for (const original of component.originals) {
      if (
        !original.path.startsWith("originals/") ||
        original.path.includes("\\") ||
        original.path.split("/").some((part) => part === ".." || !part)
      )
        throw Error("Rust notices: invalid original-file path");
      const bytes = fs.readFileSync(path.join(directory, original.path));
      if (bytes.length !== original.bytes || sha256(bytes) !== original.sha256)
        throw Error(`Rust notices: original bytes changed: ${original.path}`);
      allowed.add(original.path);
      hashes.push([original.path, original.sha256]);
      const header = Buffer.from(
        `=== ${component.name}@${component.version}: ${original.archive_member} ===\n` +
          `Original: ${original.path}\nSHA256: ${original.sha256}\n` +
          "--- BEGIN UPSTREAM ORIGINAL ---\n",
      );
      chunks.push(
        header,
        bytes,
        Buffer.from("\n--- END UPSTREAM ORIGINAL ---\n\n"),
      );
      records.push({
        component: `${component.name}@${component.version}`,
        original: original.path,
        sha256: original.sha256,
        bytes: bytes.length,
        start: offset + header.length,
        end: offset + header.length + bytes.length,
      });
      offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    }
  }
  const notice = Buffer.concat(chunks);
  const index = Buffer.from(
    JSON.stringify(
      {
        version: pkg.version,
        cargo_lock_sha256: sources.cargo_lock_sha256,
        scope: "Supplement for Windows normal/build dependency delta only",
        sources: "SOURCES.json",
        previous_notice: "../rust-v106/NOTICE.txt",
        notice_sha256: sha256(notice),
        offset_unit: "bytes; original bytes only, separators excluded",
        originals: records,
      },
      null,
      2,
    ) + "\n",
  );
  const outputs = new Map([
    ["NOTICE.txt", notice],
    ["INDEX.json", index],
  ]);
  hashes.push(["NOTICE.txt", sha256(notice)], ["INDEX.json", sha256(index)]);
  outputs.set(
    "SHA256.txt",
    Buffer.from(
      hashes
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([name, hash]) => `${hash}  ${name}\n`)
        .join(""),
    ),
  );
  for (const [name, bytes] of outputs) {
    allowed.add(name);
    const destination = path.join(directory, name);
    if (check) {
      if (!fs.readFileSync(destination).equals(bytes))
        throw Error(
          `Rust notices are stale: ${name}; run node scripts/rust-delta-notices.mjs`,
        );
    } else fs.writeFileSync(destination, bytes);
  }
  function inspect(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isSymbolicLink())
        throw Error("Rust notices: symlink is not allowed");
      if (entry.isDirectory()) inspect(full);
      else if (
        !allowed.has(path.relative(directory, full).split(path.sep).join("/"))
      )
        throw Error("Rust notices: unexpected bundled material");
    }
  }
  inspect(directory);
  return { components: sources.components.length, originals: records.length };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = rustDeltaNotices(sourceRoot, {
      check: process.argv.includes("--check"),
    });
    console.log(
      `Rust notices ${process.argv.includes("--check") ? "verified" : "generated"}: ${result.components} components, ${result.originals} originals.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
