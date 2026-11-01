import {
  BoundedCache,
  rank,
  normalizeTitle,
  seriesTitle,
  type DanmakuMediaContext,
  type DanmakuMatch,
} from "./online";
import { candidates } from "./dandanplay";
import { SharedRequests } from "./sharedRequests";
import { parseOnline } from "./onlineLoad";
import { validateProviderEnvelope } from "./onlineError";
import {
  compatibleTransport,
  type CompatibleQuery,
} from "./compatibleTransport";
import type { DanmakuSource } from "./sources";
import type { RequestScope } from "./requestDiagnostics";
import { count } from "./requestDiagnostics";
import type { DanmakuDocument } from "./types";
import { sourceVideoDuration } from "./timeline";
export class LogvarProvider {
  private flights = new SharedRequests();
  private cache = new BoundedCache<DanmakuMatch[] | DanmakuDocument>(
    16,
    32 * 1024 * 1024,
  );
  constructor(
    private source: DanmakuSource,
    private transport = compatibleTransport,
  ) {}
  clear() {
    this.flights.clear();
    this.cache.clear();
  }
  private request<T>(
    query: CompatibleQuery,
    signal: AbortSignal,
    scope: RequestScope | undefined,
    convert: (v: unknown, s: AbortSignal) => Promise<T>,
    force = false,
  ): Promise<T> {
    const key = JSON.stringify([scope?.cacheScope || "", query]);
    if (signal.aborted)
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    const cached = !force && this.cache.get(key);
    if (cached) {
      count(scope, "providerCacheHits");
      return Promise.resolve(cached as T);
    }
    return this.flights.run(
      key,
      signal,
      async (s) => {
        count(
          scope,
          query.kind === "comments"
            ? "providerCommentRequests"
            : "providerSearchRequests",
        );
        const value = await this.transport(this.source, query, s);
        validateProviderEnvelope(value, query.kind === "comments");
        const result = await convert(value, s);
        if (s.aborted) throw new DOMException("Aborted", "AbortError");
        if (
          Array.isArray(result)
            ? result.length
            : (result as DanmakuDocument).entries.length
        )
          this.cache.set(
            key,
            result as DanmakuMatch[] | DanmakuDocument,
            JSON.stringify(result).length * 2,
          );
        return result;
      },
      () => count(scope, "providerCoalescedRequests"),
    );
  }
  search(
    query: string,
    signal: AbortSignal,
    context?: DanmakuMediaContext,
    scope?: RequestScope,
  ) {
    const raw = query.trim();
    const coordinate = raw.match(/\s+S\d{1,3}E(\d{1,4})$/i);
    const title = raw.replace(/\s+S\d{1,3}E\d{1,4}$/i, "");
    const sameMedia =
      context &&
      [context.title, context.original].some(
        (t) =>
          t &&
          normalizeTitle(seriesTitle(t)) === normalizeTitle(seriesTitle(title)),
      );
    const episode = coordinate
      ? String(Number(coordinate[1]))
      : sameMedia && context && !context.movie && context.episode
        ? String(context.episode)
        : undefined;
    if (
      title.length < 2 ||
      title.length > 200 ||
      /https?:\/\/|[\\/]|[\u0000-\u001f]/i.test(title)
    )
      return Promise.resolve([]);
    return this.request(
      {
        kind: "search",
        title,
        ...(episode ? { episode } : {}),
      },
      signal,
      scope,
      async (v) => {
        const result = candidates(v).map((m) => ({
          ...m,
          provider: "logvar" as const,
        }));
        if (!result.length && (v as { animes: unknown[] }).animes.length)
          throw Error("format");
        return result;
      },
    );
  }
  async match(
    context: DanmakuMediaContext,
    signal: AbortSignal,
    scope?: RequestScope,
  ) {
    const matches = await this.search(context.title, signal, context, scope);
    let result = rank(context, matches);
    if (
      !result.selected &&
      context.original &&
      normalizeTitle(context.original) !== normalizeTitle(context.title)
    ) {
      result = rank(context, [
        ...matches,
        ...(await this.search(context.original, signal, context, scope)),
      ]);
    }
    return result;
  }
  getComments(
    id: string,
    signal: AbortSignal,
    force = false,
    scope?: RequestScope,
  ) {
    return this.request(
      { kind: "comments", id },
      signal,
      scope,
      async (v, s) => {
        const doc = await parseOnline(v, s);
        const videoDuration = sourceVideoDuration(
          (v as { videoDuration?: unknown }).videoDuration,
        );
        if (videoDuration !== undefined) doc.videoDuration = videoDuration;
        if (!doc.entries.length && doc.skipped) throw Error("format");
        // The shared wire parser tags its legacy provider. The core document
        // is provider-neutral; source ownership stays on the selected match.
        doc.entries = doc.entries.map((e) => {
          const { source: _legacySource, ...entry } = e as typeof e & {
            source?: string;
          };
          return entry;
        });
        return doc;
      },
      force,
    );
  }
}
