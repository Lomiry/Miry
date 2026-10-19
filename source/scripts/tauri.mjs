import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const env = { ...process.env };
if (args[0] === "build") {
  const flags = env.CARGO_ENCODED_RUSTFLAGS
    ? env.CARGO_ENCODED_RUSTFLAGS.split("\x1f")
    : (env.RUSTFLAGS ?? "").split(/\s+/).filter(Boolean);
  for (const [prefix, label] of [
    [homedir(), "build-home"],
    [env.CARGO_HOME, "cargo-home"],
    [env.RUSTUP_HOME, "rustup-home"],
    [root, "miry-source"],
  ]) {
    if (!prefix) continue;
    for (const value of new Set([prefix, prefix.replaceAll("\\", "/")])) {
      flags.push(`--remap-path-prefix=${value}=${label}`);
    }
  }
  env.CARGO_ENCODED_RUSTFLAGS = flags.join("\x1f");
  delete env.RUSTFLAGS;
}
const result = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args],
  { cwd: root, env, stdio: "inherit" },
);
if (result.error) {
  console.error("无法启动 Tauri，请确认已安装项目依赖。");
  process.exit(1);
}
process.exit(result.status ?? 1);
