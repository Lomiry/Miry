import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { APP_VERSION } from "../src/version";
import { RELEASE_API_URL, RELEASE_PAGE_URL } from "../src/release";
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
it("ships one version across package, locks, Rust and Tauri", () => {
  expect(APP_VERSION).toBe("1.0.6");
  const lock = JSON.parse(read("../package-lock.json"));
  expect(lock.version).toBe(APP_VERSION);
  expect(lock.packages[""].version).toBe(APP_VERSION);
  expect(JSON.parse(read("../src-tauri/tauri.conf.json")).version).toBe(
    APP_VERSION,
  );
  for (const path of ["../src-tauri/Cargo.toml", "../src-tauri/Cargo.lock"])
    expect(read(path)).toMatch(/name = "miry-emby"\s+version = "1\.0\.6"/);
});
it("uses the verified public project for release checking and links", () => {
  expect(RELEASE_API_URL).toBe(
    "https://api.github.com/repos/Lomiry/Miry/releases/latest",
  );
  expect(RELEASE_PAGE_URL).toBe("https://github.com/Lomiry/Miry/releases");
});
