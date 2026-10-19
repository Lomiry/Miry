import { invoke } from "@tauri-apps/api/core";
import {
  BoundedCache,
  coordinates,
  rank,
  normalizeTitle,
  seriesTitle,
  type DanmakuProvider,
  type DanmakuMatch,
  type DanmakuMediaContext,
} from "./online";
import type { DanmakuDocument } from "./types";
import { parseOnline } from "./onlineLoad";
import { onlineErrorKind, validateProviderEnvelope } from "./onlineError";
import { count, type RequestScope } from "./requestDiagnostics";
import { SharedRequests } from "./sharedRequests";
import {
  developmentDiagnostic,
  rankingDiagnostic,
  transportDiagnostic,
  type SearchDiagnostic,
} from "./searchDiagnostics";
type Query = {
  kind: "anime" | "search" | "comments";
  anime?: string;
  episode?: string;
  tmdbId?: number;
  movie?: boolean;
  episodeId?: string;
};
type Transport = (query: Query, signal: AbortSignal) => Promise<unknown>;
export async function nativeTransport(
  query: Query,
  signal: AbortSignal,
): Promise<unknown> {
  const requestId = crypto.randomUUID(),
    abort = () => {
      void invoke("danmaku_online_cancel", { requestId }).catch(() => {});
    };
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  signal.addEventListener("abort", abort, { once: true });
  try {
    const value = await invoke<{ data: unknown; diagnostic?: unknown }>(
      "danmaku_online_request",
      {
        query,
        requestId,
      },
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    transportDiagnostic(value.diagnostic);
    return value.data;
  } catch (error) {
    if (!signal.aborted)
      transportDiagnostic(
        (error as { diagnostic?: unknown })?.diagnostic,
        onlineErrorKind(error),
      );
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown) =>
  typeof v === "string" && v.length <= 300 ? v : "";
const id = (v: unknown) =>
  typeof v === "string" && /^\d{1,19}$/.test(v)
    ? v
    : typeof v === "number" && Number.isSafeInteger(v) && v > 0
      ? String(v)
      : "";
function payload(value: unknown) {
  const v = object(value);
  if (v.success !== true || !Array.isArray(v.animes)) throw Error("format");
  return v.animes.slice(0, 100);
}
function candidates(value: unknown) {
  const result: DanmakuMatch[] = [];
  for (const raw of payload(value)) {
    const a = object(raw),
      title = text(a.animeTitle),
      animeId = id(a.animeId);
    if (!title || !animeId || !Array.isArray(a.episodes)) continue;
    for (const episode of a.episodes.slice(0, 100)) {
      const e = object(episode),
        episodeTitle = text(e.episodeTitle),
        episodeId = id(e.episodeId);
      if (!episodeId || !episodeTitle) continue;
      result.push({
        provider: "dandanplay",
        id: episodeId,
        animeId,
        title,
        episodeTitle,
        movie: ["movie", "jpmovie", "tmdbmovie"].includes(String(a.type)),
        year: /^\d{4}/.test(text(a.startDate))
          ? Number(text(a.startDate).slice(0, 4))
          : undefined,
        ...coordinates(title),
        season: coordinates(title).season ?? coordinates(episodeTitle).season,
        episode: coordinates(episodeTitle).episode,
      });
    }
  }
  return result.slice(0, 2000);
}
export class DandanplayProvider implements DanmakuProvider {
  private flights = new SharedRequests();
  private searchCache = new BoundedCache<DanmakuMatch[]>();
  private matchCache = new BoundedCache<{
    candidates: DanmakuMatch[];
    selected?: DanmakuMatch;
  }>();
  private commentsCache = new BoundedCache<DanmakuDocument>(
    8,
    32 * 1024 * 1024,
  );
  private stopped = false;
  constructor(
    private transport: Transport = nativeTransport,
    private diagnose: (value: SearchDiagnostic) => void = developmentDiagnostic,
  ) {}
  clear() {
    this.flights.clear();
    this.searchCache.clear();
    this.matchCache.clear();
    this.commentsCache.clear();
    // Cache/configuration cleanup must not bypass a process-level 429 guard.
  }
  private async request(
    q: Query,
    signal: AbortSignal,
    scope?: RequestScope,
    fallback = false,
  ) {
    if (this.stopped) throw { status: 429 };
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    count(
      scope,
      q.kind === "comments"
        ? "providerCommentRequests"
        : "providerSearchRequests",
    );
    if (fallback) count(scope, "providerFallbackRequests");
    let finished = false;
    const cancelled = () => {
      if (!finished) count(scope, "providerCancelledRequests");
    };
    signal.addEventListener("abort", cancelled, { once: true });
    try {
      const value = await this.transport(q, signal);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      validateProviderEnvelope(value, q.kind === "comments");
      return value;
    } catch (e) {
      if (onlineErrorKind(e) === "RATE_LIMITED") {
        this.stopped = true;
        if (object(e).kind === "rate-limited") {
          // Native queue guard rejected this call before any HTTP request.
          count(
            scope,
            q.kind === "comments"
              ? "providerCommentRequests"
              : "providerSearchRequests",
            -1,
          );
          if (fallback) count(scope, "providerFallbackRequests", -1);
        } else count(scope, "provider429Responses");
      }
      if (onlineErrorKind(e) === "NO_MATCH" && q.kind !== "comments")
        return { success: true, animes: [] };
      throw e;
    } finally {
      finished = true;
      signal.removeEventListener("abort", cancelled);
    }
  }
  private async find(
    query: Query,
    signal: AbortSignal,
    variant = "raw",
    enrich = true,
    scope?: RequestScope,
    fallback = false,
  ) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const key = JSON.stringify([
        scope?.cacheScope || "",
        query.kind,
        query.anime?.normalize("NFKC").trim(),
        query.episode,
        query.tmdbId,
        query.movie,
        enrich,
      ]),
      cached = this.searchCache.get(key);
    if (cached) {
      count(scope, "providerCacheHits");
      this.diagnose({
        stage: "query",
        variant,
        outcome: cached.length ? "candidates" : "api-zero",
        candidateCount: cached.length,
        cached: true,
      });
      return cached;
    }
    return this.flights.run(
      "search:" + key,
      signal,
      async (signal) => {
        count(scope, "providerCacheMisses");
        let value: unknown;
        try {
          value = await this.request(query, signal, scope, fallback);
        } catch (error) {
          this.diagnose({
            stage: "failure",
            variant,
            outcome: "http-api-failure",
          });
          throw error;
        }
        const raw = payload(value),
          results = candidates(value);
        this.diagnose({
          stage: "query",
          variant,
          rawCount: raw.length,
          candidateCount: results.length,
          outcome: !raw.length
            ? "api-zero"
            : !results.length
              ? "projection-empty"
              : variant === "raw" || variant === "tmdb" || variant === "name"
                ? "candidates"
                : "fallback-success",
        });
        if (query.anime && enrich && results.some((m) => m.movie && !m.year)) {
          try {
            const data = payload(
              await this.request(
                { kind: "anime", anime: query.anime },
                signal,
                scope,
                fallback,
              ),
            );
            for (const m of results) {
              const a = data
                .map(object)
                .find((a) => id(a.animeId) === m.animeId);
              const year = Number(text(a?.startDate).slice(0, 4));
              if (year >= 1800 && year <= 2200) m.year = year;
            }
          } catch (error) {
            if (signal.aborted || onlineErrorKind(error) === "RATE_LIMITED")
              throw error;
            // Missing optional year metadata must not hide valid episode results.
            this.diagnose({
              stage: "failure",
              variant: "year-metadata",
              outcome: "http-api-failure",
            });
          }
        }
        if (results.length)
          this.searchCache.set(
            key,
            results,
            JSON.stringify(results).length * 2,
          );
        return results;
      },
      () => count(scope, "providerCoalescedRequests"),
    );
  }
  async search(
    query: string,
    signal: AbortSignal,
    context?: DanmakuMediaContext,
    scope?: RequestScope,
  ) {
    const raw = query.trim().slice(0, 200),
      coord = raw.match(/\s+S(\d{1,3})E(\d{1,4})\s*$/i),
      year = raw.match(/\s+(18|19|20|21)\d{2}$/);
    const anime = coord
      ? raw.slice(0, coord.index)
      : year
        ? raw.slice(0, year.index)
        : raw;
    if (!raw || raw.length < 2) return [];
    const queryTitle = normalizeTitle(anime);
    const sameMedia =
      !!context &&
      [context.title, context.original].some(
        (title) =>
          title &&
          normalizeTitle(context.movie ? title : seriesTitle(title)) ===
            queryTitle,
      );
    const variants = [
      { title: raw, variant: "raw", episode: undefined as string | undefined },
      {
        title: anime.trim(),
        variant: "normalized",
        episode: coord
          ? String(Number(coord[2]))
          : sameMedia && context && !context.movie
            ? String(context.episode || "") || undefined
            : undefined,
      },
      {
        title: sameMedia ? context?.original?.trim() || "" : "",
        variant: "original",
        episode:
          context && !context.movie
            ? String(context.episode || "") || undefined
            : undefined,
      },
    ];
    let all: DanmakuMatch[] = [];
    const seen = new Set<string>();
    for (const v of variants) {
      if (v.title.length < 2 || seen.has(normalizeTitle(v.title))) continue;
      seen.add(normalizeTitle(v.title));
      all = mergeMatches(
        all,
        await this.find(
          { kind: "search", anime: v.title, episode: v.episode },
          signal,
          v.variant,
          context?.movie !== false,
          scope,
          seen.size > 1,
        ),
      );
      if (context) {
        const result = rank(context, all);
        this.diagnose(
          rankingDiagnostic(context, result.candidates, result.selected),
        );
        if (result.selected) break;
      } else if (all.length) break;
    }
    return all;
  }
  async match(
    context: DanmakuMediaContext,
    signal: AbortSignal,
    scope?: RequestScope,
  ) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    this.diagnose({
      stage: "metadata",
      variant: "automatic",
      outcome: "candidates",
      metadata: {
        titlePresent: !!context.title,
        originalPresent: !!context.original,
        yearPresent: !!context.year,
        tmdbPresent: !!context.tmdb,
      },
    });
    const key = JSON.stringify([
        scope?.cacheScope || "",
        context.title,
        context.original,
        context.year,
        context.season,
        context.episode,
        context.movie,
        context.tmdb,
      ]),
      cached = this.matchCache.get(key);
    if (cached) {
      count(scope, "providerCacheHits");
      return cached;
    }
    if (!context.movie && (!context.season || !context.episode))
      return { candidates: [] };
    return this.flights.run(
      "match:" + key,
      signal,
      async (signal) => {
        count(scope, "providerCacheMisses");
        let all: DanmakuMatch[] = [],
          selected: DanmakuMatch | undefined;
        if (context.tmdb) {
          const matches = await this.find(
            {
              kind: "search",
              tmdbId: context.tmdb,
              movie: context.movie,
              episode: context.movie ? undefined : String(context.episode),
            },
            signal,
            "tmdb",
            context.movie,
            scope,
          );
          const result = rank(context, matches, true);
          all = matches.map((m) => ({ ...m, tmdbMatched: true }));
          selected = result.selected;
        }
        const seen = new Set<string>();
        let queries = context.tmdb ? 1 : 0;
        if (!selected)
          for (const title of [context.title, context.original]) {
            if (!title || seen.has(normalizeTitle(title))) continue;
            seen.add(normalizeTitle(title));
            const matches = await this.find(
              {
                kind: "search",
                anime: title,
                episode: context.movie ? undefined : String(context.episode),
              },
              signal,
              title === context.title ? "name" : "original",
              context.movie,
              scope,
              queries++ > 0,
            );
            all = mergeMatches(all, matches);
            if (rank(context, all).selected) break;
          }
        const result = rank(
          context,
          Array.from(new Map(all.map((m) => [m.id, m])).values()),
        );
        this.diagnose(
          rankingDiagnostic(context, result.candidates, result.selected),
        );
        if (result.candidates.length)
          this.matchCache.set(key, result, JSON.stringify(result).length * 2);
        return result;
      },
      () => count(scope, "providerCoalescedRequests"),
    );
  }
  async getComments(
    id: string,
    signal: AbortSignal,
    force = false,
    scope?: RequestScope,
  ) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const key = JSON.stringify([scope?.cacheScope || "", id]);
    const cached = !force && this.commentsCache.get(key);
    if (cached) {
      count(scope, "providerCacheHits");
      return cached;
    }
    return this.flights.run(
      "comments:" + key,
      signal,
      async (signal) => {
        count(scope, "providerCacheMisses");
        const value = await this.request(
            { kind: "comments", episodeId: id },
            signal,
            scope,
          ),
          document = await parseOnline(value, signal);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        if (
          !document.entries.length &&
          Array.isArray(object(value).comments) &&
          (object(value).comments as unknown[]).length
        )
          throw Error("format");
        const size = document.entries.reduce(
          (n, e) => n + e.text.length * 2 + 160,
          0,
        );
        if (document.entries.length)
          this.commentsCache.set(key, document, size);
        return document;
      },
      () => count(scope, "providerCoalescedRequests"),
    );
  }
}
function mergeMatches(previous: DanmakuMatch[], next: DanmakuMatch[]) {
  const values = new Map(previous.map((m) => [m.id, m]));
  for (const m of next) {
    const old = values.get(m.id);
    values.set(m.id, {
      ...old,
      ...m,
      year: m.year ?? old?.year,
      tmdbMatched: m.tmdbMatched || old?.tmdbMatched,
    });
  }
  return [...values.values()];
}
export const onlineProvider = new DandanplayProvider();
export { normalizeTitle };
