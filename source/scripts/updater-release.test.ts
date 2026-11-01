import { expect, it, vi } from "vitest";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// @ts-expect-error Node release helper has no frontend declaration.
import { createManifest, generate } from "./updater-release.mjs";
const name = "Miry_1.0.8_x64-setup.exe";
const base = "https://github.com/Lomiry/Miry/releases";
const release = () => ({
  tag_name: "v1.0.8",
  html_url: `${base}/tag/v1.0.8`,
  draft: false,
  prerelease: false,
  body: "Notes",
  assets: [name, `${name}.sig`].map((name) => ({
    name,
    size: 4,
    browser_download_url: `${base}/download/v1.0.8/${name}`,
  })),
});
const build = (r = release()) =>
  createManifest(r, name, Buffer.from("test"), "sig!", Buffer.from("sig!"));
it("blocks packaging without a private key before starting Tauri", () => {
  const env = { ...process.env };
  delete env.TAURI_SIGNING_PRIVATE_KEY;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./tauri.mjs", import.meta.url)), "build"],
    { encoding: "utf8", env },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("更新签名尚未就绪");
  expect(result.stdout).not.toContain("Compiling");
});
it("does not generate production metadata while signing is unconfirmed", () => {
  const read = vi
    .spyOn(fs, "readFileSync")
    .mockReturnValue('{"signingReady":false}');
  try {
    expect(() =>
      generate(
        "not-read.json",
        "not-read.exe",
        "not-read.sig",
        "not-written.json",
      ),
    ).toThrow("Official update signing is unconfirmed");
    expect(read).toHaveBeenCalledTimes(1);
  } finally {
    read.mockRestore();
  }
});
it("allows only ordinary NSIS test packaging without changing the updater policy", () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./tauri.mjs", import.meta.url)),
      "build",
      "--test-nsis",
      "--help",
    ],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toContain("正式更新签名门禁保持不变");
  expect(result.stdout).toContain("--bundles");
});
it("rejects additional configuration in NSIS test mode", () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./tauri.mjs", import.meta.url)),
      "build",
      "--test-nsis",
      "--config",
      "{}",
    ],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("不能合并额外配置");
  expect(result.stdout).not.toContain("Compiling");
});
it("keeps updater packaging, stable endpoint, signature version binding and installation identity aligned", () => {
  const config = JSON.parse(
    readFileSync(
      new URL("../src-tauri/tauri.conf.json", import.meta.url),
      "utf8",
    ),
  );
  expect(config.version).toBe("1.0.8");
  expect(config.identifier).toBe("com.miry.emby");
  expect(config.bundle.createUpdaterArtifacts).toBe(true);
  expect(config.bundle.windows.nsis.installMode).toBe("currentUser");
  expect(config.bundle.windows.nsis.installerHooks).toBe("installer/hooks.nsh");
  expect(config.plugins.updater.endpoints).toEqual([
    `${base}/latest/download/latest.json`,
  ]);
  expect(config.plugins.updater.requireSignedVersion).toBe(true);
  expect(config.plugins.updater.windows.installMode).toBe("passive");
});
it("generates only the official stable x64 platform with the detached signature contents", () => {
  expect(build()).toMatchObject({
    version: "1.0.8",
    platforms: {
      "windows-x86_64": {
        signature: "sig!",
        url: `${base}/download/v1.0.8/${name}`,
      },
    },
  });
});
it("rejects drafts, previews, wrong versions and missing assets", () => {
  for (const r of [
    { ...release(), draft: true },
    { ...release(), prerelease: true },
    { ...release(), tag_name: "v1.0.8-rc.6" },
    { ...release(), assets: [] },
  ])
    expect(() => build(r)).toThrow();
});
it("rejects foreign URLs, size or digest mismatches", () => {
  for (const change of [
    { browser_download_url: "https://example.test/setup.exe" },
    { size: 5 },
    { digest: "sha256:bad" },
  ]) {
    const r = release();
    Object.assign(r.assets[0], change);
    expect(() => build(r)).toThrow();
  }
});
