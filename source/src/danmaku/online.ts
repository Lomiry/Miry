import type { Item } from "../types/emby";
export interface DanmakuMediaContext {
  title: string;
  original?: string;
  year?: number;
  season?: number;
  episode?: number;
  movie: boolean;
  tmdb?: number;
}
export interface DanmakuMatch {
  provider: "dandanplay";
  id: string;
  animeId: string;
  title: string;
  episodeTitle: string;
  year?: number;
  season?: number;
  episode?: number;
  movie: boolean;
  score?: number;
  tmdbMatched?: boolean;
  recommended?: boolean;
  reason?: string;
  evidence?: "tmdb" | "title-year" | "episode" | "weak";
}
export interface DanmakuComment {
  time: number;
  text: string;
  mode: "scroll" | "top" | "bottom";
  color: string;
  source: "dandanplay";
  duration: number;
}
export interface DanmakuProvider {
  search(
    query: string,
    signal: AbortSignal,
    context?: DanmakuMediaContext,
  ): Promise<DanmakuMatch[]>;
  match(
    context: DanmakuMediaContext,
    signal: AbortSignal,
  ): Promise<{ candidates: DanmakuMatch[]; selected?: DanmakuMatch }>;
  getComments(
    id: string,
    signal: AbortSignal,
    force?: boolean,
  ): Promise<import("./types").DanmakuDocument>;
}
export function normalizeTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}
export function mediaContext(item: Item): DanmakuMediaContext {
  const movie = item.Type === "Movie",
    ids = movie ? item.ProviderIds : item.SeriesProviderIds;
  const tmdb = Number(ids?.Tmdb || ids?.tmdb);
  return {
    title: movie ? item.Name : item.SeriesName || item.Name,
    original: movie ? item.OriginalTitle : item.OriginalSeriesTitle,
    movie,
    year: item.ProductionYear,
    season: movie ? undefined : item.ParentIndexNumber,
    episode: movie ? undefined : item.IndexNumber,
    tmdb:
      Number.isSafeInteger(tmdb) && tmdb > 0 && tmdb <= 4294967295
        ? tmdb
        : undefined,
  };
}
export function defaultQuery(c: DanmakuMediaContext) {
  return c.movie
    ? c.title
    : `${c.title} S${String(c.season || 1).padStart(2, "0")}E${String(c.episode || 1).padStart(2, "0")}`;
}
export function coordinates(title: string) {
  const t = title.normalize("NFKC"),
    s = t.match(/\bS(?:eason)?\s*(\d{1,3})(?:\b|(?=E\d))|第\s*(\d{1,3})\s*季/i);
  const e =
    t.match(
      /(?:\bE(?:p(?:isode)?)?\.?\s*|(?<=\d)E)(\d{1,4})(?:\s*[集话話]|\b)|第\s*(\d{1,4})\s*[集话話]/i,
    ) || t.match(/^\s*(\d{1,4})(?:\s|[.：:、]|$)/);
  const chinese = t.match(/第\s*([一二三四五六七八九十]{1,3})\s*季/);
  return {
    season: s
      ? Number(s[1] || s[2])
      : chinese
        ? chineseNumber(chinese[1])
        : undefined,
    episode: e ? Number(e[1] || e[2]) : undefined,
  };
}
function chineseNumber(value: string) {
  const digits = "零一二三四五六七八九";
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [a, b] = value.split("十");
    return (a ? digits.indexOf(a) : 1) * 10 + (b ? digits.indexOf(b) : 0);
  }
  return digits.indexOf(value) > 0 ? digits.indexOf(value) : undefined;
}
export function rank(
  c: DanmakuMediaContext,
  matches: DanmakuMatch[],
  mapped = false,
): { candidates: DanmakuMatch[]; selected?: DanmakuMatch } {
  const title = normalizeTitle(c.movie ? c.title : seriesTitle(c.title)),
    original = normalizeTitle(
      c.movie ? c.original || "" : seriesTitle(c.original || ""),
    );
  const candidates = Array.from(new Map(matches.map((m) => [m.id, m])).values())
    .map((m) => {
      const base = !c.movie ? seriesTitle(m.title) : m.title;
      const candidate = normalizeTitle(base),
        exact = candidate === title && !!title,
        originalExact = !!original && candidate === original,
        tmdb = mapped || m.tmdbMatched === true;
      let score = exact ? 55 : originalExact ? 50 : 0;
      let evidence: NonNullable<DanmakuMatch["evidence"]> = "weak";
      let reason = exact
        ? "标题一致，信息不足"
        : originalExact
          ? "原标题一致，信息不足"
          : "标题相似";
      if (c.movie) {
        if (!m.movie) {
          score = 0;
          reason = "作品类型不同";
        } else if (c.year && m.year && m.year !== c.year) {
          score = 0;
          reason = "年份不同";
        } else if (tmdb) {
          score = 110;
          reason = "TMDb一致";
          evidence = "tmdb";
        } else if (c.year && m.year === c.year) {
          score = exact
            ? 95
            : originalExact
              ? 90
              : Math.max(
                    titleSimilarity(title, candidate),
                    titleSimilarity(original, candidate),
                  ) >= 0.72
                ? 65
                : 0;
          reason = exact
            ? "标题和年份一致"
            : originalExact
              ? "原标题和年份一致"
              : "标题相似，年份一致";
          if (exact || originalExact) evidence = "title-year";
        }
        // Official movie responses include extras (S1, O1, trailers) alongside
        // the feature. Keep them selectable, but don't treat them as the movie.
        if (/^(?:[SOC]\d+\b|PV\b|预告|特典|花絮)/i.test(m.episodeTitle)) {
          score = Math.min(score, 30);
          evidence = "weak";
          reason = "附加内容，请手动确认";
        }
      } else {
        const season =
          m.season === c.season ||
          (c.season === 1 &&
            m.season === undefined &&
            (exact || originalExact));
        if (m.movie || !c.season || !c.episode) {
          score = 0;
          reason = "季集信息不足";
        } else if (m.episode !== c.episode) {
          score = 0;
          reason = "集数不同";
        } else if (!season) {
          score = 0;
          reason = m.season ? "季数不同" : "季数信息不足";
        } else if (exact || originalExact || tmdb) {
          score = tmdb ? 110 : m.season === undefined ? 90 : 95;
          reason = `剧名、S${String(c.season).padStart(2, "0")}E${String(c.episode).padStart(2, "0")}一致${m.season === undefined ? "（首季未标注）" : ""}`;
          evidence = tmdb ? "tmdb" : "episode";
        } else {
          score = 0;
          reason = "剧名不同";
        }
      }
      return { ...m, score, reason, evidence, recommended: false };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.id.localeCompare(b.id))
    .slice(0, 20);
  const [first] = candidates;
  const quality = (m: DanmakuMatch) =>
    m.evidence === "tmdb" ? 2 : m.evidence === "weak" ? 0 : 1;
  const selected =
    first &&
    quality(first) > 0 &&
    !candidates.slice(1).some((m) => quality(m) >= quality(first))
      ? first
      : undefined;
  if (selected) selected.recommended = true;
  return { candidates, selected };
}
export function seriesTitle(title: string) {
  return title
    .normalize("NFKC")
    .replace(
      /(?:\bS(?:eason)?\s*\d+(?:E\d+)?|第\s*[\d一二三四五六七八九十]+\s*季)\s*$/i,
      "",
    );
}
function titleSimilarity(a: string, b: string) {
  if (
    !a ||
    !b ||
    a.length < 2 ||
    b.length < 2 ||
    (a.match(/\d+/g) || []).join(",") !== (b.match(/\d+/g) || []).join(",")
  )
    return 0;
  const pairs = (text: string) =>
    new Set(
      Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2)),
    );
  const aa = pairs(a),
    bb = pairs(b);
  return (2 * [...aa].filter((p) => bb.has(p)).length) / (aa.size + bb.size);
}
export class BoundedCache<T> {
  private values = new Map<
    string,
    { value: T; expires: number; size: number }
  >();
  constructor(
    private max = 48,
    private bytes = 4 * 1024 * 1024,
    private ttl = 3 * 60 * 60 * 1000,
    private now = () => Date.now(),
  ) {}
  get(key: string) {
    const v = this.values.get(key);
    if (!v) return;
    if (v.expires <= this.now()) {
      this.values.delete(key);
      return;
    }
    this.values.delete(key);
    this.values.set(key, v);
    return v.value;
  }
  set(key: string, value: T, size: number) {
    this.values.delete(key);
    if (size > this.bytes) return;
    this.values.set(key, { value, expires: this.now() + this.ttl, size });
    while (
      this.values.size > this.max ||
      Array.from(this.values.values()).reduce((n, v) => n + v.size, 0) >
        this.bytes
    )
      this.values.delete(this.values.keys().next().value!);
  }
  clear() {
    this.values.clear();
  }
}
const mappingKey = "miry-online-danmaku-mappings-v1";
export function mappingIdentity(scope: string, item: Item) {
  return JSON.stringify([scope, item.Id, "dandanplay"]);
}
export function fingerprint(c: DanmakuMediaContext) {
  return JSON.stringify(c);
}
type Mapping = { fingerprint: string; match: DanmakuMatch; offset: number };
function mappings(): Record<string, Mapping> {
  try {
    const text = localStorage.getItem(mappingKey) || "{}";
    if (text.length > 512 * 1024) return {};
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function association(
  key: string,
  c: DanmakuMediaContext,
): Mapping | undefined {
  const v = mappings()[key];
  return v?.fingerprint === fingerprint(c) &&
    v.match?.provider === "dandanplay" &&
    /^\d{1,19}$/.test(v.match.id) &&
    typeof v.match.title === "string" &&
    typeof v.match.episodeTitle === "string"
    ? v
    : undefined;
}
export function saveAssociation(
  key: string,
  c: DanmakuMediaContext,
  match?: DanmakuMatch,
  offset = 0,
) {
  try {
    const all = mappings();
    delete all[key];
    if (match)
      all[key] = {
        fingerprint: fingerprint(c),
        match,
        offset: Number.isFinite(offset)
          ? Math.max(-600, Math.min(600, offset))
          : 0,
      };
    const entries = Object.entries(all).slice(-500);
    while (
      entries.length &&
      JSON.stringify(Object.fromEntries(entries)).length > 512 * 1024
    )
      entries.shift();
    localStorage.setItem(
      mappingKey,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    /* A full storage quota must not interrupt playback. */
  }
}
