import { useEffect, useState, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import embyIcon from "../assets/emby.svg";
import type { Account } from "../types/emby";
import {
  cachedIconCatalog,
  resolveProviderIconTrace,
  readIconPreference,
  loadIconCatalog,
} from "../stores/providerIcons";
export default function ServerIcon({
  account,
  onStatus,
}: {
  account: Account;
  onStatus?: (status: "loading" | "loaded" | "fallback") => void;
}) {
  const [, update] = useState(0),
    [failed, setFailed] = useState("");
  useEffect(() => {
    const refresh = () => update((n) => n + 1);
    window.addEventListener("miry-provider-icons", refresh);
    return () => window.removeEventListener("miry-provider-icons", refresh);
  }, []);
  const pref = readIconPreference(account);
  useEffect(() => {
    // Native auto matching shares a bounded public catalog request. No account
    // fields are sent, and browser previews fetch only after an explicit choice.
    if (
      (isTauri() || pref.provider) &&
      !pref.override &&
      !cachedIconCatalog().length
    )
      void loadIconCatalog(false).catch(() => {});
  }, [
    pref.provider,
    pref.override,
    account.server,
    account.homeServer,
    account.remark,
    account.serverName,
  ]);
  const resolution = resolveProviderIconTrace(
    account,
    cachedIconCatalog(),
    pref,
  );
  const candidate = resolution.url;
  const scope = JSON.stringify([
    account.serverId,
    account.server,
    account.homeServer,
    account.serverName,
    account.remark,
    pref,
  ]);
  const request = JSON.stringify([scope, candidate]);
  const src = candidate && failed !== request ? candidate : embyIcon;
  const latest = useRef(request);
  latest.current = request;
  useEffect(() => {
    onStatus?.(candidate && failed !== request ? "loading" : "fallback");
  }, [request, failed, onStatus]);
  return (
    <img
      key={request}
      className="server-icon"
      data-icon-rule={src === embyIcon ? "default" : resolution.rule}
      data-icon-name={src === embyIcon ? "Emby" : resolution.name || "custom"}
      src={src}
      width={24}
      height={24}
      alt=""
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
      onLoad={() => {
        if (latest.current === request)
          onStatus?.(src === embyIcon ? "fallback" : "loaded");
      }}
      onError={
        src === embyIcon
          ? undefined
          : () => {
              if (latest.current === request) {
                setFailed(request);
                onStatus?.("fallback");
              }
            }
      }
    />
  );
}
