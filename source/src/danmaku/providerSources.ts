import { onlineProvider } from "./dandanplay";
import { LogvarProvider } from "./logvar";
import {
  normalizeSources,
  orderedSources,
  type SourceSettings,
} from "./sources";
import type { DanmakuMatch, DanmakuMediaContext } from "./online";
import type { RequestScope } from "./requestDiagnostics";
import type { DanmakuDocument } from "./types";
import { onlineErrorKind } from "./onlineError";
type Provider = Pick<
  typeof onlineProvider,
  "search" | "match" | "getComments" | "clear"
>;
type SavedMatch = { match: DanmakuMatch; offset: number };
type MatchResult = {
  candidates: DanmakuMatch[];
  selected?: DanmakuMatch;
  offset?: number;
  empty?: boolean;
};
function checkSignal(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}
export class ProviderSources {
  readonly config: SourceSettings;
  sourceName = "";
  failures: { source: string; kind: string }[] = [];
  private providers = new Map<string, Provider>();
  private prepared?: { id: string; scope: string; document: DanmakuDocument };
  constructor(
    config?: SourceSettings,
    private ready = true,
    factory = (s: SourceSettings["sources"][number]): Provider =>
      new LogvarProvider(s),
  ) {
    this.config = normalizeSources(config);
    for (const s of this.config.sources)
      this.providers.set(
        s.id,
        s.protocol === "dandanplay" ? onlineProvider : factory(s),
      );
  }
  get configured() {
    return this.available().length > 0;
  }
  private available() {
    return orderedSources(this.config).filter(
      (s) => s.protocol !== "dandanplay" || this.ready,
    );
  }
  private project(id: string, matches: DanmakuMatch[]) {
    return matches.map((m) =>
      id === "dandanplay" ? m : { ...m, id: `${id}:${m.id}` },
    );
  }
  private failure(source: string, e: unknown, signal: AbortSignal) {
    if (signal.aborted || onlineErrorKind(e) === "CANCELLED") throw e;
    this.failures.push({ source, kind: onlineErrorKind(e) });
  }
  async search(
    query: string,
    signal: AbortSignal,
    context?: DanmakuMediaContext,
    scope?: RequestScope,
  ) {
    checkSignal(signal);
    this.failures = [];
    this.prepared = undefined;
    this.sourceName = "";
    for (const s of this.available()) {
      try {
        const result = await this.providers
          .get(s.id)!
          .search(query, signal, context, scope);
        checkSignal(signal);
        if (result.length) {
          this.sourceName = s.name;
          return this.project(s.id, result);
        }
        this.failures.push({ source: s.name, kind: "NO_MATCH" });
      } catch (e) {
        this.failure(s.name, e, signal);
        if (this.config.mode !== "auto") throw e;
      }
    }
    if (this.failures.some((f) => f.kind !== "NO_MATCH"))
      throw { kind: "provider" };
    return [];
  }
  async match(
    context: DanmakuMediaContext,
    signal: AbortSignal,
    scope?: RequestScope,
    saved?: SavedMatch,
  ): Promise<MatchResult> {
    checkSignal(signal);
    this.failures = [];
    this.prepared = undefined;
    this.sourceName = "";
    let candidates: DanmakuMatch[] = [];
    const available = this.available();
    const savedSource =
      saved &&
      available.find(
        (s) =>
          s.protocol === saved.match.provider &&
          (s.id === "dandanplay"
            ? /^\d{1,19}$/.test(saved.match.id)
            : saved.match.id.startsWith(`${s.id}:`) &&
              /^\d{1,19}$/.test(saved.match.id.slice(s.id.length + 1))),
      );
    // Restore the user's association first, then visit each remaining enabled
    // source once in priority order. A failed/empty restore never restarts it.
    const sources = savedSource
      ? [savedSource, ...available.filter((s) => s.id !== savedSource.id)]
      : available;
    for (const s of sources) {
      try {
        const p = this.providers.get(s.id)!;
        const restored = s.id === savedSource?.id ? saved : undefined;
        const rawMatch = restored && {
          ...restored.match,
          id:
            s.id === "dandanplay"
              ? restored.match.id
              : restored.match.id.slice(s.id.length + 1),
        };
        const result = rawMatch
          ? { candidates: [rawMatch], selected: rawMatch }
          : await p.match(context, signal, scope);
        checkSignal(signal);
        const projected = this.project(s.id, result.candidates);
        if (result.selected) {
          // A restored match already has sufficient evidence; fetch it once
          // and use the same handoff as automatic matching.
          if (this.config.mode === "auto" || restored) {
            const doc = await p.getComments(
              result.selected.id,
              signal,
              false,
              scope,
            );
            checkSignal(signal);
            if (!doc.entries.length && this.config.mode === "auto") {
              this.failures.push({ source: s.name, kind: "NO_COMMENTS" });
              continue;
            }
            // Retain one bounded parsed document for the immediate handoff,
            // even when the provider's byte-budget cache declines it.
            this.prepared = {
              id: this.project(s.id, [result.selected])[0].id,
              scope: scope?.cacheScope || "",
              document: doc,
            };
          }
          this.sourceName = s.name;
          const selected = this.project(s.id, [result.selected])[0];
          return {
            candidates: [
              selected,
              ...candidates,
              ...projected.filter((m) => m.id !== selected.id),
            ].slice(0, 20),
            selected,
            offset: restored?.offset || 0,
          };
        }
        candidates.push(...projected);
        this.failures.push({
          source: s.name,
          kind: projected.length ? "MANUAL_MATCH" : "NO_MATCH",
        });
      } catch (e) {
        this.failure(s.name, e, signal);
        if (this.config.mode !== "auto") throw e;
      }
    }
    if (
      !candidates.length &&
      this.failures.some((f) => !["NO_MATCH", "NO_COMMENTS"].includes(f.kind))
    )
      throw { kind: "provider" };
    return {
      candidates: candidates.slice(0, 20),
      empty:
        !candidates.length &&
        this.failures.some((f) => f.kind === "NO_COMMENTS"),
    };
  }
  async getComments(
    id: string,
    signal: AbortSignal,
    force = false,
    scope?: RequestScope,
  ): Promise<DanmakuDocument> {
    checkSignal(signal);
    const [sourceId, rawId] = id.includes(":")
      ? id.split(":")
      : ["dandanplay", id];
    const s = this.available().find((s) => s.id === sourceId);
    if (!s) throw { kind: "unconfigured" };
    if (
      !force &&
      this.prepared?.id === id &&
      this.prepared.scope === (scope?.cacheScope || "")
    )
      return this.prepared.document;
    if (force) this.prepared = undefined;
    const document = await this.providers
      .get(sourceId)!
      .getComments(rawId, signal, force, scope);
    checkSignal(signal);
    this.sourceName = s.name;
    return document;
  }
  clear() {
    this.prepared = undefined;
    for (const p of this.providers.values()) p.clear();
  }
  dispose() {
    this.prepared = undefined;
    for (const [id, p] of this.providers) if (id !== "dandanplay") p.clear();
  }
}
