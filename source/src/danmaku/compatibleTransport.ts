import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DanmakuSource } from "./sources";
export type CompatibleQuery = {
  kind: "search" | "comments" | "health";
  title?: string;
  episode?: string;
  id?: string;
};
export async function compatibleTransport(
  source: DanmakuSource,
  query: CompatibleQuery,
  signal: AbortSignal,
): Promise<unknown> {
  if (!isTauri()) throw { kind: "unconfigured" };
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const requestId = crypto.randomUUID();
  const abort = () => {
    void invoke("danmaku_source_cancel", { requestId }).catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const result = await invoke("danmaku_source_request", {
      sourceId: source.id,
      endpoint: source.endpoint,
      ...(source.allowLanHttp === true ? { allowLanHttp: true } : {}),
      query,
      requestId,
    });
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return result;
  } catch (e) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (typeof e === "string" && e.startsWith("credential-"))
      throw { kind: "unconfigured" };
    const kind =
      typeof e === "string" &&
      [
        "network",
        "timeout",
        "auth",
        "rate-limit",
        "not-found",
        "size",
        "format",
        "cancelled",
        "query",
        "busy",
      ].includes(e)
        ? e
        : "provider";
    throw { kind };
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
