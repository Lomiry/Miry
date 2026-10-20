import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFileSync(path.join(root, name));
const config = JSON.parse(read("src-tauri/tauri.conf.json"));
const nsis = config.bundle.windows.nsis;
const hook = read(`src-tauri/${nsis.installerHooks}`).toString();

test("keeps the production installation identity, resources and official template", () => {
  assert.equal(config.productName, "Miry");
  assert.equal(config.identifier, "com.miry.emby");
  assert.equal(config.bundle.publisher, "Lomiry");
  assert.deepEqual(config.bundle.targets, ["nsis"]);
  assert.deepEqual(config.bundle.resources, { "../tools/mpv/": "tools/mpv/" });
  assert.equal(nsis.installMode, "currentUser");
  assert.deepEqual(nsis.languages, ["SimpChinese", "English"]);
  assert.equal(nsis.template, undefined);
  assert.deepEqual(config.bundle.windows.webviewInstallMode, {
    type: "downloadBootstrapper",
    silent: true,
  });
});

test("installer and uninstaller share the application ICO with Windows DPI frames", () => {
  assert.equal(nsis.installerIcon, "icons/icon.ico");
  assert.equal(nsis.uninstallerIcon, nsis.installerIcon);
  assert.ok(config.bundle.icon.includes(nsis.installerIcon));
  const ico = read(`src-tauri/${nsis.installerIcon}`);
  assert.equal(ico.readUInt16LE(2), 1);
  const sizes = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const at = 6 + i * 16;
    sizes.push(ico[at] || 256);
    assert.ok(
      ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8) <= ico.length,
    );
  }
  for (const size of [16, 20, 24, 32, 40, 48, 64, 128, 256])
    assert.ok(sizes.includes(size), `Missing ICO frame ${size}`);
});

test("MUI bitmaps have native dimensions and uncompressed 24-bit pixels", () => {
  for (const [file, width, height] of [
    [nsis.headerImage, 150, 57],
    [nsis.sidebarImage, 164, 314],
  ]) {
    const bmp = read(`src-tauri/${file}`);
    assert.equal(bmp.toString("ascii", 0, 2), "BM");
    assert.equal(bmp.readUInt32LE(2), bmp.length);
    assert.equal(bmp.readInt32LE(18), width);
    assert.equal(bmp.readInt32LE(22), height);
    assert.equal(bmp.readUInt16LE(28), 24);
    assert.equal(bmp.readUInt32LE(30), 0);
  }
});

test("hook only changes MUI presentation and the successful page transition", () => {
  const code = hook.replace(/;[^\r\n]*/g, "");
  assert.match(code, /^!define MUI_FINISHPAGE_RUN_NOTCHECKED$/m);
  assert.deepEqual(
    [...code.matchAll(/^!macro (\w+)/gm)].map((m) => m[1]),
    ["NSIS_HOOK_POSTINSTALL"],
  );
  assert.match(
    code,
    /!macro NSIS_HOOK_POSTINSTALL\s+SetAutoClose true\s+!macroend/,
  );
  assert.doesNotMatch(
    code,
    /\b(?:Exec\w*|RunAsUser|Delete\w*|RmDir|WriteReg\w*|Sleep|SetOutPath|File)\b/,
  );
  assert.deepEqual(
    [...code.matchAll(/^Function (\w+)/gm)].map((m) => m[1]),
    ["MiryBrandingInit"],
  );
  assert.match(code, /^!define MUI_CUSTOMFUNCTION_GUIINIT MiryBrandingInit$/m);
  assert.match(code, /GetDLLVersion "\$EXEPATH" \$1 \$2/);
  assert.match(code, /"STR:\$\(\^Name\) v\$3\.\$1\.\$2"/);
  for (const control of ["Text", "Background"])
    assert.ok(code.includes(`SendMessage $mui.Branding.${control} `));
  assert.equal(config.bundle.copyright, undefined);
  assert.doesNotMatch(code, /BrandingText|VIAddVersionKey|LegalCopyright/);
  for (const id of [2052, 1033])
    for (const name of ["MiryWelcomeText", "MiryFinishText"])
      assert.match(code, new RegExp(`LangString ${name} ${id} `));
});

