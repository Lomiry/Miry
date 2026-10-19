import { parseDanmaku } from "./parser";
self.onmessage = (event: MessageEvent<{ text: string; name: string }>) => {
  try {
    self.postMessage({
      document: parseDanmaku(event.data.text, event.data.name),
    });
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : "无法解析弹幕文件。",
    });
  }
};
