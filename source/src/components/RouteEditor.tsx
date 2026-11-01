import { useState } from "react";
import type { Account } from "../types/emby";
import { normalizeServer } from "../api/client";
import {
  saveRoute,
  deleteRoute,
  verifyRoute,
  type ServerRoute,
  type VerifiedRoute,
} from "../stores/routes";
import { t } from "../i18n/core";
import CertificateOption from "./CertificateOption";

export default function RouteEditor({
  route,
  account,
  busy,
  run,
  onSaved,
  onSwitch,
  onCancel,
}: {
  route: ServerRoute;
  account: Account;
  busy: boolean;
  run: (action: (signal: AbortSignal) => Promise<void>) => Promise<void>;
  onSaved: () => void;
  onSwitch: (
    route: ServerRoute,
    signal: AbortSignal,
    checked?: VerifiedRoute,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(route.name),
    [url, setUrl] = useState(route.url);
  const [enabled, setEnabled] = useState(route.enabled !== false),
    [priority, setPriority] = useState(route.priority ?? 100);
  const [tls, setTls] = useState(route.ignoreCertificateErrors === true);
  return (
    <form
      id="route-edit-form"
      className="route-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async (signal) => {
          if (!enabled && route.url === account.server)
            throw Error(t("routeC.active_protected"));
          const address = normalizeServer(url);
          const changed =
            address !== route.url ||
            tls !== (route.ignoreCertificateErrors === true) ||
            route.status === "pending";
          const checked = changed
            ? await verifyRoute(account, address, signal, tls)
            : undefined;
          if (signal.aborted) return;
          const next: ServerRoute = {
            ...route,
            ...checked,
            url: address,
            name: name.trim(),
            generatedName: undefined,
            enabled,
            priority,
            ignoreCertificateErrors: tls,
            status: checked ? "verified" : route.status,
            failure: undefined,
          };
          // The existing switch path serializes playback and account persistence.
          saveRoute(account, next);
          if (changed && route.url === account.server) {
            await onSwitch(next, signal, checked);
            return;
          }
          if (
            changed &&
            address !== route.url &&
            route.url !== account.server &&
            route.url !== (account.homeServer || account.server)
          ) {
            deleteRoute(account, route.url);
          }
          onSaved();
          onCancel();
        });
      }}
    >
      <h3>{t("routeC.edit_route")}</h3>
      <label>
        {t("network.route_name")}
        <input
          required
          value={name}
          maxLength={40}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        {t("network.connection_address")}
        <input
          aria-label={t("routeC.edit_route")}
          type="url"
          required
          value={url}
          disabled={busy}
          onChange={(e) => {
            setUrl(e.target.value);
            setTls(false);
          }}
        />
      </label>
      <label>
        {t("routeC.priority")}
        <input
          type="number"
          min={0}
          max={999}
          required
          value={priority}
          disabled={busy}
          onChange={(e) => setPriority(Number(e.target.value))}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || route.url === account.server}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t("routeC.enabled")}
      </label>
      <div className="route-security">
        <CertificateOption value={tls} onChange={setTls} disabled={busy} />
      </div>
    </form>
  );
}
