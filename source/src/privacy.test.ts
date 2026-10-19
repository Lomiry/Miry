import { expect, it } from "vitest";
import { privateText, privateError, routeLabel } from "./privacy";

it("keeps addresses visible and conceals credentials within diagnostic URLs", () => {
  for (const address of [
    "private.test:8096/emby",
    "192.168.1.8:8096/emby",
    "http://[2001:db8::1]:8096/emby",
    "smb://private.test/video",
  ]) {
    expect(privateError(new Error(`连接失败：${address} 请重试。`))).toBe(
      `连接失败：${address} 请重试。`,
    );
  }
  expect(privateText("Emby 4.9.0 · 23 ms · 默认线路")).toBe(
    "Emby 4.9.0 · 23 ms · 默认线路",
  );
  expect(
    privateText("https://private.test/emby?api_key=secret-token&tag=cover"),
  ).toBe("https://private.test/emby?api_key=[凭据已隐藏]&tag=cover");
  expect(privateText("https://user:secret@private.test/emby")).toBe(
    "https://[凭据已隐藏]@private.test/emby",
  );
});

it("preserves route aliases and supplies a default for empty names", () => {
  expect(routeLabel("https://private.test/emby", 1)).toBe(
    "https://private.test/emby",
  );
  expect(routeLabel("内网", 1)).toBe("内网");
  expect(routeLabel("", 1)).toBe("线路 2");
});
