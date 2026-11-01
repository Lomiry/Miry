import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import useDialogFocus from "./useDialogFocus";
import { SettingRow } from "./SettingField";
import Select from "./Select";
import RouteEditor from "./RouteEditor";
import CertificateOption from "./CertificateOption";
import ServerPreferences from "./ServerPreferences";
import ConnectionDiagnostics from "./ConnectionDiagnostics";
import { connectionLabel } from "../stores/connections";
import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Trash2 } from "lucide-react";
import type { Account } from "../types/emby";
import type { Item } from "../types/emby";
import { isTauri } from "@tauri-apps/api/core";
import {
  readRouteQuality,
  setRouteMode,
  testRoute,
  routeDetail,
} from "../player/smartRoutes";
import { privateError } from "../privacy";
import {
  readRoutes,
  routeDisplayName,
  activeRoutes,
  saveRoute,
  deleteRoute,
  verifyRoute,
  captureRoute,
  currentRoute,
  updateRouteFailure,
  type ServerRoute,
  type VerifiedRoute,
} from "../stores/routes";
export default function RoutePanel({
  account,
  onClose: finishClose,
  onSwitch,
  media,
  onUpdate,
}: {
  account: Account;
  onClose: () => void;
  onSwitch: (
    route: ServerRoute,
    signal: AbortSignal,
    checked?: VerifiedRoute,
  ) => Promise<void>;
  media?: { item: Item; sourceId: string };
  onUpdate?: (account: Account) => void;
}) {
  useI18n();

  const [routes, setRoutes] = useState(() => readRoutes(account)),
    [name, setName] = useState(""),
    [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState(() => readRouteQuality(account));
  const [editing, setEditing] = useState<ServerRoute | null>(null);
  const [tls, setTls] = useState(false);
  const pending = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const requestClose = useDialogFocus(panel, finishClose);
  const onClose = () => {
    pending.current?.abort();
    requestClose();
  };
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    pending.current?.abort();
    setRoutes(readRoutes(account));
    setEditing(null);
  }, [account]);
  useEffect(() => {
    const update = () => setQuality(readRouteQuality(account));
    window.addEventListener("miry-route-quality", update);
    update();
    return () => window.removeEventListener("miry-route-quality", update);
  }, [account]);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      await action(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError(privateError(e));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="settings-panel route-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="routes-title"
        ref={panel}
        onKeyDown={(e) => {
          if (e.key === "Escape") pending.current?.abort();
        }}
      >
        <header>
          <h2 id="routes-title">{t("routeUi.title")}</h2>
          <button
            aria-label={t("network.close_route_settings")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="settings-body">
          <p className="route-intro">
            {connectionLabel(account)} · {t("routeUi.description")}
          </p>
          {activeRoutes(account).length > 1 && (
            <>
              <SettingRow title={t("network.route_selection")}>
                <Select
                  aria-label={t("network.route_selection")}
                  value={quality.mode}
                  disabled={busy}
                  onChange={(e) =>
                    setRouteMode(account, e.target.value as "auto" | "manual")
                  }
                >
                  <option value="manual">{t("network.manual_pinned")}</option>
                  <option value="auto">
                    {t("network.auto_select_when_idle")}
                  </option>
                </Select>
              </SettingRow>
              <p className="setting-note">
                {" "}
                {t(
                  "network.auto_select_uses_the_latest_recommendation_only",
                )}{" "}
              </p>
            </>
          )}
          <div className="route-list">
            {routes.map((route, index) => (
              <article
                className="route-row"
                key={route.url}
                aria-current={route.url === account.server ? "true" : undefined}
              >
                <div>
                  <strong>
                    {routeDisplayName(route, index)}
                    {route.url === account.server ? t("network.current") : ""}
                  </strong>
                  {route.url === (account.homeServer || account.server) &&
                    route.generatedName !== "default" && (
                      <small className="route-badge">
                        {t("network.default_route")}
                      </small>
                    )}
                  <small className="connection-address">{route.url}</small>
                  {route.status === "pending" && (
                    <small>{t("routeC.pending")}</small>
                  )}
                  {route.enabled === false && (
                    <small>{t("routeC.enabled")}: ✕</small>
                  )}
                  {route.failure && (
                    <small role="status">{displayError(route.failure)}</small>
                  )}
                  {results[route.url] && (
                    <small role="status">{results[route.url]}</small>
                  )}
                  {activeRoutes(account).length > 1 &&
                    quality.tests[route.url] && (
                      <small title={routeDetail(quality.tests[route.url])}>
                        {quality.recommended === route.url
                          ? t("library.recommended")
                          : quality.tests[route.url].label}
                        {quality.pinned === route.url
                          ? t("network.pinned")
                          : ""}{" "}
                        · {routeDetail(quality.tests[route.url])}
                      </small>
                    )}
                </div>
                <div className="route-row-buttons">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setEditing(route)}
                    aria-label={`${t("routeC.edit_route")} ${routeDisplayName(route, index)}`}
                  >
                    {t("routeC.edit_route")}
                  </button>
                  {isTauri() && activeRoutes(account).length > 1 && (
                    <button
                      className="secondary"
                      aria-label={t("network.check", {
                        p0: routeDisplayName(route, index),
                      })}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          await testRoute(account, route, signal);
                          setQuality(readRouteQuality(account));
                        })
                      }
                    >
                      {" "}
                      {t("player.check_api")}{" "}
                    </button>
                  )}
                  {isTauri() && media && activeRoutes(account).length > 1 && (
                    <button
                      className="secondary"
                      aria-label={t("network.test_throughput_for", {
                        p0: routeDisplayName(route, index),
                      })}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          await testRoute(account, route, signal, media);
                          setQuality(readRouteQuality(account));
                        })
                      }
                    >
                      {" "}
                      {t("player.sample_throughput")}{" "}
                    </button>
                  )}
                  {(route.status === "pending" ||
                    activeRoutes(account).length > 1) && (
                    <button
                      className="secondary"
                      aria-label={t("network.verify", {
                        p0: routeDisplayName(route, index),
                      })}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          const lease = captureRoute(account, route);
                          let result: VerifiedRoute;
                          try {
                            result = await verifyRoute(
                              account,
                              route.url,
                              signal,
                              route.ignoreCertificateErrors === true,
                            );
                          } catch (e) {
                            if (!signal.aborted) {
                              updateRouteFailure(
                                account,
                                lease,
                                privateError(e),
                              );
                              setRoutes(readRoutes(account));
                            }
                            throw e;
                          }
                          if (signal.aborted || !currentRoute(account, lease))
                            throw new DOMException("Aborted", "AbortError");
                          saveRoute(account, {
                            ...route,
                            serverId: result.serverId,
                            userId: result.userId,
                            status: "verified",
                            failure: undefined,
                          });
                          setRoutes(readRoutes(account));
                          setResults((all) => ({
                            ...all,
                            [route.url]: `${result.latency} ms`,
                          }));
                        })
                      }
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={
                      busy ||
                      route.url === account.server ||
                      route.enabled === false ||
                      route.status === "pending"
                    }
                    onClick={() =>
                      void run((signal) => onSwitch(route, signal))
                    }
                  >
                    {" "}
                    {t("network.use")}{" "}
                  </button>
                  {route.url !== account.server &&
                    route.url !== (account.homeServer || account.server) && (
                      <button
                        className="secondary route-delete"
                        aria-label={t("network.remove", {
                          p0: routeDisplayName(route, index),
                        })}
                        disabled={busy}
                        onClick={() => {
                          deleteRoute(account, route.url);
                          setRoutes(readRoutes(account));
                        }}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
          {editing && (
            <RouteEditor
              key={editing.url}
              route={editing}
              account={account}
              busy={busy}
              run={run}
              onSaved={() => setRoutes(readRoutes(account))}
              onSwitch={onSwitch}
              onCancel={() => {
                setEditing(null);
                setError("");
              }}
            />
          )}
          {!editing && (
            <form
              id="route-add-form"
              className="route-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async (signal) => {
                  const checked = await verifyRoute(
                    account,
                    address,
                    signal,
                    tls,
                  );
                  if (signal.aborted) return;
                  saveRoute(account, {
                    name:
                      name.trim() ||
                      t("network.route_number", { p0: routes.length + 1 }),
                    generatedName: name.trim() ? undefined : "number",
                    url: checked.url,
                    serverId: checked.serverId,
                    userId: checked.userId,
                    ignoreCertificateErrors: tls || undefined,
                    status: "verified",
                  });
                  setRoutes(readRoutes(account));
                  setResults((all) => ({
                    ...all,
                    [checked.url]: `${checked.latency} ms`,
                  }));
                  setName("");
                  setAddress("");
                  setTls(false);
                });
              }}
            >
              <h3>{t("routeUi.add")}</h3>
              <label>
                {" "}
                {t("network.route_name")}{" "}
                <input
                  aria-label={t("network.route_name")}
                  placeholder={t("network.local_remote_backup")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  maxLength={40}
                />
              </label>
              <label>
                {" "}
                {t("network.connection_address")}{" "}
                <input
                  aria-label={t("network.route_address")}
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setTls(false);
                  }}
                  placeholder={t("network.paste_connection_address")}
                  disabled={busy}
                />
              </label>
              <div className="route-security">
                <CertificateOption
                  value={tls}
                  onChange={setTls}
                  disabled={busy}
                />
              </div>
              {error && (
                <p role="alert" className="play-error">
                  {displayError(error)}
                </p>
              )}
            </form>
          )}
          {busy && (
            <button
              className="secondary compact"
              onClick={() => pending.current?.abort()}
            >
              {" "}
              {t("network.cancel")}{" "}
            </button>
          )}
          {editing && error && (
            <p role="alert" className="play-error">
              {displayError(error)}
            </p>
          )}
          {onUpdate && (
            <details className="server-preferences">
              <summary>{t("routeUi.server_details")}</summary>
              <ServerPreferences
                account={account}
                onUpdate={onUpdate}
                disabled={busy}
              />
            </details>
          )}
          <ConnectionDiagnostics
            key={account.server}
            account={account}
            disabled={busy}
          />
        </div>
        <footer className="route-footer">
          <button
            className="secondary"
            onClick={() => {
              if (editing) {
                setEditing(null);
                setError("");
              } else onClose();
            }}
            disabled={busy && !!editing}
          >
            {t("network.cancel")}
          </button>
          <button
            className="primary"
            type="submit"
            form={editing ? "route-edit-form" : "route-add-form"}
            disabled={busy || (!editing && !address.trim())}
          >
            {editing ? t("routeC.save") : t("network.verify_and_add")}
          </button>
        </footer>
      </section>
    </div>
  );
}
