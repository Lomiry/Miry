import { parseComments } from "./onlineParser";
self.onmessage = (e: MessageEvent<unknown>) => {
  try {
    self.postMessage({ document: parseComments(e.data) });
  } catch {
    self.postMessage({ error: "format" });
  }
};
