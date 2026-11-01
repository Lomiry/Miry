import { useState, useEffect, useRef } from "react";
import type { Account } from "../types/emby";
import { t } from "../i18n/core";
import {
  loadIconCatalog,
  readIconPreference,
  saveIconPreference,
  safeIconUrl,
  cachedIconCatalog,
  resolveProviderIconTrace,
} from "../stores/providerIcons";
import ServerIcon from "./ServerIcon";

export default function ServerPreferences({
  account,
  onUpdate,
  disabled = false,
}: {
  account: Account;
  disabled?: boolean;
  onUpdate: (a: Account) => void;
}) {
  const [remark, setRemark] = useState(account.remark || ""),
    [pref, setPref] = useState(() => readIconPreference(account));
  const [feedback, setFeedback] = useState(""),
    [loading, setLoading] = useState(false);
  const [imageStatus, setImageStatus] = useState<
    "loading" | "loaded" | "fallback"
  >("fallback");
  const identity = JSON.stringify([
    account.serverId,
    account.homeServer || account.server,
    account.userId,
  ]);
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => {
    setRemark(account.remark || "");
    setPref(readIconPreference(account));
  }, [account]);
  useEffect(() => {
    setFeedback("");
    setLoading(false);
  }, [identity]);
  return (
    <form
      className="route-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (pref.override && !safeIconUrl(pref.override)) {
          setFeedback(t("routeC.icon_failed"));
          return;
        }
        // Provider/override fields are explicit user choices; never infer them
        // from a previous display name or alter the server/account identity.
        try {
          saveIconPreference(account, pref);
          if (remark.trim() !== (account.remark || ""))
            onUpdate({ ...account, remark: remark.trim() });
          const resolution = resolveProviderIconTrace(
            account,
            cachedIconCatalog(),
            pref,
          );
          setFeedback(
            t(
              pref.provider && !pref.override && !resolution.url
                ? "routeUi.icon_unknown"
                : "routeUi.saved",
            ),
          );
        } catch {
          setFeedback(t("routeUi.save_failed"));
        }
      }}
    >
      <fieldset disabled={disabled || loading}>
        <label>
          {t("library.server_remark")}
          <input
            maxLength={60}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </label>
        <ServerIcon
          account={{ ...account, remark }}
          onStatus={setImageStatus}
        />
        <small role="status">{t(`routeUi.icon_${imageStatus}`)}</small>
        <p className="setting-note">{t("routeUi.brand_hint")}</p>
        <label>
          {t("routeC.provider")}
          <input
            maxLength={100}
            value={pref.provider}
            onChange={(e) => setPref({ ...pref, provider: e.target.value })}
          />
        </label>
        <label>
          {t("routeC.icon_url")}
          <input
            type="url"
            value={pref.override}
            onChange={(e) => setPref({ ...pref, override: e.target.value })}
          />
        </label>
        <a
          className="setting-note"
          href="https://github.com/lige47/lige_icon"
          target="_blank"
          rel="noreferrer"
        >
          {t("routeC.icon_source")}
        </a>
        <button
          className="secondary"
          disabled={loading}
          aria-busy={loading}
          type="button"
          onClick={() => {
            setLoading(true);
            void loadIconCatalog(true, true)
              .then((icons) => {
                if (current.current === identity)
                  setFeedback(
                    t("routeUi.catalog_loaded", { count: icons.length }),
                  );
              })
              .catch(() => {
                if (current.current === identity)
                  setFeedback(t("routeC.icon_failed"));
              })
              .finally(() => {
                if (current.current === identity) setLoading(false);
              });
          }}
        >
          {t(loading ? "library.loading" : "routeC.icon_refresh")}
        </button>
        <button className="secondary">{t("routeC.save")}</button>
        {feedback && <small role="status">{feedback}</small>}
      </fieldset>
    </form>
  );
}
