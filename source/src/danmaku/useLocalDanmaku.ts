import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import type { DanmakuDocument, DanmakuSettings } from "./types";
import { normalizeDanmaku } from "./types";
import { parseLocalFile } from "./load";
import { readSettings, saveSettings } from "../stores/settings";
import { privateError } from "../privacy";
interface LocalFile {
  reference: string;
  name: string;
  text: string;
  offset: number;
}
export function danmakuIdentity(
  api: EmbyClient | null,
  item: Item | undefined,
) {
  return {
    scope: JSON.stringify([
      api?.account.serverId ||
        api?.account.homeServer ||
        api?.account.server ||
        "demo",
      api?.account.userId || "",
    ]),
    itemId: item?.Id || "",
    episodeId: item?.Type === "Episode" ? item.Id : "",
  };
}
export default function useLocalDanmaku(
  api: EmbyClient | null,
  item: Item | undefined,
) {
  const identity = danmakuIdentity(api, item),
    key = JSON.stringify(identity);
  const [document, setDocument] = useState<DanmakuDocument | null>(null),
    [name, setName] = useState(""),
    [bound, setBound] = useState(false),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [settings, setSettings] = useState(() =>
      normalizeDanmaku(readSettings().danmaku),
    );
  const [loading, setLoading] = useState(false);
  const [readyKey, setReadyKey] = useState("");
  const [selectionRevision, setSelectionRevision] = useState(0);
  const controller = useRef<AbortController | null>(null),
    currentKey = useRef(key),
    mounted = useRef(true);
  currentKey.current = key;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function load(
    file: LocalFile,
    signal: AbortSignal,
    expected: string,
    bind = false,
  ) {
    const parsed = await parseLocalFile(file.text, file.name, signal);
    if (signal.aborted || !mounted.current || currentKey.current !== expected)
      return;
    if (!parsed.entries.length)
      throw Error("文件中没有可显示的滚动、顶部或底部弹幕。");
    if (bind)
      await invoke("danmaku_bind", {
        ...identity,
        reference: file.reference,
        offset: settings.offset,
      });
    if (signal.aborted || !mounted.current || currentKey.current !== expected)
      return;
    setDocument(parsed);
    setName(file.name);
    setBound(true);
    setOffset(bind ? settings.offset : file.offset);
    setStatus(
      `弹幕已加载 · ${parsed.entries.length} 条${parsed.skipped ? " · 已略过 " + parsed.skipped + " 条不支持的数据" : ""}`,
    );
    if (bind) setSelectionRevision((v) => v + 1);
  }
  useEffect(() => {
    controller.current?.abort();
    setLoading(false);
    setDocument(null);
    setName("");
    setBound(false);
    setStatus("");
    setOffset(0);
    setReadyKey("");
    if (!isTauri() || !api || !item) {
      setReadyKey(key);
      return;
    }
    const pending = new AbortController();
    controller.current = pending;
    void invoke<LocalFile | null>("danmaku_read", identity)
      .then((file) => {
        if (!pending.signal.aborted && file) {
          setBound(true);
          return load(file, pending.signal, key);
        }
      })
      .catch((e) => {
        if (!pending.signal.aborted) {
          setBound(true);
          setStatus(privateError(e));
        }
      })
      .finally(() => {
        if (!pending.signal.aborted && currentKey.current === key)
          setReadyKey(key);
      });
    return () => controller.current?.abort();
  }, [key]);
  useEffect(() => {
    const update = () => setSettings(normalizeDanmaku(readSettings().danmaku));
    window.addEventListener("miry-settings-changed", update);
    return () => window.removeEventListener("miry-settings-changed", update);
  }, []);
  async function action(
    command: "choose" | "unbind" | "toggle" | "settings",
    patch?: Partial<DanmakuSettings>,
  ) {
    const expected = key;
    if (command === "choose") {
      if (loading) return;
      controller.current?.abort();
      const pending = new AbortController();
      controller.current = pending;
      setLoading(true);
      setStatus("正在选择弹幕文件…");
      try {
        const file = await invoke<LocalFile | null>("danmaku_pick");
        if (file && !pending.signal.aborted && currentKey.current === expected)
          await load(file, pending.signal, expected, true);
        else if (currentKey.current === expected) setStatus("");
      } catch (e) {
        if (!pending.signal.aborted && currentKey.current === expected)
          setStatus(privateError(e));
      } finally {
        if (mounted.current && currentKey.current === expected)
          setLoading(false);
      }
    } else if (command === "unbind") {
      await invoke("danmaku_binding", { ...identity, offset: null });
      if (currentKey.current !== expected) return;
      controller.current?.abort();
      setDocument(null);
      setName("");
      setBound(false);
      setStatus("已解除弹幕绑定。");
    } else {
      if (patch?.offset !== undefined) {
        const value = normalizeDanmaku({
          ...settings,
          offset: patch.offset,
        }).offset;
        if (bound)
          await invoke("danmaku_binding", { ...identity, offset: value });
        if (currentKey.current !== expected) return;
        setOffset(value);
      }
      const next = normalizeDanmaku({
        ...settings,
        ...patch,
        ...(command === "toggle" ? { enabled: !settings.enabled } : {}),
      });
      setSettings(next);
      saveSettings({ ...readSettings(), danmaku: next });
    }
  }
  return {
    ready: readyKey === key,
    selectionRevision,
    document,
    action,
    metadata: {
      name,
      count: document?.entries.length || 0,
      skipped: document?.skipped || 0,
      status,
      settings,
      offset,
      bound,
      loading,
    },
  };
}
