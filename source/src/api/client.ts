import { t } from "../i18n/core";
import { isTauri } from "@tauri-apps/api/core";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { MetadataCache } from "./cache";
import { favoriteRevision, invalidateFavorites } from "./favorites";
import { artworkCandidates, type ArtworkKind } from "./artwork";
import { APP_VERSION } from "../version";
import {
  diagnosticUrl,
  networkCategory,
  recordNetwork,
  redactNetworkDetail,
  responsePreview,
  type NetworkCategory,
} from "./diagnostics";
import type { Account, Item, ItemPage, UserData } from "../types/emby";

const posterMetadataFields = ["ProductionYear", "CommunityRating", "Genres"];
function listFields(fields: string) {
  return [
    ...new Set([
      ...fields
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      ...posterMetadataFields,
    ]),
  ].join(",");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public category?: NetworkCategory,
  ) {
    super(message);
  }
}
export function normalizeServer(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ApiError(t("network.enter_the_full_server_address_for_example"));
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ApiError(t("network.use_an_http_or_https_address_without"));
  // The supplied base path is authoritative, including an explicit /emby.
  // Root-only reverse proxies must not receive an invented API prefix.
  return url.origin + url.pathname.replace(/\/+$/, "");
}
export function getDeviceId() {
  let id = localStorage.getItem("miry-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("miry-device", id);
  }
  return id;
}
export class EmbyClient {
  readonly cache = new MetadataCache();
  private favoriteStamp?: object;
  constructor(public account: Account) {}
  async request<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
    body?: unknown,
    signal?: AbortSignal,
    forceRefresh = false,
  ): Promise<T> {
    const stamp = favoriteRevision(this.account);
    if (this.favoriteStamp && this.favoriteStamp !== stamp) this.cache.clear();
    this.favoriteStamp = stamp;
    if (/(?:^|\/)Download(?:\/|$|\?)/i.test(path))
      throw new ApiError(
        t("network.media_downloads_are_unavailable_in_this_client"),
      );
    if (body !== undefined && /^\/Playlists\/?(?:\?|$)/i.test(path))
      throw new ApiError(
        t("network.creating_server_playlists_is_unavailable_in_this"),
      );
    const url = new URL(this.account.server + path);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const ttl =
      body !== undefined
        ? 0
        : /\/Views$/.test(path)
          ? 300000
          : /\/Genres$/.test(path)
            ? 60000
            : /\/Items$/.test(path) && query.SortBy !== "Random"
              ? 20000
              : 0;
    const cacheKey = url.toString();
    const cacheRevision = this.cache.revision;
    if (ttl) {
      // Manual retry replaces only this URL's entry in this account client.
      if (forceRefresh) this.cache.remove(cacheKey);
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) return cached;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    const started = performance.now();
    const stage = path.endsWith("/System/Info/Public")
      ? "probe"
      : path.endsWith("/AuthenticateByName")
        ? "login"
        : path.endsWith("/PlaybackInfo")
          ? "playback-info"
          : "api";
    const method = body === undefined ? "GET" : "POST";
    const diagnostic = {
      stage,
      method,
      url: diagnosticUrl(url, path),
      backend: isTauri()
        ? "plugin-http / reqwest / rustls"
        : "browser fetch (metadata only)",
    };
    let status: number | undefined,
      contentType: string | undefined,
      redirected: boolean | undefined,
      bodyPreview: string | undefined;
    const log = (category?: NetworkCategory, underlying?: string) =>
      recordNetwork({
        ...diagnostic,
        status,
        contentType,
        redirected,
        bodyPreview,
        category,
        underlying,
        elapsedMs: Math.round(performance.now() - started),
      });
    try {
      const transport = isTauri() ? nativeFetch : globalThis.fetch;
      if (this.account.ignoreCertificateErrors && !isTauri())
        throw new ApiError(t("routeC.desktop_tls"), 0, "tls");
      const response = await transport(url.toString(), {
        method,
        signal: controller.signal,
        // Each native request gets its own policy. Do not follow redirects with
        // account credentials or carry a certificate exception to another host.
        ...(isTauri()
          ? {
              maxRedirections: 0,
              ...(this.account.ignoreCertificateErrors === true
                ? {
                    danger: {
                      acceptInvalidCerts: true,
                      acceptInvalidHostnames: false,
                    },
                  }
                : {}),
            }
          : {}),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Emby-Authorization": `Emby Client="Miry", Device="Windows", DeviceId="${this.account.deviceId}", Version="${APP_VERSION}"`,
          ...(this.account.token ? { "X-Emby-Token": this.account.token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      status = response.status;
      const mime = response.headers.get("content-type")?.split(";")[0].trim();
      contentType =
        mime && /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : undefined;
      redirected =
        response.redirected ||
        (!!response.url && response.url !== url.toString());
      const data = response.status === 204 ? "" : await response.text();
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      if (!response.ok) {
        bodyPreview = responsePreview(data);
        throw new ApiError(
          response.status === 401
            ? t("network.your_session_has_expired_or_the_username")
            : response.status === 403
              ? t("network.access_denied_check_your_account_permissions")
              : response.status === 404
                ? t("network.the_server_does_not_provide_this_api")
                : response.status >= 500
                  ? t("network.the_server_cannot_process_the_request_right", {
                      p0: response.status,
                    })
                  : t("network.the_server_returned_http_check_the_address", {
                      p0: response.status,
                    }),
          response.status,
          "http",
        );
      }
      if (body !== undefined) this.cache.clear();
      if (response.status === 204) {
        log();
        return undefined as T;
      }
      let result: T;
      try {
        result = data ? (JSON.parse(data) as T) : (undefined as T);
      } catch {
        bodyPreview = `Non-JSON response (${data.length} characters; content omitted)`;
        throw new ApiError(
          t("network.the_server_response_is_not_valid_emby"),
          response.status,
          "format",
        );
      }
      if (data) bodyPreview = responsePreview(data, result);
      if (ttl && result !== undefined && cacheRevision === this.cache.revision)
        this.cache.set(cacheKey, result, ttl);
      log();
      return result;
    } catch (error) {
      const category = timedOut
        ? "timeout"
        : controller.signal.aborted
          ? "cancelled"
          : error instanceof ApiError
            ? error.category || "network"
            : networkCategory(error);
      const secrets = [
        this.account.token,
        url.hostname,
        ...(body && typeof body === "object" && "Pw" in body
          ? [String(body.Pw)]
          : []),
      ];
      log(category, redactNetworkDetail(error, secrets));
      if (timedOut)
        throw new ApiError(
          t("network.the_request_exceeded_15_seconds_check_your"),
          0,
          "timeout",
        );
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      if (error instanceof ApiError) throw error;
      const messages: Partial<Record<NetworkCategory, string>> = {
        permission: t("network.the_client_cannot_access_this_address_or"),
        dns: t("network.the_server_hostname_could_not_be_resolved"),
        tcp: t("network.could_not_connect_to_the_server_check"),
        tls: t("network.the_tls_connection_or_certificate_validation_failed"),
        timeout: t("network.the_server_connection_timed_out_try_again"),
      };
      throw new ApiError(
        messages[category] ||
          (isTauri()
            ? t("network.could_not_connect_to_the_server_check_2")
            : t("network.could_not_connect_to_the_server_browser")),
        0,
        category,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async login(username: string, password: string, signal?: AbortSignal) {
    const data = await this.request<{
      User: { Id: string; Name: string };
      AccessToken: string;
    }>(
      "/Users/AuthenticateByName",
      {},
      { Username: username, Pw: password },
      signal,
    );
    if (!data?.User?.Id || !data?.AccessToken)
      throw new ApiError(
        t("network.the_server_did_not_return_valid_sign"),
        200,
        "format",
      );
    return {
      ...this.account,
      userId: data.User.Id,
      name: data.User.Name,
      token: data.AccessToken,
    };
  }
  views(signal?: AbortSignal) {
    return this.request<ItemPage>(
      `/Users/${this.account.userId}/Views`,
      {},
      undefined,
      signal,
    );
  }
  items(
    query: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal,
    { forceRefresh = false }: { forceRefresh?: boolean } = {},
  ) {
    return this.request<ItemPage>(
      `/Users/${this.account.userId}/Items`,
      {
        Limit: 30,
        SortBy: "SortName",
        SortOrder: "Ascending",
        ...query,
        Fields: listFields(
          "Overview,Genres,PrimaryImageAspectRatio,SeriesPrimaryImageTag,ParentPrimaryImageTag," +
            (typeof query.Fields === "string" ? query.Fields : ""),
        ),
      },
      undefined,
      signal,
      forceRefresh,
    );
  }
  resume(signal?: AbortSignal) {
    return this.request<ItemPage>(
      `/Users/${this.account.userId}/Items/Resume`,
      { Limit: 12, MediaTypes: "Video", Fields: "Overview" },
      undefined,
      signal,
    );
  }
  nextUp(seriesId?: string, signal?: AbortSignal) {
    return this.request<ItemPage>(
      "/Shows/NextUp",
      {
        UserId: this.account.userId,
        SeriesId: seriesId,
        Limit: seriesId ? 1 : 12,
        Fields: "Overview,ParentId",
        EnableUserData: true,
      },
      undefined,
      signal,
    );
  }
  item(id: string, signal?: AbortSignal) {
    return this.request<Item>(
      `/Users/${this.account.userId}/Items/${encodeURIComponent(id)}`,
      {},
      undefined,
      signal,
    );
  }
  logout(signal?: AbortSignal) {
    return this.request<void>("/Sessions/Logout", {}, {}, signal);
  }
  async person(id: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const key = `person:${id}`;
    const cached = this.cache.get<Item>(key);
    if (cached) return cached;
    const revision = this.cache.revision;
    const item = await this.item(id, signal);
    if (!signal?.aborted && revision === this.cache.revision)
      this.cache.set(key, item, 300000);
    return item;
  }
  personWorks(
    id: string,
    page: number,
    type?: "Movie" | "Series",
    signal?: AbortSignal,
  ) {
    return this.items(
      {
        PersonIds: id,
        Recursive: true,
        IncludeItemTypes: type || "Movie,Series",
        StartIndex: page * 30,
        Limit: 30,
        SortBy: "ProductionYear,SortName",
        SortOrder: "Descending",
        EnableUserData: true,
      },
      signal,
    );
  }
  async serverInfo(signal?: AbortSignal) {
    const publicAccount = { ...this.account, token: "", userId: "" };
    const preferred = new EmbyClient({
      ...publicAccount,
      server: this.account.server.replace(/\/emby$/i, ""),
    });
    let info: { ServerName: string; Version: string; Id: string };
    try {
      info = await preferred.request(
        "/System/Info/Public",
        {},
        undefined,
        signal,
      );
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        ![404, 405].includes(error.status) ||
        preferred.account.server === this.account.server
      )
        throw error;
      info = await new EmbyClient(publicAccount).request(
        "/System/Info/Public",
        {},
        undefined,
        signal,
      );
    }
    if (
      !info ||
      ![info.Id, info.ServerName, info.Version].every(
        (value) => typeof value === "string" && value.trim(),
      )
    ) {
      recordNetwork({
        stage: "probe-validation",
        method: "GET",
        url: diagnosticUrl(new URL(this.account.server), "/System/Info/Public"),
        backend: isTauri()
          ? "plugin-http / reqwest / rustls"
          : "browser fetch (metadata only)",
        status: 200,
        category: "format",
        bodyPreview: "JSON does not match ServerInfo",
        elapsedMs: 0,
      });
      throw new ApiError(
        t("network.server_check_failed_the_response_is_not"),
        200,
        "format",
      );
    }
    return info;
  }
  genres(parentId: string | undefined, signal?: AbortSignal) {
    return this.request<ItemPage>(
      "/Genres",
      {
        UserId: this.account.userId,
        ParentId: parentId,
        Recursive: true,
        Limit: 200,
      },
      undefined,
      signal,
    );
  }
  similar(id: string, signal?: AbortSignal) {
    return this.request<ItemPage>(
      `/Items/${encodeURIComponent(id)}/Similar`,
      {
        UserId: this.account.userId,
        Limit: 8,
        Fields: listFields("Overview,Genres"),
      },
      undefined,
      signal,
    );
  }
  playlistItems(id: string, page: number, signal?: AbortSignal) {
    return this.request<ItemPage>(
      `/Playlists/${encodeURIComponent(id)}/Items`,
      {
        UserId: this.account.userId,
        StartIndex: page * 30,
        Limit: 30,
        Fields: listFields("Overview"),
      },
      undefined,
      signal,
    );
  }
  setPlayed(id: string, played: boolean, signal?: AbortSignal) {
    return this.request<UserData>(
      `/Users/${this.account.userId}/PlayedItems/${encodeURIComponent(id)}${played ? "" : "/Delete"}`,
      {},
      {},
      signal,
    );
  }
  favorites(page = 0, signal?: AbortSignal) {
    return this.items(
      {
        Recursive: true,
        IncludeItemTypes: "Movie,Series,Season,Episode,BoxSet",
        IsFavorite: true,
        EnableUserData: true,
        StartIndex: page * 30,
      },
      signal,
    );
  }
  async setFavorite(id: string, favorite: boolean, signal?: AbortSignal) {
    const data = await this.request<UserData>(
      `/Users/${this.account.userId}/FavoriteItems/${encodeURIComponent(id)}${favorite ? "" : "/Delete"}`,
      {},
      {},
      signal,
    );
    // Even an incomplete successful response means saved lists must be refreshed.
    invalidateFavorites(this.account);
    if (typeof data?.IsFavorite === "boolean") return data;
    const item = await this.item(id, signal);
    if (typeof item.UserData?.IsFavorite !== "boolean")
      throw new ApiError(
        t("network.the_server_did_not_confirm_the_favorite"),
        undefined,
        "format",
      );
    return item.UserData;
  }
  episodes(seriesId: string, startId: string, signal?: AbortSignal) {
    return this.request<ItemPage>(
      `/Shows/${encodeURIComponent(seriesId)}/Episodes`,
      {
        UserId: this.account.userId,
        StartItemId: startId,
        Limit: 200,
        Fields: "Overview,ParentId",
        IsMissing: false,
        EnableUserData: true,
      },
      undefined,
      signal,
    );
  }
  images(item: Item, backdrop = false, width?: number) {
    return this.artworkImages(item, backdrop ? "backdrop" : "poster", width);
  }
  artworkImages(item: Item, kind: ArtworkKind, width?: number) {
    const backdrop = kind === "backdrop";
    const candidates = artworkCandidates(item, kind);
    const maxWidth = backdrop
      ? width
        ? Math.min(
            1920,
            Math.max(
              360,
              Math.round(width * (globalThis.devicePixelRatio || 1)),
            ),
          )
        : 1920
      : Math.min(
          1200,
          Math.max(
            item.Type === "Person" ? 96 : 360,
            Math.round(
              (width || (item.Type === "Episode" ? 400 : 240)) *
                (globalThis.devicePixelRatio || 1),
            ),
          ),
        );
    return [
      ...new Set(
        candidates
          .filter(([id, , tag]) => id && tag)
          .map(([id, kind, tag]) => {
            const url = new URL(
              `${this.account.server}/Items/${encodeURIComponent(id!)}/Images/${kind}`,
            );
            url.search = new URLSearchParams({
              tag: tag!,
              maxWidth: String(maxWidth),
              quality: "90",
              api_key: this.account.token,
            }).toString();
            return url.toString();
          }),
      ),
    ];
  }
  image(item: Item, backdrop = false, width?: number) {
    return this.images(item, backdrop, width)[0];
  }
}
