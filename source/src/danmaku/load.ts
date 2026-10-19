import type { DanmakuDocument } from "./types";
import { parseDanmaku } from "./parser";
export function parseLocalFile(
  text: string,
  name: string,
  signal: AbortSignal,
): Promise<DanmakuDocument> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (typeof Worker === "undefined")
    return Promise.resolve().then(() => parseDanmaku(text, name));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parser.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(
      () => finish(Error("弹幕解析超时，请检查文件。")),
      15000,
    );
    const abort = () => finish(new DOMException("Aborted", "AbortError"));
    const finish = (error?: Error, document?: DanmakuDocument) => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve(document!);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      e: MessageEvent<{ document?: DanmakuDocument; error?: string }>,
    ) =>
      finish(e.data.error ? Error(e.data.error) : undefined, e.data.document);
    worker.onerror = () => finish(Error("无法解析弹幕文件。"));
    worker.postMessage({ text, name });
  });
}
