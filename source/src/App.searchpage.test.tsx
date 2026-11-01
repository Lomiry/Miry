// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { saveAccount } from "./stores/account";
import { rememberConnection } from "./stores/connections";
import { pickSelect } from "./testSelect";
import { setLanguage, t } from "./i18n/core";
import type { Item } from "./types/emby";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
const account = (host: string) => ({
  server: `https://${host}.example.test`,
  serverId: host,
  userId: "u",
  name: "Fixture",
  token: "fictional",
  deviceId: "d",
  remark: `Server ${host}`,
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setLanguage("zh-CN", false);
  saveAccount(account("a"), false);
  rememberConnection(account("b"), false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function service() {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (raw: string) => {
      const url = new URL(raw);
      calls.push(url);
      let result: unknown = { Items: [], TotalRecordCount: 0 };
      const host = url.hostname.startsWith("a.") ? "a" : "b";
      if (url.pathname.includes("/FavoriteItems/"))
        return new Response(JSON.stringify({ IsFavorite: true }));
      if (url.pathname.endsWith("/Views"))
        result = {
          Items: [
            {
              Id: "library",
              Name: "Local library",
              Type: "CollectionFolder",
              CollectionType: "movies",
            },
          ],
          TotalRecordCount: 1,
        };
      else if (url.pathname.endsWith("/Genres"))
        result = { Items: [], TotalRecordCount: 0 };
      else if (url.pathname.endsWith("/Items/shared"))
        result = { Id: "shared", Name: `Nebula ${host}`, Type: "Movie" };
      else if (url.pathname.endsWith("/Items"))
        result = {
          Items: [{ Id: "shared", Name: `Nebula ${host}`, Type: "Movie" }],
          TotalRecordCount: url.searchParams.has("SearchTerm")
            ? host === "a"
              ? 2
              : 3
            : 1,
        };
      return new Response(JSON.stringify(result));
    }),
  );
  return calls;
}
it.each(["home", "detail", "library"] as const)(
  "enters an independent all-server search from %s and preserves account-scoped result identities",
  async (origin) => {
    const calls = service();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "打开媒体库 Local library" });
    if (origin === "detail")
      await user.click(
        (
          await screen.findAllByRole("button", { name: "查看详情 Nebula a" })
        )[0],
      );
    if (origin === "library")
      await user.click(
        screen.getByRole("button", { name: "打开媒体库 Local library" }),
      );
    await user.type(
      screen.getByLabelText(t("library.search_media")),
      "Nebula{Enter}",
    );
    const overview = await screen.findByRole("region", {
      name: t("search.page"),
    });
    await waitFor(() =>
      expect(within(overview).getByRole("status").textContent).toContain(
        t("search.displayed_count", { count: 2 }),
      ),
    );
    expect(screen.getByRole("heading", { name: "Server a" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Server b" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "查看详情 Nebula a" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "查看详情 Nebula b" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "打开媒体库 Local library" }),
    ).toBeNull();
    expect(document.querySelector(".server-switcher")).toBeNull();
    const searches = calls.filter(
      (u) => u.searchParams.get("SearchTerm") === "Nebula",
    );
    expect(new Set(searches.map((u) => u.hostname)).size).toBe(2);
    expect(searches.every((u) => !u.searchParams.has("ParentId"))).toBe(true);
    await pickSelect(
      user,
      screen.getByLabelText(t("library.watch_status")),
      "unplayed",
    );
    await waitFor(() =>
      expect(
        calls.filter(
          (u) =>
            u.searchParams.get("SearchTerm") === "Nebula" &&
            u.searchParams.get("IsPlayed") === "false",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
    expect(screen.getByText(t("search.filters_active"))).toBeTruthy();
  },
);
it("keeps search independent of the current server's library-list failure and rejects stale search replies", async () => {
  const calls = service();
  const original = globalThis.fetch;
  let release!: (value: Response) => void;
  let failViews = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (raw: string) => {
      const u = new URL(raw);
      if (failViews && u.pathname.endsWith("/Views"))
        return new Response("controlled failure", { status: 500 });
      if (
        u.searchParams.get("SearchTerm") === "Old" &&
        u.hostname.startsWith("b.")
      )
        return new Promise<Response>((r) => (release = r));
      return original(raw);
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "打开媒体库 Local library" });
  failViews = true;
  await user.type(
    screen.getByLabelText(t("library.search_media")),
    "Old{Enter}",
  );
  await waitFor(() => expect(release).toBeTypeOf("function"));
  await user.clear(screen.getByLabelText(t("library.search_media")));
  await user.type(
    screen.getByLabelText(t("library.search_media")),
    "New{Enter}",
  );
  await screen.findByRole("heading", {
    name: t("library.search_results_for", { p0: "New" }),
  });
  await waitFor(() =>
    expect(document.querySelectorAll(".search-group")).toHaveLength(2),
  );
  await act(async () =>
    release(
      new Response(
        JSON.stringify({
          Items: [{ Id: "old", Name: "Stale movie", Type: "Movie" }],
          TotalRecordCount: 1,
        }),
      ),
    ),
  );
  expect(screen.queryByText("Stale movie")).toBeNull();
  expect(
    calls.filter((u) => u.searchParams.get("SearchTerm") === "New"),
  ).toHaveLength(2);
});
it("updates favorite feedback only in the owning server group when item IDs collide", async () => {
  service();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "打开媒体库 Local library" });
  await user.type(
    screen.getByLabelText(t("library.search_media")),
    "Nebula{Enter}",
  );
  const b = (await screen.findByRole("heading", { name: "Server b" })).closest(
    "section",
  )!;
  const a = screen
    .getByRole("heading", { name: "Server a" })
    .closest("section")!;
  await user.click(within(b).getByRole("button", { name: "收藏 Nebula b" }));
  await waitFor(() =>
    expect(
      within(b)
        .getByRole("button", { name: "取消收藏 Nebula b" })
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
  expect(
    within(a)
      .getByRole("button", { name: "收藏 Nebula a" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});

it.each([
  {
    name: "single-server primary cards despite a zero server total",
    servers: 1,
    main: 2,
    extra: 0,
  },
  { name: "all-server primary cards", servers: 2, main: 1, extra: 0 },
  { name: "primary and supplemental cards", servers: 2, main: 1, extra: 1 },
  { name: "supplemental-only cards", servers: 2, main: 0, extra: 1 },
  { name: "no results", servers: 2, main: 0, extra: 0 },
])(
  "keeps overview, group counts and rendered cards consistent: $name",
  async ({ servers, main, extra }) => {
    if (servers === 1) {
      localStorage.clear();
      sessionStorage.clear();
      saveAccount(account("a"), false);
    }
    service();
    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (raw: string) => {
        const url = new URL(raw);
        const query = url.searchParams.get("SearchTerm");
        if (!query) return original(raw);
        const primary = query === "Nebula";
        const count = primary ? main : extra;
        const Items: Item[] = Array.from({ length: count }, (_, i) => ({
          Id: `${primary ? "main" : "extra"}-${i}`,
          Name:
            primary && !extra
              ? "Nebula"
              : `Nebula ${primary ? "main" : "extra"} ${i}`,
          Type: "Movie",
        }));
        return new Response(JSON.stringify({ Items, TotalRecordCount: 0 }));
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "打开媒体库 Local library" });
    await user.type(
      screen.getByLabelText(t("library.search_media")),
      "Nebula{Enter}",
    );
    const overview = await screen.findByRole("region", {
      name: t("search.page"),
    });
    await waitFor(() =>
      expect(within(overview).getByRole("status").textContent).toContain(
        t("search.displayed_count", { count: servers * (main + extra) }),
      ),
    );
    const groups = document.querySelectorAll(".search-group");
    expect(groups).toHaveLength(servers);
    for (const group of groups) {
      expect(group.querySelectorAll(".poster-open")).toHaveLength(main + extra);
      expect(group.querySelector(".section-heading")?.textContent).toContain(
        t("search.displayed_count", { count: main + extra }),
      );
      if (extra) {
        expect(group.querySelector(".section-heading")?.textContent).toContain(
          t("search.primary_count", { count: main }),
        );
        expect(group.querySelector(".section-heading")?.textContent).toContain(
          t("search.supplemental_count", { count: extra }),
        );
        expect(
          within(group as HTMLElement).getByRole("heading", {
            name: t("library.supplemental_matches"),
          }),
        ).toBeTruthy();
      }
    }
  },
);

it("updates displayed counts and cards together after a filter change", async () => {
  service();
  const original = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (raw: string) => {
      const url = new URL(raw);
      if (!url.searchParams.has("SearchTerm")) return original(raw);
      const count = url.searchParams.has("IsPlayed")
        ? url.hostname.startsWith("a.")
          ? 1
          : 0
        : 2;
      return new Response(
        JSON.stringify({
          Items: Array.from({ length: count }, (_, i) => ({
            Id: String(i),
            Name: "Nebula",
            Type: "Movie",
          })),
          TotalRecordCount: count,
        }),
      );
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("button", { name: "打开媒体库 Local library" });
  await user.type(
    screen.getByLabelText(t("library.search_media")),
    "Nebula{Enter}",
  );
  const overview = await screen.findByRole("region", {
    name: t("search.page"),
  });
  await waitFor(() =>
    expect(within(overview).getByRole("status").textContent).toContain(
      t("search.displayed_count", { count: 4 }),
    ),
  );
  await pickSelect(
    user,
    screen.getByLabelText(t("library.watch_status")),
    "unplayed",
  );
  await waitFor(() =>
    expect(within(overview).getByRole("status").textContent).toContain(
      t("search.displayed_count", { count: 1 }),
    ),
  );
  expect(document.querySelectorAll(".search-group .poster-open")).toHaveLength(
    1,
  );
});
