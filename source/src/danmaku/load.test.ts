import { afterEach, expect, it, vi } from "vitest";
import { parseLocalFile } from "./load";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
class ParserWorker {
  static latest: ParserWorker;
  onmessage: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    ParserWorker.latest = this;
  }
}
it("terminates the parser worker after success and never reparses on the UI thread", async () => {
  vi.stubGlobal("Worker", ParserWorker);
  const pending = parseLocalFile(
    "input",
    "a.xml",
    new AbortController().signal,
  );
  const worker = ParserWorker.latest;
  expect(worker.postMessage).toHaveBeenCalledWith({
    text: "input",
    name: "a.xml",
  });
  worker.onmessage!({
    data: { document: { entries: [], skipped: 0, format: "XML" } },
  });
  expect((await pending).format).toBe("XML");
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("aborts an in-flight worker when media is changed or the owner is removed", async () => {
  vi.stubGlobal("Worker", ParserWorker);
  const controller = new AbortController(),
    pending = parseLocalFile("input", "a.xml", controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(ParserWorker.latest.terminate).toHaveBeenCalledOnce();
});
it("terminates a worker that exceeds the parsing deadline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", ParserWorker);
  const pending = parseLocalFile(
    "input",
    "a.xml",
    new AbortController().signal,
  );
  const checked = expect(pending).rejects.toThrow(/超时/);
  await vi.advanceTimersByTimeAsync(15000);
  await checked;
  expect(ParserWorker.latest.terminate).toHaveBeenCalledOnce();
});
