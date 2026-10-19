import {
  normalizeTitle,
  seriesTitle,
  type DanmakuMatch,
  type DanmakuMediaContext,
} from "./online";
export type SearchDiagnostic = {
  stage: "query" | "ranking" | "failure" | "metadata";
  variant: string;
  outcome:
    | "http-api-failure"
    | "api-zero"
    | "projection-empty"
    | "candidates"
    | "fallback-success"
    | "recommended"
    | "weak-evidence"
    | "ambiguous";
  metadata?: {
    titlePresent: boolean;
    originalPresent: boolean;
    yearPresent: boolean;
    tmdbPresent: boolean;
  };
  rawCount?: number;
  candidateCount?: number;
  cached?: boolean;
  titleMatch?: "title" | "original" | "other";
  year?: "exact" | "conflict" | "missing";
  season?: "exact" | "implicit-first" | "conflict-or-missing";
  episode?: "exact" | "conflict-or-missing";
  tmdb?: boolean;
  evidence?: DanmakuMatch["evidence"];
  topScore?: number;
  secondScore?: number;
};
const history: (SearchDiagnostic | Record<string, unknown>)[] = [];
export function readDanmakuDiagnostics() {
  return history.map((v) => ({ ...v }));
}
function record(value: SearchDiagnostic | Record<string, unknown>) {
  history.push(value);
  if (history.length > 40) history.shift();
}
export function transportDiagnostic(value: unknown, errorKind?: string) {
  const d = (value || {}) as Record<string, unknown>;
  record({
    stage: "transport",
    ...(typeof d.path === "string" &&
    /^\/api\/v2\/(search\/(anime|episodes)|comment\/\d+)$/.test(d.path)
      ? { path: d.path }
      : {}),
    method: "GET",
    status: typeof d.status === "number" ? d.status : null,
    responseBytes: typeof d.responseBytes === "number" ? d.responseBytes : null,
    elapsedMs: typeof d.elapsedMs === "number" ? d.elapsedMs : null,
    contentType: [
      "application/json",
      "text/html",
      "text/plain",
      "application/octet-stream",
    ].includes(String(d.contentType))
      ? d.contentType
      : "other",
    appIdPresent: d.appIdPresent === true,
    redirects: typeof d.redirects === "number" ? d.redirects : 0,
    ...(errorKind ? { errorKind } : {}),
  });
}
// Deliberately excludes user queries, URLs, media paths and credentials.
export function developmentDiagnostic(value: SearchDiagnostic) {
  record(value);
  if (import.meta.env.DEV) console.debug("[Miry danmaku search]", value);
}
export function rankingDiagnostic(
  context: DanmakuMediaContext,
  candidates: DanmakuMatch[],
  selected?: DanmakuMatch,
): SearchDiagnostic {
  const [top, second] = candidates;
  const normalized = (value: string) =>
    normalizeTitle(context.movie ? value : seriesTitle(value));
  return {
    stage: "ranking",
    variant: "combined",
    candidateCount: candidates.length,
    outcome: selected
      ? "recommended"
      : candidates.some((m) => m.evidence !== "weak")
        ? "ambiguous"
        : "weak-evidence",
    ...(top
      ? {
          titleMatch:
            normalized(top.title) === normalized(context.title)
              ? "title"
              : context.original &&
                  normalized(top.title) === normalized(context.original)
                ? "original"
                : "other",
          year:
            !context.year || !top.year
              ? "missing"
              : context.year === top.year
                ? "exact"
                : "conflict",
          season:
            context.season === top.season
              ? "exact"
              : context.season === 1 && top.season === undefined
                ? "implicit-first"
                : "conflict-or-missing",
          episode:
            context.episode === top.episode ? "exact" : "conflict-or-missing",
          tmdb: top.tmdbMatched === true,
          evidence: top.evidence,
          topScore: top.score,
          secondScore: second?.score,
        }
      : {}),
  };
}
