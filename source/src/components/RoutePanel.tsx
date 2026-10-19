import useDialogFocus from "./useDialogFocus";
import { SettingRow } from "./SettingField";
import Select from "./Select";
import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Trash2 } from "lucide-react";
import type { Account } from "../types/emby";
import type { Item } from "../types/emby";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  readRouteQuality,
  setRouteMode,
  testRoute,
  routeDetail,
} from "../player/smartRoutes";
import { privateError, routeLabel } from "../privacy";
import {
  readRoutes,
  activeRoutes,
  saveRoute,
  deleteRoute,
  verifyRoute,
  type ServerRoute,
} from "../stores/routes";
export default function RoutePanel({
  account,
  onClose: finishClose,
  onSwitch,
  media,
}: {
  account: Account;
  onClose: () => void;
  onSwitch: (route: ServerRoute, signal: AbortSignal) => Promise<void>;
  media?: { item: Item; sourceId: string };
}) {
  const [routes, setRoutes] = useState(() => readRoutes(account)),
    [name, setName] = useState(""),
    [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState(() => readRouteQuality(account));
  const pending = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const onClose = useDialogFocus(panel, finishClose);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => setRoutes(readRoutes(account)), [account]);
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
      >
        <header>
          <h2 id="routes-title">
            {activeRoutes(account).length > 1 ? "连接线路" : "连接地址"}
          </h2>
          <button aria-label="关闭线路设置" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="settings-body">
          {activeRoutes(account).length > 1 && (
            <>
              <SettingRow title="线路选择">
                <Select
                  aria-label="线路选择"
                  value={quality.mode}
                  disabled={busy}
                  onChange={(e) =>
                    setRouteMode(account, e.target.value as "auto" | "manual")
                  }
                >
                  <option value="manual">手动固定</option>
                  <option value="auto">自动选择（空闲时）</option>
                </Select>
              </SettingRow>
              <p className="setting-note">
                自动选择仅在未播放时采用最近推荐。播放异常只提示；手动选择线路会固定，不会被推荐抢走。
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
                    {routeLabel(route.name, index)}
                    {route.url === account.server ? " · 当前" : ""}
                  </strong>
                  <small className="connection-address">{route.url}</small>
                  {results[route.url] && (
                    <small role="status">{results[route.url]}</small>
                  )}
                  {activeRoutes(account).length > 1 &&
                    quality.tests[route.url] && (
                      <small title={routeDetail(quality.tests[route.url])}>
                        {quality.recommended === route.url
                          ? "推荐"
                          : quality.tests[route.url].label}
                        {quality.pinned === route.url ? " · 已固定" : ""} ·{" "}
                        {routeDetail(quality.tests[route.url])}
                      </small>
                    )}
                </div>
                <div className="route-row-buttons">
                  {isTauri() && activeRoutes(account).length > 1 && (
                    <button
                      className="secondary"
                      aria-label={`评估 ${routeLabel(route.name, index)}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          await testRoute(account, route, signal);
                          setQuality(readRouteQuality(account));
                        })
                      }
                    >
                      评估 API
                    </button>
                  )}
                  {isTauri() && media && activeRoutes(account).length > 1 && (
                    <button
                      className="secondary"
                      aria-label={`吞吐 ${routeLabel(route.name, index)}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          await testRoute(account, route, signal, media);
                          setQuality(readRouteQuality(account));
                        })
                      }
                    >
                      小样本吞吐
                    </button>
                  )}
                  {activeRoutes(account).length > 1 && (
                    <button
                      className="secondary"
                      aria-label={`检测 ${routeLabel(route.name, index)}`}
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          const result = await verifyRoute(
                            account,
                            route.url,
                            signal,
                          );
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
                    disabled={busy || route.url === account.server}
                    onClick={() =>
                      void run((signal) => onSwitch(route, signal))
                    }
                  >
                    使用
                  </button>
                  {route.url !== account.server &&
                    route.url !== (account.homeServer || account.server) && (
                      <button
                        className="secondary route-delete"
                        aria-label={`删除 ${routeLabel(route.name, index)}`}
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
          <form
            className="route-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async (signal) => {
                const checked = await verifyRoute(account, address, signal);
                saveRoute(account, {
                  name: routeLabel(name.trim(), routes.length),
                  url: checked.url,
                  serverId: checked.serverId,
                  userId: checked.userId,
                });
                setRoutes(readRoutes(account));
                setResults((all) => ({
                  ...all,
                  [checked.url]: `${checked.latency} ms`,
                }));
                setName("");
                setAddress("");
              });
            }}
          >
            <label>
              线路名称
              <input
                aria-label="线路名称"
                placeholder="内网 / 外网 / 备用"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                maxLength={40}
              />
            </label>
            <label>
              连接地址
              <input
                aria-label="线路地址"
                type="url"
                autoComplete="off"
                spellCheck={false}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="粘贴连接地址"
                disabled={busy}
              />
            </label>
            <button className="primary" disabled={busy}>
              验证并添加
            </button>
          </form>
          {busy && (
            <button
              className="secondary compact"
              onClick={() => pending.current?.abort()}
            >
              取消
            </button>
          )}
          {error && (
            <p role="alert" className="play-error">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
