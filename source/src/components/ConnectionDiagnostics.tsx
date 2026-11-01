import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { EmbyClient } from "../api/client";
import type { Account } from "../types/emby";
import { t, localizeMessage } from "../i18n/core";
import { privateError } from "../privacy";
import { APP_VERSION } from "../version";
import {
  readNetworkDiagnostics,
  recordNetwork,
  type NetworkCategory,
} from "../api/diagnostics";
import { ActionRow } from "./SettingField";
const networkLabels: Record<string, string> = {
  get permission() {
    return t("settings.client_permission_denied");
  },
  get dns() {
    return t("settings.hostname_lookup_failed");
  },
  get tcp() {
    return t("settings.could_not_connect");
  },
  get tls() {
    return t("settings.tls_or_certificate_validation_failed");
  },
  get timeout() {
    return t("settings.request_timed_out");
  },
  get http() {
    return t("settings.server_returned_an_error");
  },
  get format() {
    return t("settings.invalid_emby_data_format");
  },
  get network() {
    return t("settings.network_request_failed");
  },
};
export default function ConnectionDiagnostics({
  account,
  disabled = false,
}: {
  account: Account;
  disabled?: boolean;
}) {
  const api = new EmbyClient(account);
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function check() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setResult("");
    const began = performance.now();
    try {
      const info = await api.serverInfo(controller.signal);
      if (!controller.signal.aborted)
        setResult(
          t("settings.connected_ms", {
            p0: /^\d+(?:\.\d+){1,3}$/.test(info.Version)
              ? ` · Emby ${info.Version}`
              : "",
            p1: Math.round(performance.now() - began),
          }),
        );
    } catch (e) {
      if (!controller.signal.aborted) setResult(privateError(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      pending.current = null;
    }
  }
  async function diagnose() {
    if (pending.current || !isTauri()) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setResult("");
    try {
      const report = await invoke<{
        stage: string;
        backend: string;
        url: string;
        status?: number;
        redirectStatuses: number[];
        contentType?: string;
        elapsedMs: number;
        category: string;
        errors: string[];
        validServerInfo: boolean;
        bodyPreview: string;
      }>("diagnose_server", { server: api.account.server });
      if (controller.signal.aborted) return;
      recordNetwork({
        stage: report.stage,
        method: "GET",
        url: report.url,
        backend: report.backend,
        status: report.status,
        redirected: report.redirectStatuses.length > 0,
        redirectStatuses: report.redirectStatuses,
        contentType: report.contentType,
        bodyPreview: report.bodyPreview,
        elapsedMs: report.elapsedMs,
        category:
          report.category === "ok"
            ? undefined
            : (report.category as NetworkCategory),
        underlying: report.errors.join(" → "),
      });
      setResult(
        report.validServerInfo && report.status === 200
          ? t("settings.native_connection_ok_http_200_ms", {
              p0: report.elapsedMs,
            })
          : t("settings.copy_diagnostics_for_details", {
              p0:
                networkLabels[report.category] ||
                t("settings.connection_diagnostics_failed"),
              p1: report.status ? ` · HTTP ${report.status}` : "",
            }),
      );
    } catch {
      if (!controller.signal.aborted)
        setResult(t("settings.native_diagnostics_could_not_be_completed_try"));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  }
  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          { version: APP_VERSION, requests: readNetworkDiagnostics() },
          null,
          2,
        ),
      );
      setResult(
        t(
          "settings.anonymous_diagnostics_copied_server_addresses_passwords_and",
        ),
      );
    } catch {
      setResult(
        t("settings.could_not_copy_diagnostics_check_clipboard_permissions"),
      );
    }
  }
  return (
    <details className="connection-diagnostics">
      <summary>{t("routeUi.diagnostics")}</summary>
      <p className="connection-address">{account.server}</p>
      <ActionRow>
        <button
          className="secondary"
          disabled={disabled || busy}
          onClick={check}
        >
          <RefreshCw size={15} className={busy ? "spin" : ""} />
          {busy ? t("settings.checking") : t("settings.check_connection")}
        </button>
        {isTauri() && (
          <button
            className="secondary"
            disabled={disabled || busy}
            onClick={diagnose}
          >
            {" "}
            {t("settings.run_native_diagnostics")}{" "}
          </button>
        )}
        <button
          className="secondary"
          disabled={disabled || busy}
          onClick={copyDiagnostics}
        >
          {" "}
          {t("settings.copy_connection_diagnostics")}{" "}
        </button>
      </ActionRow>
      {result && (
        <p role="status" className="connection-result">
          {localizeMessage(result)}
        </p>
      )}
    </details>
  );
}