test("version continues to come from the existing package and Tauri configuration", () => {
  assert.equal(config.version, JSON.parse(read("package.json")).version);
  assert.equal(config.version, JSON.parse(read("package-lock.json")).version);
  assert.doesNotMatch(hook, /1\.0\.[0-9]/);
  assert.equal(
    JSON.parse(read("package-lock.json")).packages[
      "node_modules/@tauri-apps/cli"
    ].version,
    "2.12.1",
    "Re-audit the upstream include/page/hook order when upgrading Tauri CLI",
  );
});

const nsisDir =
  process.env.MIRY_NSIS_DIR ||
  path.join(process.env.LOCALAPPDATA || "", "tauri", "NSIS");
const compiler = path.join(nsisDir, "makensis.exe");

test(
  "real NSIS preprocess and compile: opt-in run and successful transition",
  {
    skip:
      !existsSync(compiler) &&
      "Existing NSIS compiler unavailable; no download",
  },
  () => {
    const output = path.join(root, ".cache", "nsis-ux-test");
    mkdirSync(output, { recursive: true });
    const absolute = (file) => path.join(root, "src-tauri", file);
    const template = read("scripts/fixtures/installer-preview.nsi").toString();
    const source = template
      .replaceAll("@HOOK@", absolute(nsis.installerHooks))
      .replaceAll("@ICON@", absolute(nsis.installerIcon))
      .replaceAll("@HEADER@", absolute(nsis.headerImage))
      .replaceAll("@SIDEBAR@", absolute(nsis.sidebarImage))
      .replaceAll(
        "@OUTPUT@",
        path.join(output, "Miry-Installer-UX-Preview.exe"),
      )
      .replaceAll("@VERSION@", config.version);
    const script = path.join(output, "preview.nsi");
    writeFileSync(script, source);
    const charset = ["/INPUTCHARSET", "UTF8", "/OUTPUTCHARSET", "UTF8"];
    const pre = spawnSync(compiler, [...charset, "/PPO", script], {
      encoding: "utf8",
    });
    assert.equal(pre.status, 0, pre.stdout + pre.stderr);
    // Check compiled MUI behavior, not just the presence of a source define.
    assert.match(pre.stdout, /Pop \$mui\.FinishPage\.Run/);
    assert.match(pre.stdout, /欢迎使用/);
    assert.doesNotMatch(
      pre.stdout,
      /SendMessage \$mui\.FinishPage\.Run (?:0x0*F1|241) (?:0x0*1|1) 0/i,
    );
    assert.match(
      pre.stdout,
      /SendMessage \$mui\.FinishPage\.ShowReadme (?:0x0*F1|241) (?:0x0*1|1) 0/i,
    );
    assert.match(
      pre.stdout,
      /Section "Preview"[\s\S]*SetAutoClose true[\s\S]*SectionEnd/,
    );
    writeFileSync(path.join(output, "preprocessed.nsi"), pre.stdout);
    const build = spawnSync(compiler, [...charset, "/V3", script], {
      encoding: "utf8",
    });
    writeFileSync(
      path.join(output, "compile.log"),
      build.stdout + build.stderr,
    );
    assert.equal(build.status, 0, build.stdout + build.stderr);
    assert.ok(existsSync(path.join(output, "Miry-Installer-UX-Preview.exe")));
    for (const [suffix, flag] of [
      ["English", "PREVIEW_EN"],
      ["Failure", "PREVIEW_FAIL"],
    ]) {
      const variant = path.join(output, `preview-${suffix}.nsi`);
      writeFileSync(
        variant,
        source.replaceAll(
          "Miry-Installer-UX-Preview.exe",
          `Miry-Installer-UX-Preview-${suffix}.exe`,
        ),
      );
      const result = spawnSync(
        compiler,
        [...charset, "/V3", `/D${flag}`, variant],
        { encoding: "utf8" },
      );
      writeFileSync(
        path.join(output, `compile-${suffix}.log`),
        result.stdout + result.stderr,
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  },
);
