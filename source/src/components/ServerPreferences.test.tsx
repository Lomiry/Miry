// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ServerPreferences from "./ServerPreferences";
import { t } from "../i18n/core";
import { resolveProviderIconTrace } from "../stores/providerIcons";
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
const account = {
  server: "https://unidentified.example.test",
  serverId: "s",
  userId: "u",
  name: "1111",
  serverName: "1111",
  token: "synthetic",
  deviceId: "d",
};
const icons = [
  { name: "1111-emby", url: "https://icons.example.test/1111.png" },
  { name: "Blue-emby", url: "https://icons.example.test/blue.png" },
];
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "miry-provider-icon-catalog",
    JSON.stringify({ at: Date.now(), icons }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("does not infer a provider from numeric display name 1111, or invent a garbage-provider alias", () => {
  expect(
    resolveProviderIconTrace(account, icons, { provider: "", override: "" }),
  ).toMatchObject({ rule: "default", url: undefined });
  expect(
    resolveProviderIconTrace(account, icons, {
      provider: "垃圾影音",
      override: "",
    }),
  ).toMatchObject({ rule: "provider", url: undefined });
  expect(
    resolveProviderIconTrace(account, icons, {
      provider: "1111-emby",
      override: "",
    }).url,
  ).toContain("1111.png");
  expect(
    resolveProviderIconTrace(
      { ...account, server: "https://blue.example.test", remark: "1111-emby" },
      icons,
      { provider: "", override: "" },
    ),
  ).toMatchObject({ rule: "domain", name: "Blue-emby" });
});
it("reports an unknown provider and successful save, and reports a failed image fallback", async () => {
  render(<ServerPreferences account={account} onUpdate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(t("routeC.provider")), {
    target: { value: "垃圾影音" },
  });
  fireEvent.click(screen.getByRole("button", { name: t("routeC.save") }));
  expect(screen.getByText(t("routeUi.icon_unknown"))).toBeTruthy();
  fireEvent.change(screen.getByLabelText(t("routeC.provider")), {
    target: { value: "Blue-emby" },
  });
  fireEvent.click(screen.getByRole("button", { name: t("routeC.save") }));
  expect(screen.getByText(t("routeUi.saved"))).toBeTruthy();
  fireEvent.error(document.querySelector("img")!);
  await waitFor(() =>
    expect(screen.getByText(t("routeUi.icon_fallback"))).toBeTruthy(),
  );
});
it("shows directory refresh success or failure instead of silently clearing feedback", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ icons })))
      .mockResolvedValueOnce(new Response("{}", { status: 500 })),
  );
  render(<ServerPreferences account={account} onUpdate={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: t("routeC.icon_refresh") }),
  );
  await screen.findByText(t("routeUi.catalog_loaded", { count: icons.length }));
  fireEvent.click(
    screen.getByRole("button", { name: t("routeC.icon_refresh") }),
  );
  await screen.findByText(t("routeC.icon_failed"));
});
it("does not claim success when local settings storage cannot be written", () => {
  render(<ServerPreferences account={account} onUpdate={vi.fn()} />);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("controlled quota");
  });
  fireEvent.click(screen.getByRole("button", { name: t("routeC.save") }));
  expect(screen.getByText(t("routeUi.save_failed"))).toBeTruthy();
});
it("immediately shows loading feedback and prevents duplicate catalog requests", async () => {
  let finish!: (value: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<ServerPreferences account={account} onUpdate={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: t("routeC.icon_refresh") }),
  );
  const loading = screen.getByRole("button", { name: t("library.loading") });
  expect(loading.getAttribute("aria-busy")).toBe("true");
  expect((loading as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(loading);
  expect(fetcher).toHaveBeenCalledOnce();
  finish(new Response(JSON.stringify({ icons })));
  await screen.findByText(t("routeUi.catalog_loaded", { count: icons.length }));
});
