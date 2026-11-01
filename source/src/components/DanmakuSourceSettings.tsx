import { useEffect, useRef, useState, useId } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import {
  normalizeSources,
  validEndpoint,
  needsLanHttpConsent,
  endpointContainsToken,
  type DanmakuSource,
  type SourceSettings,
} from "../danmaku/sources";
import { compatibleTransport } from "../danmaku/compatibleTransport";
import {
  validateProviderEnvelope,
  onlineErrorKind,
} from "../danmaku/onlineError";
import Select from "./Select";
import { sourceError } from "../danmaku/sourceError";
import {
  changedSourceFields,
  sourceChange,
  type SourceUpdate,
} from "../danmaku/sourceUpdates";
type KeyState =
  | "saved"
  | "session"
  | "missing"
  | "unavailable"
  | "endpoint-changed";
type Receipt = { state: KeyState; transaction?: string };
const keyError = (error: unknown) => {
  const key: Record<string, Parameters<typeof t>[0]> = {
    "credential-read": "sources.key_unavailable",
    "credential-missing": "sources.token_missing",
    "credential-endpoint": "sources.endpoint_changed",
    "credential-encrypt": "sources.encrypt_failed",
    "credential-permission": "sources.permission_failed",
    "credential-write": "sources.storage_failed",
    "credential-stale": "sources.stale",
    "credential-rollback": "sources.rollback_failed",
    "credential-platform": "sources.native_required",
  };
  return t(
    key[typeof error === "string" ? error : ""] || "sources.save_failed",
  );
};
export default function DanmakuSourceSettings({
  value,
  onChange,
}: {
  value?: SourceSettings;
  onChange: (update: SourceUpdate) => void;
}) {
  useI18n();
  const riskId = useId();
  const config = normalizeSources(value);
  const [draft, setDraft] = useState<DanmakuSource | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const task = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  const latest = useRef(config);
  latest.current = config;
  const original = useRef<DanmakuSource | null>(null);
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const keyScope = JSON.stringify(
    config.sources.map((s) => [s.id, s.endpoint, s.keyRevision]),
  );
  useEffect(() => {
    let active = true;
    setKeys((old) =>
      Object.fromEntries(
        Object.entries(old).filter(([id]) =>
          config.sources.some((s) => s.id === id),
        ),
      ),
    );
    for (const source of config.sources.filter(
      (s) => s.protocol === "logvar",
    )) {
      if (!isTauri()) continue;
      void invoke<Receipt>("danmaku_source_key", {
        sourceId: source.id,
        endpoint: source.endpoint,
        action: "status",
        ...(source.allowLanHttp === true ? { allowLanHttp: true } : {}),
      })
        .then((value) => {
          if (active)
            setKeys((old) => ({
              ...old,
              [source.id]: value?.state || "unavailable",
            }));
        })
        .catch(() => {
          if (active)
            setKeys((old) => ({ ...old, [source.id]: "unavailable" }));
        });
    }
    return () => {
      active = false;
    };
  }, [keyScope]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current++;
      task.current?.abort();
    };
  }, []);
  async function change(next: SourceSettings) {
    if (locked.current) return;
    const current = ++revision.current;
    task.current?.abort();
    try {
      const plan = sourceChange(config, next);
      await onChange((current) => plan(current).value);
      if (mounted.current && current === revision.current)
        setStatus(t("sources.saved"));
    } catch {
      if (mounted.current && current === revision.current)
        setStatus(t("sources.settings_failed"));
    }
  }
  const update = (source: DanmakuSource) =>
    change({
      ...config,
      sources: config.sources.map((s) => (s.id === source.id ? source : s)),
    });
  async function mutate(
    source: DanmakuSource,
    next: SourceSettings,
    action: "save" | "clear" | "delete",
    success: string,
  ) {
    if (locked.current) return;
    locked.current = true;
    const current = ++revision.current;
    const before = latest.current;
    const plan = sourceChange(before, next);
    setBusy(true);
    setStatus("");
    let receipt: Receipt | undefined;
    let published = false;
    let rollback: SourceUpdate | undefined;
    const finish = (action: "rollback" | "finish") =>
      invoke("danmaku_source_key", {
        sourceId: source.id,
        endpoint: source.endpoint,
        action,
        transaction: receipt?.transaction,
      });
    try {
      if (!isTauri()) throw "credential-platform";
      receipt = await invoke<Receipt>("danmaku_source_key", {
        sourceId: source.id,
        endpoint: source.endpoint,
        action,
        ...(source.allowLanHttp === true ? { allowLanHttp: true } : {}),
        ...(action === "save" && token ? { token } : {}),
      });
      if (!receipt?.transaction) throw "credential-write";
      if (!mounted.current || current !== revision.current)
        throw "credential-stale";
      try {
        await onChange((live) => {
          const change = plan(live);
          rollback = change.rollback;
          return change.value;
        });
      } catch (error) {
        if (error === "credential-stale") throw error;
        throw "settings-write";
      }
      published = true;
      await finish("finish");
      if (mounted.current && current === revision.current) {
        setKeys((old) => ({ ...old, [source.id]: receipt!.state }));
        setToken("");
        if (action !== "clear") setDraft(null);
        else
          setDraft(
            (old) =>
              old && {
                ...old,
                keyRevision: next.sources.find((s) => s.id === source.id)
                  ?.keyRevision,
              },
          );
        setStatus(success);
      }
    } catch (error) {
      let failedRollback = false;
      if (published) {
        try {
          if (!rollback) throw "credential-stale";
          await onChange(rollback);
        } catch {
          failedRollback = true;
        }
      }
      if (receipt?.transaction) {
        try {
          await finish("rollback");
        } catch {
          failedRollback = true;
        }
      }
      if (mounted.current && current === revision.current)
        setStatus(
          failedRollback
            ? t("sources.rollback_failed")
            : error === "settings-write"
              ? t("sources.settings_failed")
              : keyError(error),
        );
    } finally {
      locked.current = false;
      if (mounted.current && current === revision.current) setBusy(false);
    }
  }
  async function save() {
    if (!draft || locked.current) return;
    if (
      !draft.name.trim() ||
      draft.name.trim().length > 60 ||
      /[\u0000-\u001f]/.test(draft.name)
    ) {
      setStatus(t("sources.name_invalid"));
      return;
    }
    if (!draft.endpoint.trim()) {
      setStatus(t("sources.endpoint_empty"));
      return;
    }
    if (needsLanHttpConsent(draft.endpoint) && !draft.allowLanHttp) {
      setStatus(t("sources.lan_http_required"));
      return;
    }
    if (
      !validEndpoint(draft.endpoint, draft.allowLanHttp) ||
      endpointContainsToken(draft.endpoint, token)
    ) {
      setStatus(t("sources.endpoint_invalid"));
      return;
    }
    if (
      new TextEncoder().encode(token).length > 512 ||
      /[\u0000-\u001f]/.test(token) ||
      token.trim() !== token
    ) {
      setStatus(t("sources.token_invalid"));
      return;
    }
    if (
      !Number.isInteger(draft.priority) ||
      draft.priority < 0 ||
      draft.priority > 99
    ) {
      setStatus(t("sources.priority_invalid"));
      return;
    }
    const existing = config.sources.find((s) => s.id === draft.id);
    if (
      (original.current &&
        (!existing || existing.endpoint !== original.current.endpoint)) ||
      (!original.current && existing)
    ) {
      setStatus(t("sources.stale"));
      return;
    }
    if (
      !draft.anonymous &&
      !token &&
      !(existing && ["saved", "session"].includes(keys[draft.id]))
    ) {
      setStatus(
        t(
          keys[draft.id] === "unavailable"
            ? "sources.key_unavailable"
            : "sources.token_missing",
        ),
      );
      return;
    }
    const source = {
      ...(existing || draft),
      ...(original.current
        ? changedSourceFields(original.current, draft)
        : draft),
      name:
        original.current && draft.name === original.current.name && existing
          ? existing.name
          : draft.name.trim(),
      keyRevision: (existing?.keyRevision || draft.keyRevision || 0) + 1,
    };
    await mutate(
      source,
      {
        ...config,
        sources: [...config.sources.filter((s) => s.id !== draft.id), source],
      },
      source.anonymous ? "clear" : "save",
      t("sources.saved"),
    );
  }
  async function health(source: DanmakuSource) {
    task.current?.abort();
    const c = new AbortController();
    task.current = c;
    setBusy(true);
    setStatus("");
    try {
      const result = await compatibleTransport(
        source,
        { kind: "health" },
        c.signal,
      );
      validateProviderEnvelope(result);
      if (!result || !Array.isArray((result as { animes?: unknown }).animes))
        throw Error("format");
      if (!c.signal.aborted) setStatus(t("sources.healthy"));
    } catch (e) {
      if (!c.signal.aborted)
        setStatus(
          t("sources.health_failed", { kind: sourceError(onlineErrorKind(e)) }),
        );
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="danmaku-source-settings">
      <h3>{t("sources.title")}</h3>
      <p className="setting-note">{t("sources.hint")}</p>
      <p className="setting-note">{t("sources.mode_hint")}</p>
      <fieldset className="source-group source-selection">
        <legend>{t("sources.group_selection")}</legend>
        <label>
          {t("sources.mode")}
          <Select
            value={config.mode}
            disabled={busy}
            onChange={(e) => void change({ ...config, mode: e.target.value })}
          >
            <option value="auto">{t("sources.auto")}</option>
            {config.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      </fieldset>
      <fieldset className="source-group source-behavior-list">
        <legend>{t("sources.group_behavior")}</legend>
        {config.sources.map((s) => (
          <div key={s.id} className="danmaku-source-row">
            <label className="source-toggle">
              <input
                type="checkbox"
                disabled={busy || !!draft}
                checked={s.enabled}
                onChange={(e) => update({ ...s, enabled: e.target.checked })}
              />
              {s.name}
            </label>
            <label>
              {t("sources.priority")}
              <input
                aria-label={`${s.name} ${t("sources.priority")}`}
                type="number"
                disabled={busy || !!draft}
                min={0}
                max={99}
                value={s.priority}
                onChange={(e) =>
                  update({ ...s, priority: Number(e.target.value) })
                }
              />
            </label>
            {s.protocol === "logvar" && (
              <>
                <small className="source-key-state">
                  {t(
                    keys[s.id] === "unavailable"
                      ? "sources.key_unavailable"
                      : keys[s.id] === "saved"
                        ? "sources.key_saved"
                        : keys[s.id] === "session"
                          ? "sources.key_session"
                          : keys[s.id] === "missing"
                            ? "sources.key_missing"
                            : "sources.key_checking",
                  )}
                </small>
                <div className="source-row-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      original.current = s;
                      setDraft(s);
                      setToken("");
                      setStatus("");
                    }}
                  >
                    {t("sources.edit")}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void health(s)}
                  >
                    {t("sources.check")}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        s,
                        {
                          ...config,
                          mode:
                            config.mode === s.id ? "dandanplay" : config.mode,
                          sources: config.sources.filter((x) => x.id !== s.id),
                        },
                        "delete",
                        t("sources.removed"),
                      )
                    }
                  >
                    {t("sources.remove")}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </fieldset>
      {!draft && (
        <button
          className="secondary"
          disabled={busy || config.sources.length >= 12}
          onClick={() => {
            original.current = null;
            setDraft({
              id: crypto.randomUUID(),
              name: "LogVar",
              protocol: "logvar",
              endpoint: "",
              enabled: true,
              priority: config.sources.length,
              anonymous: false,
            });
            setToken("");
          }}
        >
          {t("sources.add")}
        </button>
      )}
      {draft && (
        <div className="danmaku-source-editor" aria-busy={busy}>
          <p>{t("sources.edit_hint")}</p>
          <fieldset className="source-group">
            <legend>{t("sources.group_basic")}</legend>
            <label>
              {t("sources.name")}
              <input
                maxLength={60}
                disabled={busy}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              {t("sources.endpoint")}
              <input
                maxLength={2048}
                disabled={busy}
                value={draft.endpoint}
                placeholder="https://danmaku.example.com"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    endpoint: e.target.value,
                    allowLanHttp:
                      e.target.value.replace(/\/+$/, "") ===
                      draft.endpoint.replace(/\/+$/, "")
                        ? draft.allowLanHttp
                        : false,
                  })
                }
              />
            </label>
          </fieldset>
          <fieldset className="source-group">
            <legend>{t("sources.group_credentials")}</legend>
            <label>
              {t("sources.token")}
              <input
                type="password"
                autoComplete="off"
                maxLength={512}
                disabled={busy || draft.anonymous}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <p className="setting-note">{t("sources.key_edit_hint")}</p>
            <p className="source-key-state">
              {t(
                keys[draft.id] === "saved"
                  ? "sources.key_saved"
                  : keys[draft.id] === "session"
                    ? "sources.key_session"
                    : keys[draft.id] === "unavailable"
                      ? "sources.key_unavailable"
                      : keys[draft.id] === "endpoint-changed"
                        ? "sources.endpoint_changed"
                        : "sources.key_missing",
              )}
            </p>
            <label className="source-toggle">
              <input
                type="checkbox"
                disabled={busy}
                checked={draft.anonymous === true}
                onChange={(e) => {
                  setDraft({ ...draft, anonymous: e.target.checked });
                  if (e.target.checked) setToken("");
                }}
              />
              {t("sources.anonymous")}
            </label>
          </fieldset>
          <fieldset className="source-group">
            <legend>{t("sources.group_behavior")}</legend>
            <label>
              {t("sources.priority")}
              <input
                type="number"
                min={0}
                max={99}
                disabled={busy}
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: Number(e.target.value) })
                }
              />
            </label>
            <label className="source-toggle">
              <input
                type="checkbox"
                disabled={busy}
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              {t("sources.enabled")}
            </label>
          </fieldset>
          <fieldset className="source-group source-authorization">
            <legend>{t("sources.group_http")}</legend>{" "}
            {needsLanHttpConsent(draft.endpoint) && (
              <label className="source-toggle">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={draft.allowLanHttp === true}
                  aria-describedby={riskId}
                  onChange={(e) =>
                    setDraft({ ...draft, allowLanHttp: e.target.checked })
                  }
                />
                {t("sources.lan_http_confirm")}
              </label>
            )}
            <p className="setting-note">{t("sources.endpoint_hint")}</p>
            {needsLanHttpConsent(draft.endpoint) && (
              <p id={riskId} className="source-http-warning">
                {t("sources.lan_http_warning")}
              </p>
            )}
          </fieldset>
          <section
            className="source-notes"
            aria-label={t("sources.group_notes")}
          >
            <h4>{t("sources.group_notes")}</h4>
            <p className="setting-note">{t("sources.token_hint")}</p>
          </section>
          <div className="source-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void save()}
            >
              {t(
                keys[draft.id] === "unavailable" && token
                  ? "sources.save_recover"
                  : "sources.save",
              )}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setToken("");
              }}
            >
              {t("sources.cancel")}
            </button>
            {config.sources.some((s) => s.id === draft.id) && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  const saved = config.sources.find((s) => s.id === draft.id);
                  if (saved)
                    void mutate(
                      saved,
                      {
                        ...config,
                        sources: config.sources.map((s) =>
                          s.id === draft.id
                            ? { ...s, keyRevision: (s.keyRevision || 0) + 1 }
                            : s,
                        ),
                      },
                      "clear",
                      t("sources.key_cleared"),
                    );
                }}
              >
                {t("sources.clear_key")}
              </button>
            )}
          </div>
        </div>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
