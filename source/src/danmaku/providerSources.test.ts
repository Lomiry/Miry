import { beforeEach, expect, it, vi } from "vitest";
import { ProviderSources } from "./providerSources";
import { sourceDefaults, type SourceSettings } from "./sources";
import { onlineProvider } from "./dandanplay";
vi.mock("./dandanplay", () => ({
  onlineProvider: {
    match: vi.fn(),
    search: vi.fn(),
    getComments: vi.fn(),
    clear: vi.fn(),
  },
}));
const context = { title: "Example", movie: true };
const signal = () => new AbortController().signal;
const match = {
  provider: "logvar" as const,
  id: "1",
  animeId: "1",
  title: "Example",
  episodeTitle: "Movie",
  movie: true,
};
const doc = {
  format: "Online" as const,
  skipped: 0,
  entries: [
    {
      time: 1,
      text: "repeat",
      mode: "scroll" as const,
      color: "#ffffff",
      duration: 8,
    },
  ],
};
const config: SourceSettings = {
  mode: "auto",
  sources: [
    { ...sourceDefaults.sources[0], enabled: false },
    ...["first", "second"].map((id, i) => ({
      id,
      name: id,
      protocol: "logvar" as const,
      endpoint: `https://${id}.example.com`,
      enabled: true,
      priority: i,
    })),
  ],
};
const provider = () => ({
  match: vi.fn().mockResolvedValue({ candidates: [match], selected: match }),
  search: vi.fn().mockResolvedValue([match]),
  getComments: vi.fn().mockResolvedValue(doc),
  clear: vi.fn(),
});
beforeEach(() => vi.clearAllMocks());
it("preserves DandanPlay default calls, IDs and lazy comment loading", async () => {
  vi.mocked(onlineProvider.match).mockResolvedValue({
    candidates: [{ ...match, provider: "dandanplay" }],
    selected: { ...match, provider: "dandanplay" },
  });
  const p = new ProviderSources();
  expect((await p.match(context, signal())).selected?.id).toBe("1");
  expect(onlineProvider.getComments).not.toHaveBeenCalled();
});
it.each(["timeout", "network", "auth", "rate-limit", "format"])(
  "falls back serially on %s and isolates colliding IDs",
  async (kind) => {
    const a = provider(),
      b = provider();
    a.match.mockRejectedValue({ kind });
    const p = new ProviderSources(config, false, (s) =>
      s.id === "first" ? a : b,
    );
    const result = await p.match(context, signal());
    expect(result.selected?.id).toBe("second:1");
    expect(p.failures).toEqual([
      {
        source: "first",
        kind:
          kind === "format"
            ? "INVALID_RESPONSE"
            : kind === "auth"
              ? "AUTH_ERROR"
              : kind === "rate-limit"
                ? "RATE_LIMITED"
                : "NETWORK_ERROR",
      },
    ]);
    expect(a.getComments).not.toHaveBeenCalled();
    await p.getComments("second:1", signal());
    expect(b.getComments).toHaveBeenLastCalledWith(
      "1",
      expect.any(AbortSignal),
      false,
      undefined,
    );
  },
);
it.each(["no-match", "empty-comments", "comment-error"])(
  "falls back for %s",
  async (reason) => {
    const a = provider(),
      b = provider();
    if (reason === "no-match")
      a.match.mockResolvedValue({
        candidates: [],
        selected: undefined as never,
      });
    if (reason === "empty-comments")
      a.getComments.mockResolvedValue({ ...doc, entries: [] });
    if (reason === "comment-error")
      a.getComments.mockRejectedValue({ kind: "network" });
    const p = new ProviderSources(config, false, (s) =>
      s.id === "first" ? a : b,
    );
    expect((await p.match(context, signal())).selected?.id).toBe("second:1");
  },
);
it("does not fallback after cancellation or in manual mode", async () => {
  const a = provider(),
    b = provider();
  a.match.mockRejectedValue(new DOMException("Aborted", "AbortError"));
  await expect(
    new ProviderSources(config, false, (s) => (s.id === "first" ? a : b)).match(
      context,
      signal(),
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(b.match).not.toHaveBeenCalled();
  a.match.mockRejectedValue({ kind: "timeout" });
  await expect(
    new ProviderSources({ ...config, mode: "first" }, false, (s) =>
      s.id === "first" ? a : b,
    ).match(context, signal()),
  ).rejects.toEqual({ kind: "timeout" });
  expect(b.match).not.toHaveBeenCalled();
});
it("reports all failures without leaking raw errors and obeys disabled sources", async () => {
  const a = provider();
  a.match.mockRejectedValue(Error("private-url-and-token"));
  const p = new ProviderSources(config, false, () => a);
  await expect(p.match(context, signal())).rejects.toEqual({
    kind: "provider",
  });
  expect(JSON.stringify(p.failures)).not.toContain("private-url");
  expect(p.failures).toHaveLength(2);
  const disabled = new ProviderSources(
    {
      ...config,
      sources: config.sources.map((s) => ({ ...s, enabled: false })),
    },
    false,
    () => a,
  );
  expect(disabled.configured).toBe(false);
  await expect(disabled.getComments("first:1", signal())).rejects.toMatchObject(
    { kind: "unconfigured" },
  );
});
it("does not mix documents from different sources or collapse repeated display comments", async () => {
  const a = provider(),
    b = provider();
  a.getComments.mockResolvedValue({
    ...doc,
    entries: [doc.entries[0], doc.entries[0]],
  });
  const p = new ProviderSources(config, false, (s) =>
    s.id === "first" ? a : b,
  );
  const result = await p.match(context, signal());
  expect(result.selected?.id).toBe("first:1");
  expect(b.match).not.toHaveBeenCalled();
  expect((await p.getComments("first:1", signal())).entries).toHaveLength(2);
  expect(a.getComments).toHaveBeenCalledTimes(1);
});
