import { parseComments } from "./onlineParser";
import type { DanmakuDocument } from "./types";
export function parseOnline(
  value: unknown,
  signal: AbortSignal,
): Promise<DanmakuDocument> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (typeof Worker === "undefined")
    return Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return parseComments(value);
    });
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./online.worker.ts", import.meta.url), {
      type: "module",
    });
    let done = false;
    const abort = () => finish(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(() => finish(Error("timeout")), 15000);
    const finish = (error?: Error, document?: DanmakuDocument) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve(document!);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) =>
      finish(e.data.error ? Error("format") : undefined, e.data.document);
    worker.onerror = () => finish(Error("format"));
    worker.postMessage(value);
  });
}
