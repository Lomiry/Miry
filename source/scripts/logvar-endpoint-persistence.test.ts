// @vitest-environment jsdom
import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readSettings, saveSettings } from "../src/stores/settings";
import { normalizeSources } from "../src/danmaku/sources";
import { normalizeDanmaku } from "../src/danmaku/types";

it("a new process reads persisted LAN consent with the real settings reader, preserving explicit false and zero", () => {
  localStorage.clear();
  const source = {
    id: "lan",
    name: "Test LAN",
    protocol: "logvar" as const,
    endpoint: "http://192.168.50.1:9321/proxy/",
    allowLanHttp: true,
    priority: 0,
    enabled: false,
  };
  saveSettings({
    ...readSettings(),
    volume: 0,
    autoNext: false,
    danmaku: normalizeDanmaku({
      opacity: 0,
      deduplicate: false,
      sources: normalizeSources({ mode: "auto", sources: [source] }),
    }),
  });
  const dir = mkdtempSync(path.join(tmpdir(), "miry-lan-settings-test-"));
  try {
    writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({
        "miry-settings": localStorage.getItem("miry-settings"),
      }),
    );
    // Run the existing bundler in Node, outside jsdom's separate typed-array realm.
    execFileSync(process.execPath, [
      "--input-type=commonjs",
      "-e",
      "require('esbuild').buildSync({entryPoints:['src/stores/settings.ts'],bundle:true,platform:'node',format:'cjs',outfile:process.argv[1]});",
      path.join(dir, "reader.cjs"),
    ]);
    const child = `const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));globalThis.localStorage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v};process.stdout.write(JSON.stringify(require(process.argv[2]).readSettings()));`;
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=commonjs",
          "-e",
          child,
          path.join(dir, "settings.json"),
          path.join(dir, "reader.cjs"),
        ],
        { encoding: "utf8" },
      ),
    );
    expect(result).toMatchObject({
      volume: 0,
      autoNext: false,
      danmaku: { opacity: 0, deduplicate: false },
    });
    expect(
      result.danmaku.sources.sources.find(
        (s: { id: string }) => s.id === "lan",
      ),
    ).toMatchObject({ ...source, endpoint: "http://192.168.50.1:9321/proxy" });
    expect(
      result.danmaku.sources.sources.some(
        (s: { id: string }) => s.id === "dandanplay",
      ),
    ).toBe(true);
  } finally {
    if (
      path.dirname(dir) !== path.resolve(tmpdir()) ||
      !path.basename(dir).startsWith("miry-lan-settings-test-")
    )
      throw Error("Unsafe fixture cleanup path");
    rmSync(dir, { recursive: true });
  }
});
