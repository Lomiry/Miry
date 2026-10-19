import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { EmbyClient } from "../api/client";
import type { Item } from "../types/emby";
import type {
  DanmakuCommand,
  DanmakuDocument,
  DanmakuPresentation,
  DanmakuSettings,
} from "./types";
import useLocalDanmaku, { danmakuIdentity } from "./useLocalDanmaku";
import {
  mediaContext,
  defaultQuery,
  mappingIdentity,
  association,
  saveAssociation,
  rank,
  type DanmakuMatch,
} from "./online";
import { onlineProvider } from "./dandanplay";
import { onlineErrorKind, onlineErrorMessage } from "./onlineError";
import { requestScope } from "./requestDiagnostics";
type Availability = { configured: boolean; mock: boolean; builtIn?: boolean };
export default function useDanmaku(
  api: EmbyClient | null,
  item: Item | undefined,
  active: boolean,
  playbackSession = "",
) {
  const local = useLocalDanmaku(api, item),
    identity = danmakuIdentity(api, item),
    key = JSON.stringify(identity),
    context = item ? mediaContext(item) : undefined;
  const contextKey = JSON.stringify(context),
    mapping = item ? mappingIdentity(identity.scope, item) : "";
  const instance = useRef(crypto.randomUUID());
  const scope = () =>
    requestScope(
      JSON.stringify([key, contextKey]),
      playbackSession || instance.current,
    );
  const [availability, setAvailability] = useState<Availability>({
      configured: false,
      mock: false,
    }),
    [generation, setGeneration] = useState(0);
  const [online, setOnline] = useState<{
    key: string;
    document: DanmakuDocument | null;
    match?: DanmakuMatch;
    candidates: DanmakuMatch[];
    status: string;
    loading: boolean;
    offset: number;
  }>({
    key,
    document: null,
    candidates: [],
    status: "",
    loading: false,
    offset: 0,
  });
  const [source, setSource] = useState<"local" | "online">("local");
  const controller = useRef<AbortController | null>(null),
    current = useRef(key),
    mounted = useRef(true),
    serial = useRef(0);
  current.current = key;
  useEffect(() => {
    if (local.selectionRevision) setSource("local");
  }, [local.selectionRevision]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      serial.current++;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    void invoke<Availability>("danmaku_online_status")
      .then((a) => {
        if (alive && a) setAvailability(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [generation]);
  function begin() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const n = ++serial.current;
    return {
      signal: c.signal,
      scope: scope(),
      valid: () =>
        mounted.current &&
        !c.signal.aborted &&
        current.current === key &&
        serial.current === n,
    };
  }
  async function loadMatch(
    match: DanmakuMatch,
    task: ReturnType<typeof begin>,
    manual = false,
    force = false,
    offset = 0,
  ) {
    if (!context) return;
    if (match.recommended && task.valid())
      setOnline((v) => ({
        ...v,
        candidates: v.candidates.some((m) => m.id === match.id)
          ? v.candidates
          : [match],
      }));
    const document = await onlineProvider.getComments(
      match.id,
      task.signal,
      force,
      task.scope,
    );
    if (!task.valid()) return;
    setOnline({
      key,
      document,
      match,
      candidates:
        online.key === key && online.candidates.some((m) => m.id === match.id)
          ? online.candidates
          : [match],
      status: document.entries.length
        ? `已匹配：${match.title} · ${match.episodeTitle} · ${document.entries.length} 条弹幕`
        : "已找到作品，但暂无可用弹幕",
      loading: false,
      offset,
    });
    setSource("online");
    if (manual) saveAssociation(mapping, context, match, offset);
  }
  function failed(e: unknown, task: ReturnType<typeof begin>) {
    if (!task.valid()) return;
    const expired = onlineErrorKind(e) === "NOT_FOUND";
    if (expired && context) saveAssociation(mapping, context);
    setOnline((v) => ({
      ...v,
      key,
      status: onlineErrorMessage(e),
      loading: false,
      match: expired ? undefined : v.match,
      document: expired ? null : v.document,
    }));
  }
  useEffect(() => {
    controller.current?.abort();
    serial.current++;
    setSource("local");
    setOnline({
      key,
      document: null,
      candidates: [],
      status: availability.configured
        ? local.metadata.bound
          ? "本地文件优先，可手动搜索在线弹幕"
          : "在线弹幕待匹配"
        : "未配置在线弹幕服务，视频播放和本地弹幕可继续使用",
      loading: false,
      offset: 0,
    });
    if (
      !active ||
      !local.ready ||
      local.metadata.bound ||
      local.metadata.settings.onlineEnabled === false ||
      !availability.configured ||
      !context
    )
      return;
    const saved = association(mapping, context);
    if (!saved && local.metadata.settings.autoMatch === false) {
      setOnline((v) => ({ ...v, status: "自动匹配已关闭，可手动搜索" }));
      return;
    }
    const task = begin();
    setOnline((v) => ({ ...v, status: "正在匹配…", loading: true }));
    void (async () => {
      if (saved) {
        await loadMatch(saved.match, task, false, false, saved.offset);
        return;
      }
      const result = await onlineProvider.match(
        context,
        task.signal,
        task.scope,
      );
      if (!task.valid()) return;
      if (result.selected) await loadMatch(result.selected, task);
      else
        setOnline({
          key,
          document: null,
          candidates: result.candidates,
          status: result.candidates.length
            ? "多个可能匹配，请确认"
            : "未找到匹配结果 · 尝试仅输入作品名称，或使用原标题",
          loading: false,
          offset: 0,
        });
    })().catch((e) => failed(e, task));
    return () => {
      task.signal === controller.current?.signal && controller.current.abort();
    };
  }, [
    key,
    contextKey,
    active,
    local.ready,
    local.metadata.bound,
    local.metadata.settings.onlineEnabled,
    local.metadata.settings.autoMatch,
    availability.configured,
    generation,
    playbackSession,
  ]);
  const currentOnline = online.key === key ? online : undefined;
  const selectedSource =
    source === "online" &&
    currentOnline?.document &&
    local.metadata.settings.onlineEnabled !== false
      ? "online"
      : "local";
  async function action(
    command: DanmakuCommand,
    patch?: Partial<DanmakuSettings>,
    query?: string,
    matchId?: string,
  ) {
    if (command === "choose") {
      controller.current?.abort();
      serial.current++;
      await local.action("choose");
      setOnline((v) => ({
        ...v,
        loading: false,
        status: v.loading ? "已取消在线匹配，可手动搜索" : v.status,
      }));
      return;
    }
    if (
      command === "unbind" ||
      command === "toggle" ||
      command === "settings"
    ) {
      if (
        selectedSource === "online" &&
        patch?.offset !== undefined &&
        context &&
        currentOnline?.match
      ) {
        const offset = Math.max(
          -600,
          Math.min(600, Number.isFinite(patch.offset) ? patch.offset : 0),
        );
        setOnline((v) => ({ ...v, offset }));
        saveAssociation(mapping, context, currentOnline.match, offset);
        const { offset: ignored, ...rest } = patch;
        void ignored;
        if (Object.keys(rest).length) await local.action(command, rest);
        return;
      }
      await local.action(command, patch);
      return;
    }
    if (command === "configure" || command === "clear-credential") {
      controller.current?.abort();
      serial.current++;
      try {
        const value = await invoke<Availability>("danmaku_online_configure", {
          clear: command === "clear-credential",
        });
        onlineProvider.clear();
        if (mounted.current) {
          setAvailability(value);
          setGeneration((n) => n + 1);
        }
      } catch {
        if (mounted.current)
          setOnline((v) => ({
            ...v,
            status: "凭据文件不可用，请选择已授权的 JSON 文件",
          }));
      }
      return;
    }
    if (
      !active ||
      !context ||
      !availability.configured ||
      local.metadata.settings.onlineEnabled === false
    )
      return;
    if (command === "search" && (!query || query.trim().length < 2)) return;
    const task = begin();
    setOnline((v) => ({
      ...v,
      key,
      loading: true,
      status: command === "search" ? "正在搜索…" : "正在匹配…",
    }));
    try {
      if (command === "search") {
        const results = await onlineProvider.search(
          query || defaultQuery(context),
          task.signal,
          context,
          task.scope,
        );
        const ranked = rank(context, results);
        if (task.valid())
          setOnline((v) => ({
            ...v,
            key,
            candidates: ranked.candidates,
            loading: false,
            status: ranked.selected
              ? "已找到推荐匹配，请确认"
              : results.length
                ? "多个可能匹配，请确认"
                : "未找到匹配结果 · 尝试仅输入作品名称，或使用原标题",
          }));
      } else if (command === "select") {
        const match = currentOnline?.candidates.find((m) => m.id === matchId);
        if (match) await loadMatch(match, task, true);
        else if (task.valid()) setOnline((v) => ({ ...v, loading: false }));
      } else if (command === "reload" && currentOnline?.match)
        await loadMatch(
          currentOnline.match,
          task,
          false,
          true,
          currentOnline.offset,
        );
      else if (command === "online" && currentOnline?.document) {
        setSource("online");
        setOnline((v) => ({
          ...v,
          loading: false,
          status: `已匹配：${v.match?.title || "在线弹幕"}`,
        }));
      } else {
        saveAssociation(mapping, context);
        const result = await onlineProvider.match(
          context,
          task.signal,
          task.scope,
        );
        if (!task.valid()) return;
        if (result.selected) await loadMatch(result.selected, task);
        else
          setOnline({
            key,
            document: null,
            candidates: result.candidates,
            status: result.candidates.length
              ? "多个可能匹配，请确认"
              : "未找到匹配结果 · 尝试仅输入作品名称，或使用原标题",
            loading: false,
            offset: 0,
          });
      }
    } catch (e) {
      failed(e, task);
    }
  }
  const document =
    active && local.ready
      ? selectedSource === "online"
        ? currentOnline?.document || null
        : local.document
      : null;
  const metadata: DanmakuPresentation = {
    ...local.metadata,
    source: selectedSource,
    ...(selectedSource === "online"
      ? {
          name: currentOnline?.match?.title || "",
          count: document?.entries.length || 0,
          skipped: document?.skipped || 0,
          offset: currentOnline?.offset || 0,
          status: "",
        }
      : {}),
    online: {
      ...availability,
      status: currentOnline?.status || "未配置在线弹幕服务",
      query: context ? defaultQuery(context) : "",
      candidates: currentOnline?.candidates || [],
      match: currentOnline?.match,
      loading: currentOnline?.loading || false,
    },
  };
  return { document, metadata, action };
}
