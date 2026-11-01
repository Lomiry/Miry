import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useEffect, useRef, useState } from "react";
import { isComposingKey } from "../player/shortcuts";
import type { DanmakuPresentation } from "../danmaku/types";
import type { PlayerAction } from "../player/uiModel";
import Select from "./Select";
import { normalizeSources } from "../danmaku/sources";
import { sourceError } from "../danmaku/sourceError";
export default function OnlineDanmakuMenu({
  value,
  dispatch,
}: {
  value: DanmakuPresentation;
  dispatch: (action: PlayerAction) => Promise<void>;
}) {
  useI18n();

  const online = value.online,
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(online?.query || ""),
    [candidateId, setCandidateId] = useState<string | null>(null),
    [cancelled, setCancelled] = useState(false),
    [acknowledged, setAcknowledged] = useState<string | null>(null),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState("");
  const owner = online?.sessionKey || online?.query || "";
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const pending = useRef<object | null>(null);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (search) input.current?.focus();
  }, [search]);
  useEffect(() => {
    if (online?.match && online.pending === false) {
      setCandidateId(null);
      setSearch(false);
    }
  }, [online?.match?.id, online?.pending]);
  useEffect(() => {
    setQuery(online?.query || "");
    setSearch(false);
    setCandidateId(null);
    setCancelled(false);
    setAcknowledged(null);
    setSubmitting(false);
    setError("");
    pending.current = null;
    currentOwner.current = owner;
    return () => {
      pending.current = null;
      currentOwner.current = "";
    };
  }, [owner]);
  if (!online) return null;
  const run = (
    command: Extract<PlayerAction, { kind: "danmaku" }>["command"],
    extra = {},
  ) => {
    if (pending.current) return;
    if (command === "search") {
      setCandidateId(null);
      setCancelled(false);
      setAcknowledged(null);
    }
    const operation = {};
    pending.current = operation;
    setSubmitting(true);
    setError("");
    void dispatch({ kind: "danmaku", command, ...extra })
      .catch(() => {
        if (currentOwner.current === owner)
          setError(t("danmaku.match_action_failed"));
      })
      .finally(() => {
        if (pending.current === operation) {
          pending.current = null;
          setSubmitting(false);
        }
      });
  };
  const enabled = value.settings.onlineEnabled !== false;
  const busy = online.loading || submitting;
  const choices = online.candidates.filter((m) => m.id !== online.match?.id);
  const candidate =
    cancelled || !(online.pending || search || candidateId || !online.match)
      ? undefined
      : choices.find((m) => m.id === candidateId) ||
        choices.find((m) => m.recommended) ||
        choices[0];
  const context = online.context;
  const differs = !!(
    candidate &&
    context &&
    (candidate.movie !== context.movie ||
      (context.year && candidate.year && context.year !== candidate.year) ||
      (context.season &&
        candidate.season &&
        context.season !== candidate.season) ||
      (context.episode &&
        candidate.episode &&
        context.episode !== candidate.episode))
  );
  const sourceName = (m: NonNullable<typeof candidate>) =>
    online.sources?.find(
      (s) => s.id === (m.id.includes(":") ? m.id.split(":")[0] : "dandanplay"),
    )?.name || (m.provider === "logvar" ? "LogVar" : "DandanPlay");
  const sources = normalizeSources(value.settings.sources);
  return (
    <div className="online-danmaku-menu">
      <label>
        {t("sources.mode")}
        <Select
          disabled={busy}
          value={online.mode || sources.mode}
          onChange={(e) => run("source-mode", { query: e.target.value })}
        >
          <option value="auto">{t("sources.auto")}</option>
          {(online.sources || sources.sources).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {!s.enabled ? ` (${t("sources.disabled")})` : ""}
            </option>
          ))}
        </Select>
      </label>
      {online.sourceName && (
        <p>{t("sources.using", { name: online.sourceName })}</p>
      )}
      {!!online.failures?.length && (
        <p className="player-menu-note">
          <strong>{t("danmaku.source_attempts")}</strong>
          <br />
          {online.failures
            .map((f) => `${f.source}: ${sourceError(f.kind)}`)
            .join(" · ")}
        </p>
      )}
      <small>
        {" "}
        {t("sources.service")}
        {online.mock ? t("danmaku.local_test_service") : ""}
      </small>
      <p className="player-menu-note" role="status">
        {localizeMessage(
          enabled
            ? cancelled
              ? t("danmaku.match_unchanged")
              : online.status
            : t("danmaku.online_danmaku_is_off"),
        )
          .split("\n")
          .map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
      </p>
      {online.match && online.loadedCount !== undefined && (
        <div className="danmaku-match-loaded">
          <strong>
            {t(
              online.confirmed
                ? "danmaku.confirmed_match"
                : "danmaku.loaded_match",
            )}
          </strong>
          <p>
            {online.match.title} · {online.match.episodeTitle} ·{" "}
            {sourceName(online.match)}
          </p>
          <small>
            {t("danmaku.loaded_comments", { count: online.loadedCount })}
            {online.videoDuration ? ` · ${online.videoDuration}s` : ""}
          </small>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {!online.configured && !online.builtIn ? (
        <button className="secondary" onClick={() => run("configure")}>
          {" "}
          {t("danmaku.configure_authorized_service_credentials")}{" "}
        </button>
      ) : (
        <>
          <div className="danmaku-file-actions">
            <button
              disabled={!enabled || busy}
              onClick={() => {
                setSearch(true);
                setCancelled(false);
              }}
            >
              {t("danmaku.choose_other_match")}
            </button>
            <button
              className="secondary"
              disabled={!enabled || busy}
              onClick={() => setSearch(!search)}
            >
              {" "}
              {t("danmaku.search_for_other_danmaku")}{" "}
            </button>
            {online.match && (
              <button
                className="secondary"
                disabled={!enabled || busy}
                onClick={() => {
                  setSearch(true);
                }}
              >
                {" "}
                {t("danmaku.change_match")}{" "}
              </button>
            )}
            {online.match && (
              <button
                className="secondary"
                disabled={!enabled || busy}
                onClick={() => run("reload")}
              >
                {" "}
                {t("danmaku.reload_online_danmaku")}{" "}
              </button>
            )}
            {online.match && value.source === "local" && (
              <button
                className="secondary"
                disabled={!enabled || busy}
                onClick={() => run("online")}
              >
                {" "}
                {t("danmaku.use_online_danmaku")}{" "}
              </button>
            )}
          </div>
          {search && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !composing.current &&
                  enabled &&
                  !busy &&
                  query.trim().length >= 2
                )
                  run("search", { query: query.trim() });
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (composing.current || isComposingKey(e.nativeEvent))
                )
                  e.preventDefault();
              }}
            >
              <input
                ref={input}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={() => {
                  composing.current = false;
                }}
                aria-label={t("danmaku.search_online_danmaku")}
                value={query}
                maxLength={200}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                className="secondary"
                disabled={!enabled || busy || query.trim().length < 2}
              >
                {" "}
                {t("danmaku.search")}{" "}
              </button>
            </form>
          )}
          {!!choices.length && <h4>{t("danmaku.candidate_match")}</h4>}
          {candidate && (
            <section className="danmaku-match-confirm" aria-busy={busy}>
              <p>
                {candidate.title}
                {candidate.year ? ` · ${candidate.year}` : ""} ·{" "}
                {candidate.episodeTitle} · {sourceName(candidate)}
              </p>
              {differs && (
                <label className="player-check">
                  <input
                    type="checkbox"
                    checked={acknowledged === candidate.id}
                    disabled={busy}
                    onChange={(e) =>
                      setAcknowledged(e.target.checked ? candidate.id : null)
                    }
                  />
                  {t("danmaku.version_warning")}
                </label>
              )}
              <div className="danmaku-file-actions">
                <button
                  className="danmaku-confirm-button"
                  disabled={
                    !enabled ||
                    busy ||
                    (differs && acknowledged !== candidate.id)
                  }
                  onClick={() =>
                    run("select", {
                      matchId: candidate.id,
                      ...(online.sessionKey
                        ? { matchScope: online.sessionKey }
                        : {}),
                    })
                  }
                >
                  {t("danmaku.confirm_match")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setCancelled(true);
                    setCandidateId(null);
                    setAcknowledged(null);
                  }}
                >
                  {t("sources.cancel")}
                </button>
              </div>
            </section>
          )}
          <div className="online-danmaku-candidates">
            {choices.slice(0, 20).map((m) => (
              <button
                key={m.id}
                className="player-menu-option"
                disabled={!enabled || busy}
                aria-pressed={candidate?.id === m.id}
                onClick={() => {
                  setCandidateId(m.id);
                  setCancelled(false);
                  setAcknowledged(null);
                }}
              >
                <span>
                  {m.title}
                  {m.year ? ` · ${m.year}` : ""}
                  {m.recommended && (
                    <strong className="danmaku-recommended">
                      {t("library.recommended")}
                    </strong>
                  )}
                  {m.reason && <small>{localizeMessage(m.reason)}</small>}
                  <small>
                    {m.season ? `S${String(m.season).padStart(2, "0")}` : ""}
                    {m.episode
                      ? `E${String(m.episode).padStart(2, "0")}`
                      : ""}{" "}
                    · {m.episodeTitle} ·{" "}
                    {online.sources?.find(
                      (s) =>
                        s.id ===
                        (m.id.includes(":")
                          ? m.id.split(":")[0]
                          : "dandanplay"),
                    )?.name ||
                      (m.provider === "logvar" ? "LogVar" : "DandanPlay")}{" "}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!online.builtIn && (
            <details>
              <summary>{t("danmaku.service_configuration")}</summary>
              <button className="secondary" onClick={() => run("configure")}>
                {" "}
                {t("danmaku.change_credentials")}{" "}
              </button>
              <button
                className="secondary"
                onClick={() => run("clear-credential")}
              >
                {" "}
                {t("danmaku.clear_credentials_for_this_session")}{" "}
              </button>
            </details>
          )}
        </>
      )}
    </div>
  );
}
