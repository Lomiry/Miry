type Flight = {
  controller: AbortController;
  consumers: number;
  promise: Promise<unknown>;
};
const cancelled = () => new DOMException("Aborted", "AbortError");
export class SharedRequests {
  private flights = new Map<string, Flight>();
  run<T>(
    key: string,
    signal: AbortSignal,
    execute: (signal: AbortSignal) => Promise<T>,
    joined: () => void = () => {},
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(cancelled());
    let flight = this.flights.get(key);
    if (!flight) {
      const controller = new AbortController();
      flight = { controller, consumers: 0, promise: Promise.resolve() };
      const created = flight;
      // Dispatch after subscribers are registered. A synchronous cleanup (e.g.
      // StrictMode) can cancel before any transport work begins; no timer/retry.
      created.promise = Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw cancelled();
          return execute(controller.signal);
        })
        .finally(() => {
          if (this.flights.get(key) === created) this.flights.delete(key);
        });
      this.flights.set(key, created);
    } else joined();
    const current = flight;
    current.consumers++;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const release = () => {
        settled = true;
        signal.removeEventListener("abort", abort);
        current.consumers--;
      };
      const abort = () => {
        if (settled) return;
        release();
        reject(cancelled());
        if (!current.consumers) {
          current.controller.abort();
          if (this.flights.get(key) === current) this.flights.delete(key);
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      current.promise.then(
        (value) => {
          if (settled) return;
          release();
          resolve(value as T);
        },
        (error) => {
          if (settled) return;
          release();
          reject(error);
        },
      );
    });
  }
  clear() {
    for (const flight of this.flights.values()) flight.controller.abort();
    this.flights.clear();
  }
}
