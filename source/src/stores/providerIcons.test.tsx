// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  adaptIconCatalog,
  loadIconCatalog,
  cachedIconCatalog,
  matchProviderIcon,
  readIconPreference,
  saveIconPreference,
} from "./providerIcons";
import ServerIcon from "../components/ServerIcon";
import embyIcon from "../assets/emby.svg";
const account = {
  server: "https://a.example.test/emby",
  serverId: "s",
  userId: "u",
  token: "test-only",
  name: "demo",
  deviceId: "d",
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const icons = {
  icons: [
    { name: "Provider", url: "https://icons.example.test/a.png" },
    { name: "bad", url: "http://icons.example.test/a.png" },
  ],
};
it("adapts the public schema and uses exact names only", () => {
  const list = adaptIconCatalog(icons);
  expect(list).toHaveLength(1);
  expect(matchProviderIcon("Provider", list)).toBe(list[0].url);
  expect(matchProviderIcon("Provider premium", list)).toBeUndefined();
  expect(matchProviderIcon("provider", list)).toBe(list[0].url);
  expect(
    adaptIconCatalog({
      icons: [{ name: "x", url: "https://u:p@icons.example.test/a.png" }],
    }),
  ).toEqual([]);
});
it("deduplicates and caches public catalog requests without account credentials", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(icons)));
  vi.stubGlobal("fetch", fetch);
  const [a, b] = await Promise.all([loadIconCatalog(), loadIconCatalog()]);
  expect(a).toEqual(b);
  await loadIconCatalog();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
  expect(JSON.stringify(fetch.mock.calls)).not.toContain(account.token);
  expect(cachedIconCatalog()).toHaveLength(1);
  expect(localStorage.getItem("miry-provider-icon-catalog")).not.toContain(
    account.server,
  );
});
it("shares server preferences across routes but not different server IDs", () => {
  saveIconPreference(account, {
    provider: "Provider",
    override: "https://icons.example.test/custom.png",
  });
  expect(
    readIconPreference({ ...account, server: "https://b.example.test/emby" })
      .provider,
  ).toBe("Provider");
  expect(readIconPreference({ ...account, serverId: "other" }).provider).toBe(
    "",
  );
});
it("explicit refresh replaces a fresh catalog instead of returning stale URLs", async () => {
  localStorage.setItem(
    "miry-provider-icon-catalog",
    JSON.stringify({ at: Date.now(), icons: icons.icons.slice(0, 1) }),
  );
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        icons: [
          { name: "Provider", url: "https://icons.example.test/new.png" },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  expect((await loadIconCatalog())[0].url).toContain("a.png");
  expect(fetch).not.toHaveBeenCalled();
  expect((await loadIconCatalog(true, true))[0].url).toContain("new.png");
  expect(fetch).toHaveBeenCalledOnce();
});
it("applies a manual override and falls back to the local official Emby mark on failure", () => {
  saveIconPreference(account, {
    provider: "Provider",
    override: "https://icons.example.test/custom.png",
  });
  render(<ServerIcon account={account} />);
  const image = document.querySelector("img")!;
  expect(image.src).toContain("/custom.png");
  expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
  fireEvent.error(image);
  expect(document.querySelector("img")?.getAttribute("src")).toBe(embyIcon);
  expect(screen.queryByRole("alert")).toBeNull();
});
it("rejects invalid catalogs and keeps cache empty", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await expect(loadIconCatalog()).rejects.toThrow();
  expect(cachedIconCatalog()).toEqual([]);
});

it("recomputes implicit recognition after renaming, switching, and remounting without changing identity", () => {
  localStorage.setItem(
    "miry-provider-icon-catalog",
    JSON.stringify({ at: Date.now(), ...icons }),
  );
  const original = { ...account, remark: "Provider" };
  const view = render(<ServerIcon account={original} />);
  expect(document.querySelector("img")?.src).toContain("/a.png");
  const renamed = { ...original, remark: "1111" };
  view.rerender(<ServerIcon account={renamed} />);
  expect(document.querySelector("img")?.getAttribute("src")).toBe(embyIcon);
  view.rerender(<ServerIcon account={{ ...renamed, serverId: "another" }} />);
  view.rerender(<ServerIcon account={renamed} />);
  expect(document.querySelector("img")?.getAttribute("src")).toBe(embyIcon);
  view.unmount();
  render(<ServerIcon account={renamed} />);
  expect(document.querySelector("img")?.getAttribute("src")).toBe(embyIcon);
  expect(renamed).toEqual({ ...original, remark: "1111" });
});
it("preserves explicit provider preference when the display name changes", () => {
  localStorage.setItem(
    "miry-provider-icon-catalog",
    JSON.stringify({ at: Date.now(), ...icons }),
  );
  saveIconPreference(account, { provider: "Provider", override: "" });
  const view = render(<ServerIcon account={{ ...account, remark: "1111" }} />);
  expect(document.querySelector("img")?.src).toContain("/a.png");
  view.rerender(<ServerIcon account={{ ...account, remark: "other" }} />);
  expect(document.querySelector("img")?.src).toContain("/a.png");
});
it("refreshes every mounted icon when explicit preferences are changed", () => {
  const view = render(
    <>
      <ServerIcon account={account} />
      <ServerIcon account={account} />
    </>,
  );
  fireEvent(window, new Event("miry-provider-icons"));
  saveIconPreference(account, {
    provider: "",
    override: "https://icons.example.test/new.png",
  });
  fireEvent(window, new Event("miry-provider-icons"));
  view.rerender(
    <>
      <ServerIcon account={account} />
      <ServerIcon account={account} />
    </>,
  );
  expect([...document.querySelectorAll("img")].map((i) => i.src)).toEqual([
    "https://icons.example.test/new.png",
    "https://icons.example.test/new.png",
  ]);
});
