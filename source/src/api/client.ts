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
    throw new ApiError("请输入完整的服务器地址，例如 https://emby.example.com");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ApiError("地址仅支持 HTTP 或 HTTPS，请去掉账号、参数和锚点。");
  return (
    url.origin +
    url.pathname.replace(/\/+$/, "").replace(/\/emby$/i, "") +
    "/emby"
  );
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
  ): Promise<T> {
    const stamp = favoriteRevision(this.account);
    if (this.favoriteStamp && this.favoriteStamp !== stamp) this.cache.clear();
    this.favoriteStamp = stamp;
    if (/(?:^|\/)Download(?:\/|$|\?)/i.test(path))
      throw new ApiError("此客户端禁止媒体下载。");
    if (body !== undefined && /^\/Playlists\/?(?:\?|$)/i.test(path))
      throw new ApiError("此客户端禁止创建播放列表。");
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
      const response = await transport(url.toString(), {
        method,
        signal: controller.signal,
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
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (!response.ok) {
        bodyPreview = responsePreview(data);
        throw new ApiError(
          response.status === 401
            ? "登录失效或用户名密码错误，请重新登录。"
            : response.status === 403
              ? "服务器拒绝访问，请检查账号权限。"
              : response.status === 404
                ? "服务器没有提供这个 API（HTTP 404），请检查服务器路径。"
                : response.status >= 500
                  ? `服务器暂时无法处理请求（HTTP ${response.status}），请稍后重试。`
                  : `服务器返回 HTTP ${response.status}，请检查地址或稍后重试。`,
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
          "服务器返回的内容不是有效的 Emby JSON 数据。",
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
          "请求超过 15 秒，请检查服务器连接后重试。",
          0,
          "timeout",
        );
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      if (error instanceof ApiError) throw error;
      const messages: Partial<Record<NetworkCategory, string>> = {
        permission:
          "客户端网络权限拒绝了这个地址或端口，请使用更新后的桌面版本。",
        dns: "无法解析服务器域名，请检查当前网络。",
        tcp: "无法建立服务器连接，请检查端口与网络。",
        tls: "服务器 TLS 连接或证书校验失败，请查看连接诊断。",
        timeout: "服务器连接超时，请稍后重试。",
      };
      throw new ApiError(
        messages[category] ||
          (isTauri()
            ? "无法连接服务器，请检查网络、地址和证书。"
            : "无法连接服务器。浏览器预览需要服务器允许跨域访问；桌面版使用原生网络请求。"),
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
      throw new ApiError("服务器没有返回有效的登录信息。", 200, "format");
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
        "服务器探测失败：返回的数据不是有效的 Emby ServerInfo。",
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
        "服务器未确认收藏状态，请刷新后重试。",
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
