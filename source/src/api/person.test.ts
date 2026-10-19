// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { EmbyClient } from "./client";
const account = {
  server: "https://host.test/emby",
  userId: "u",
  token: "t",
  name: "A",
  deviceId: "d",
};
afterEach(() => vi.unstubAllGlobals());
it("reuses biography across filters, clears it on refresh, and pages works with read-only requests", async () => {
  const fetch = vi.fn(
    async (_address: string) =>
      new Response(
        JSON.stringify({
          Id: "p",
          Name: "演员",
          Type: "Person",
          Overview: "简介",
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const api = new EmbyClient(account);
  await api.person("p");
  await api.person("p");
  expect(fetch).toHaveBeenCalledTimes(1);
  api.cache.clear();
  await api.person("p");
  expect(fetch).toHaveBeenCalledTimes(2);
  await api.personWorks("p", 2, "Movie");
  const url = new URL(String(fetch.mock.calls.at(-1)![0]));
  expect(url.searchParams.get("PersonIds")).toBe("p");
  expect(url.searchParams.get("StartIndex")).toBe("60");
  expect(url.searchParams.get("IncludeItemTypes")).toBe("Movie");
  const canceled = new AbortController();
  canceled.abort();
  await expect(api.person("p", canceled.signal)).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(fetch).toHaveBeenCalledTimes(3);
});
