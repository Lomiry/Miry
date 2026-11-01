import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { rustDeltaNotices } from "./rust-delta-notices.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const env = { ...process.env };
// An ordinary local NSIS test installer is not a signed updater artifact.
const testNsis = args.includes("--test-nsis");
if (testNsis) {
  const cargoSeparator = args.indexOf("--");
  const buildArgs = args.slice(
    1,
    cargoSeparator < 0 ? args.length : cargoSeparator,
  );
  const cargoArgs = cargoSeparator < 0 ? [] : args.slice(cargoSeparator + 1);
  if (
    args[0] !== "build" ||
    buildArgs.some((arg) => !["--test-nsis", "--ci", "--help"].includes(arg)) ||
    cargoArgs.some((arg) => !["--locked", "--offline"].includes(arg))
  ) {
    console.error(
      "测试 NSIS 模式仅支持 build、--ci、--help 和 Cargo --locked/--offline，不能合并额外配置。",
    );
    process.exit(1);
  }
  args.splice(args.indexOf("--test-nsis"), 1);
  const separator = args.indexOf("--");
  args.splice(
    separator < 0 ? args.length : separator,
    0,
    "--bundles",
    "nsis",
    "--config",
    JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
  );
  console.error(
    "测试 NSIS：不生成 updater 签名产物；正式更新签名门禁保持不变。",
  );
}
if (args[0] === "build") {
  const config = JSON.parse(
    readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const policy = JSON.parse(
    readFileSync(path.join(root, "src-tauri/updater-policy.json"), "utf8"),
  );
  if (
    !testNsis &&
    config.bundle.createUpdaterArtifacts &&
    (policy.signingReady !== true ||
      !config.plugins?.updater?.pubkey ||
      !env.TAURI_SIGNING_PRIVATE_KEY)
  ) {
    console.error(
      "更新签名尚未就绪：请先审阅 updater-policy.json，并确认正式公钥与受控 TAURI_SIGNING_PRIVATE_KEY 对应；构建已停止，未生成安装包。",
    );
    process.exit(1);
  }
  try {
    rustDeltaNotices(root);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
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
