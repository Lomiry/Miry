import { afterEach, expect, it, vi } from "vitest";
import { parseOnline } from "./onlineLoad";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("worker abort clears timer/listener and terminates once, without publishing a late document", async () => {
  vi.useFakeTimers();
  const terminate = vi.fn(),
    postMessage = vi.fn();
  let instance: { onmessage?: (e: { data: unknown }) => void };
  vi.stubGlobal(
    "Worker",
    class {
      terminate = terminate;
      postMessage = postMessage;
      onmessage?: (e: { data: unknown }) => void;
      constructor() {
        instance = this;
      }
    },
  );
  const controller = new AbortController(),
    remove = vi.spyOn(controller.signal, "removeEventListener"),
    job = parseOnline({ comments: [] }, controller.signal);
  controller.abort();
  await expect(job).rejects.toMatchObject({ name: "AbortError" });
  instance!.onmessage?.({ data: { document: { entries: [] } } });
  expect(terminate).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("abort", expect.anything());
  expect(vi.getTimerCount()).toBe(0);
});
it("worker timeout bounded and no-worker path parses empty comments", async () => {
  vi.useFakeTimers();
  const terminate = vi.fn();
  vi.stubGlobal(
    "Worker",
    class {
      terminate = terminate;
      postMessage() {}
    },
  );
  const job = parseOnline({ comments: [] }, new AbortController().signal);
  const check = expect(job).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(15000);
  await check;
  expect(terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  vi.unstubAllGlobals();
  expect(
    (await parseOnline({ comments: [] }, new AbortController().signal)).entries,
  ).toEqual([]);
});
