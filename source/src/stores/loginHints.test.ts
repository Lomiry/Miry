// @vitest-environment jsdom
import { beforeEach, it, expect } from "vitest";
import { readLoginHint, saveLoginHint } from "./loginHints";
beforeEach(() => localStorage.clear());
it("canonicalizes the server and isolates usernames across servers", () => {
  saveLoginHint("https://one.test/emby/", "User One");
  saveLoginHint("https://two.test", "User Two");
  expect(readLoginHint("https://one.test/")).toBe("User One");
  expect(readLoginHint("https://two.test/emby")).toBe("User Two");
  expect(readLoginHint("https://third.test")).toBe("");
});
it("retains only ten recent server/user names", () => {
  for (let n = 0; n < 11; n++)
    saveLoginHint(`https://server${n}.test`, `User${n}`);
  expect(readLoginHint("https://server0.test")).toBe("");
  expect(readLoginHint("https://server10.test")).toBe("User10");
  expect(JSON.parse(localStorage.getItem("miry-login-hints")!)).toHaveLength(
    10,
  );
});
it("does not retain unrelated credential fields and handles invalid storage", () => {
  localStorage.setItem(
    "miry-login-hints",
    JSON.stringify([
      {
        server: "https://one.test/emby",
        username: "One",
        token: "secret",
        password: "private",
      },
    ]),
  );
  saveLoginHint("https://two.test", "Two");
  const data = localStorage.getItem("miry-login-hints")!;
  expect(data).not.toContain("secret");
  expect(data).not.toContain("private");
  localStorage.setItem("miry-login-hints", "broken");
  expect(readLoginHint("invalid")).toBe("");
  saveLoginHint("https://two.test", "Two");
  expect(readLoginHint("https://two.test")).toBe("Two");
});
