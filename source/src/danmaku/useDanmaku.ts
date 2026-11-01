import { t, getLanguage } from "../i18n/core";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ProviderSources } from "./providerSources";
import { normalizeSources } from "./sources";
import { density } from "./density";
import { mediaTimeline } from "./timeline";
import { onlineErrorKind, onlineErrorMessage } from "./onlineError";
import { requestScope } from "./requestDiagnostics";
type Availability = { configured: boolean; mock: boolean; builtIn?: boolean };
export default function useDanmaku(
  api: EmbyClient | null,
  item: Item | undefined,
  active: boolean,
  playbackSession = "",
  duration = 0,
) {
  const local = useLocalDanmaku(api, item),
    identity = danmakuIdentity(api, item),
    context = item ? mediaContext(item) : undefined;
  const sourceConfig = normalizeSources(local.metadata.settings.sources);
  const sourceKey = JSON.stringify(sourceConfig);
  const cacheKey = JSON.stringify([identity, sourceKey]);
  const contextKey = JSON.stringify(context),
    key = JSON.stringify([cacheKey, contextKey, playbackSession]),
    mapping = item
      ? mappingIdentity(
          identity.scope,
          item,
          local.metadata.settings.sources ? sourceKey : "dandanplay",
        )
      : "";
  const instance = useRef(crypto.randomUUID());
  // Presentation ownership must not expose account/source configuration.
  const matchScope = useMemo(() => crypto.randomUUID(), [key]);
  const scope = () =>
    requestScope(
      JSON.stringify([cacheKey, contextKey]),
      playbackSession || instance.current,
    );
  const [availability, setAvailability] = useState<Availability>({
      configured: false,
      mock: false,
    }),
    [generation, setGeneration] = useState(0);
  const onlineProvider = useMemo(
    () => new ProviderSources(sourceConfig, availability.configured),
    [sourceKey, availability.configured],
  );
  useEffect(() => () => onlineProvider.dispose(), [onlineProvider]);
  const configured = isTauri() && onlineProvider.configured;
  const [online, setOnline] = useState<{
    key: string;
    document: DanmakuDocument | null;
    match?: DanmakuMatch;
    candidates: DanmakuMatch[];
    status: string;
    loading: boolean;
    offset: number;
    confirmed?: boolean;
    pending?: boolean;
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
    currentSource = useRef(sourceKey),
    mounted = useRef(true),
    serial = useRef(0);
  const selectionPending = useRef<{ key: string } | null>(null);
  current.current = key;
  currentSource.current = sourceKey;
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
        currentSource.current === sourceKey &&
        serial.current === n,
    };
  }
  async function loadMatch(
    match: DanmakuMatch,
    task: ReturnType<typeof begin>,
    manual = false,
    force = false,
    offset = 0,
    candidates?: DanmakuMatch[],
  ) {
    if (!context) return;
    if (task.valid())
      setOnline((v) => ({
        ...v,
        pending: true,
        candidates:
          candidates ||
          (v.candidates.some((m) => m.id === match.id)
            ? v.candidates
            : [match]),
      }));
    const document = await onlineProvider.getComments(
      match.id,
      task.signal,
      force,
      task.scope,
    );
    if (!task.valid()) return;
    setOnline((v) => ({
      key,
      document,
      match,
      candidates:
        v.key === key && v.candidates.some((m) => m.id === match.id)
          ? v.candidates
          : [match],
      status: document.entries.length
        ? t("danmaku.matched_comments", {
            p0: match.title,
            p1: match.episodeTitle,
            p2: document.entries.length,
          })
        : t("danmaku.title_found_but_no_danmaku_is_available"),
      loading: false,
      offset,
      confirmed: manual,
      pending: false,
    }));
    setSource("online");
    if (manual) saveAssociation(mapping, context, match, offset);
  }
  function failed(
    e: unknown,
    task: ReturnType<typeof begin>,
    preserveLoaded = false,
  ) {
    if (!task.valid()) return;
    const expired = onlineErrorKind(e) === "NOT_FOUND";
    if (expired && context && !preserveLoaded)
      saveAssociation(mapping, context);
    setOnline((v) => ({
      ...v,
      key,
      status: onlineErrorMessage(e),
      loading: false,
      match: expired && !preserveLoaded ? undefined : v.match,
      document: expired && !preserveLoaded ? null : v.document,
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
      status: configured
        ? local.metadata.bound
          ? t("danmaku.local_files_take_priority_you_can_search")
          : t("danmaku.online_danmaku_awaiting_a_match")
        : t("danmaku.unconfigured_with_local"),
      loading: false,
      offset: 0,
    });
    if (
      !active ||
      !local.ready ||
      local.metadata.bound ||
      local.metadata.settings.onlineEnabled === false ||
      !configured ||
      !context
    )
      return;
    const saved = association(mapping, context);
    if (!saved && local.metadata.settings.autoMatch === false) {
      setOnline((v) => ({
        ...v,
        status: t("danmaku.automatic_matching_is_off_you_can_search"),
      }));
      return;
    }
    const task = begin();
    setOnline((v) => ({ ...v, status: t("danmaku.matching"), loading: true }));
    void (async () => {
      const result = await onlineProvider.match(
        context,
        task.signal,
        task.scope,
        saved,
      );
      if (!task.valid()) return;
      if (result.selected)
        await loadMatch(
          result.selected,
          task,
          !!saved && saved.match.id === result.selected.id,
          false,
          result.offset,
          result.candidates,
        );
      else
        setOnline({
          key,
          document: null,
          candidates: result.candidates,
          pending: !!result.candidates.length,
          status: result.candidates.length
            ? t("danmaku.multiple_possible_matches_choose_one_to_confirm")
            : result.empty
              ? t("danmaku.title_found_but_no_danmaku_is_available")
              : t("danmaku.no_match_found_try_just_the_title"),
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
    sourceKey,
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
    expectedMatchScope?: string,
  ) {
    if (command === "source-mode") {
      if (query !== "auto" && !sourceConfig.sources.some((s) => s.id === query))
        return;
      controller.current?.abort();
      serial.current++;
      await local.action("settings", {
        sources: { ...sourceConfig, mode: query! },
      });
      return;
    }
    if (command === "choose") {
      controller.current?.abort();
      serial.current++;
      await local.action("choose");
      setOnline((v) => ({
        ...v,
        loading: false,
        status: v.loading
          ? t("danmaku.online_matching_cancelled_you_can_search_manually")
          : v.status,
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
          language: getLanguage(),
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
            status: t(
              "danmaku.credentials_file_unavailable_select_an_authorized_json",
            ),
          }));
      }
      return;
    }
    if (
      !active ||
      !context ||
      !configured ||
      local.metadata.settings.onlineEnabled === false
    )
      return;
    if (command === "search" && (!query || query.trim().length < 2)) return;
    if (
      command === "select" &&
      expectedMatchScope !== undefined &&
      expectedMatchScope !== matchScope
    )
      throw Error(t("danmaku.candidate_expired"));
    if (
      command === "select" &&
      !currentOnline?.candidates.some((m) => m.id === matchId)
    )
      throw Error(t("danmaku.candidate_expired"));
    if (command === "select" && selectionPending.current?.key === key) return;
    const selection = command === "select" ? { key } : null;
    if (selection) selectionPending.current = selection;
    const task = begin();
    setOnline((v) => ({
      ...v,
      key,
      loading: true,
      status:
        command === "search" ? t("danmaku.searching") : t("danmaku.matching"),
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
            pending: !!ranked.candidates.length,
            loading: false,
            status: ranked.selected
              ? t("danmaku.recommended_match_found_confirm_to_continue")
              : results.length
                ? t("danmaku.multiple_possible_matches_choose_one_to_confirm")
                : t("danmaku.no_match_found_try_just_the_title"),
          }));
      } else if (command === "select") {
        const match = currentOnline?.candidates.find((m) => m.id === matchId);
        if (match) await loadMatch(match, task, true);
        else if (task.valid()) setOnline((v) => ({ ...v, loading: false }));
      } else if (command === "reload" && currentOnline?.match)
        await loadMatch(
          currentOnline.match,
          task,
          !!currentOnline.confirmed,
          true,
          currentOnline.offset,
        );
      else if (command === "online" && currentOnline?.document) {
        setSource("online");
        setOnline((v) => ({
          ...v,
          loading: false,
          status: t("danmaku.matched", {
            p0: v.match?.title || t("danmaku.online_danmaku"),
          }),
        }));
      } else {
        saveAssociation(mapping, context);
        const result = await onlineProvider.match(
          context,
          task.signal,
          task.scope,
        );
        if (!task.valid()) return;
        if (result.selected)
          await loadMatch(
            result.selected,
            task,
            false,
            false,
            result.offset,
            result.candidates,
          );
        else
          setOnline({
            key,
            document: null,
            candidates: result.candidates,
            pending: !!result.candidates.length,
            status: result.candidates.length
              ? t("danmaku.multiple_possible_matches_choose_one_to_confirm")
              : result.empty
                ? t("danmaku.title_found_but_no_danmaku_is_available")
                : t("danmaku.no_match_found_try_just_the_title"),
            loading: false,
            offset: 0,
          });
      }
    } catch (e) {
      failed(e, task, command === "select" || command === "search");
    } finally {
      if (selection && selectionPending.current === selection)
        selectionPending.current = null;
    }
  }
  const rawDocument =
    active && local.ready
      ? selectedSource === "online"
        ? currentOnline?.document || null
        : local.document
      : null;
  const document = useMemo(
    () => (rawDocument ? mediaTimeline(rawDocument, duration) : null),
    [rawDocument, duration],
  );
  const query = context ? defaultQuery(context) : "";
  const heatmap = useMemo(
    () =>
      density(
        item?.Type === "TvChannel" ? null : document,
        duration,
        selectedSource === "online"
          ? currentOnline?.offset || 0
          : local.metadata.offset,
      ),
    [
      document,
      item?.Type,
      duration,
      selectedSource,
      currentOnline?.offset,
      local.metadata.offset,
    ],
  );
  const metadata = useMemo<DanmakuPresentation>(
    () => ({
      ...local.metadata,
      source: selectedSource,
      density: heatmap,
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
        sessionKey: matchScope,
        context,
        confirmed: currentOnline?.confirmed,
        pending: currentOnline?.pending || false,
        loadedCount: currentOnline?.document?.entries.length,
        videoDuration: currentOnline?.document?.videoDuration,
        ...availability,
        configured,
        mode: sourceConfig.mode,
        sources: sourceConfig.sources.map(({ id, name, enabled }) => ({
          id,
          name,
          enabled,
        })),
        sourceName:
          selectedSource === "online" &&
          currentOnline?.document &&
          currentOnline.match
            ? sourceConfig.sources.find(
                (s) =>
                  s.id ===
                  (currentOnline.match!.id.includes(":")
                    ? currentOnline.match!.id.split(":")[0]
                    : "dandanplay"),
              )?.name
            : undefined,
        failures: onlineProvider.failures,
        status:
          currentOnline?.status ||
          t("danmaku.online_danmaku_is_not_configured"),
        query,
        candidates: currentOnline?.candidates || [],
        match: currentOnline?.match,
        loading: currentOnline?.loading || false,
      },
    }),
    [
      local.metadata,
      selectedSource,
      document,
      availability,
      configured,
      onlineProvider,
      currentOnline,
      query,
      heatmap,
      matchScope,
      contextKey,
    ],
  );
  return { document, metadata, action };
}
