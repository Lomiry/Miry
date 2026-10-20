import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = JSON.parse(
  fs.readFileSync(path.join(root, "src/release-source.json"), "utf8"),
);
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const base = `https://github.com/${source.owner}/${source.repository}/releases`;

export function createManifest(
  release,
  name,
  bytes,
  signature,
  signatureBytes,
  version = pkg.version,
) {
  if (
    !/^\d+\.\d+\.\d+$/.test(version) ||
    release.tag_name !== `v${version}` ||
    release.draft ||
    release.prerelease ||
    release.html_url !== `${base}/tag/v${version}` ||
    name !== `Miry_${version}_x64-setup.exe`
  )
    throw Error("Release version, channel or installer identity mismatch");
  for (const [assetName, content] of [
    [name, bytes],
    [`${name}.sig`, signatureBytes],
  ]) {
    const assets = release.assets?.filter((asset) => asset.name === assetName);
    if (assets?.length !== 1) throw Error("Missing or ambiguous Release asset");
    const asset = assets[0];
    if (
      asset.browser_download_url !==
        `${base}/download/v${version}/${assetName}` ||
      asset.size !== content.length ||
      content.length === 0
    )
      throw Error("Release asset URL or size mismatch");
    if (
      asset.digest &&
      asset.digest !==
        `sha256:${createHash("sha256").update(content).digest("hex")}`
    )
      throw Error("Release asset digest mismatch");
  }
  if (!signature.trim() || signature.length > 16384)
    throw Error("Missing signature");
  return {
    version,
    notes: String(release.body ?? "").slice(0, 8192),
    ...(release.published_at ? { pub_date: release.published_at } : {}),
    platforms: {
      "windows-x86_64": {
        url: `${base}/download/v${version}/${name}`,
        signature: signature.trim(),
      },
    },
  };
}

export function generate(
  releaseFile,
  installerFile,
  signatureFile,
  outputFile,
) {
  const release = JSON.parse(fs.readFileSync(releaseFile, "utf8"));
  const signatureBytes = fs.readFileSync(signatureFile);
  const manifest = createManifest(
    release,
    path.basename(installerFile),
    fs.readFileSync(installerFile),
    signatureBytes.toString("utf8"),
    signatureBytes,
  );
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "miry-update-manifest-"),
  );
  try {
    const input = path.join(temporary, "latest.json");
    fs.writeFileSync(input, JSON.stringify(manifest, null, 2));
    const verifyEnv = { ...process.env, MIRY_PROVIDER_BUILD_MODE: "PUBLIC" };
    for (const key of [
      "TAURI_SIGNING_PRIVATE_KEY",
      "TAURI_SIGNING_PRIVATE_KEY_PATH",
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      "MIRY_PROVIDER_CREDENTIAL_FILE",
    ])
      delete verifyEnv[key];
    const result = spawnSync(
      process.env.CARGO || "cargo",
      [
        "run",
        "--offline",
        "--locked",
        "--manifest-path",
        path.join(root, "src-tauri/Cargo.toml"),
        "--example",
        "verify_update",
        "--",
        input,
        path.resolve(installerFile),
      ],
      {
        stdio: "inherit",
        env: verifyEnv,
      },
    );
    if (result.error || result.status !== 0)
      throw Error("Signature preflight failed; latest.json was not written");
    fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4)
      throw Error(
        "Usage: node scripts/updater-release.mjs release.json installer.exe installer.exe.sig output/latest.json",
      );
    generate(...args);
    console.log(
      "latest.json generated after official signature and Release asset validation; nothing uploaded.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
