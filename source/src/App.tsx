import AppIcon from "./components/AppIcon";
import useDialogFocus from "./components/useDialogFocus";
import Select from "./components/Select";
import Tooltip from "./components/Tooltip";
import {
  readPageSize,
  savePageSize,
  validPageSize,
  readSortPreference,
  saveSortPreference,
} from "./stores/browsePreferences";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Home,
  Film,
  Tv,
  LogOut,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
  ChevronRight,
  Settings as SettingsIcon,
  Heart,
  History,
  Plus,
  Network,
  Play,
  Bookmark,
  Layers,
  ListVideo,
} from "lucide-react";
import {
  ApiError,
  EmbyClient,
  getDeviceId,
  normalizeServer,
} from "./api/client";
import { clearAccount, readAccount, saveAccount } from "./stores/account";
import { demoItems, demoViews, demoChildren, demoPeople } from "./demo";
import PlayerPanel from "./components/PlayerPanel";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MetadataCache } from "./api/cache";
import SettingsPanel, {
  type SettingsSection,
} from "./components/SettingsPanel";
import SearchBar from "./components/SearchBar";
import PersonDetail from "./components/People";
import { searchScope } from "./stores/searchHistory";
import {
  readLibraryPreferences,
  saveLibraryPreferences,
  visibleLibraries,
  type LibraryPreferences,
} from "./stores/libraryPreferences";
import MediaDetail from "./components/MediaDetail";
import HomeView from "./components/HomeView";
import MediaCard from "./components/MediaCard";
import ContinueWatchingCard from "./components/ContinueWatchingCard";
import MediaListRow from "./components/MediaListRow";
import Toast from "./components/Toast";
import AutomaticUpdateNotice from "./components/AutomaticUpdateNotice";
import { type ToastTone } from "./components/Toast";
import PageHeader, { ViewToggle } from "./components/PageHeader";
import { EmptyState, ErrorState } from "./components/ContentState";
import Pagination from "./components/Pagination";
import QueuePanel from "./components/QueuePanel";
import EpisodeBrowser from "./components/EpisodeBrowser";
import { readSettings, saveSettings, type Settings } from "./stores/settings";
import Sidebar from "./components/Sidebar";
import SidebarLibraries from "./components/SidebarLibraries";
import { PlaybackQueue, type QueueState } from "./player/queue";
import { preparePlayback } from "./player/playback";
import type { Account, Item, UserData } from "./types/emby";
import {
  connectionId,
  connectionLabel,
  readConnections,
  removeConnection,
  type Connection,
} from "./stores/connections";
import {
  readHistory,
  recordHistory,
  clearHistory,
  removeHistory,
} from "./stores/history";
import { recoverHistoryArtwork } from "./api/historyArtwork";
import {
  aggregateFavorites,
  aggregateSearch,
  type SearchGroup,
} from "./api/aggregate";
import { favoriteScope, favoritesChanged } from "./api/favorites";
import { pageInfo } from "./api/pagination";
import { readNetworkDiagnostics } from "./api/diagnostics";
import {
  libraryQuery,
  librarySorts,
  defaultSortOrder,
  type SortOrder,
} from "./api/library";
import { ResolutionIndex } from "./api/resolutionIndex";
import {
  homeRecommendations,
  type Recommendation,
} from "./api/homeRecommendations";
import LibraryPagination from "./components/LibraryPagination";
import LibraryFilters, {
  emptyFilters,
  type BrowseFilters,
} from "./components/LibraryFilters";
import type { PlayerSnapshot } from "./player/playback";
import RoutePanel from "./components/RoutePanel";
import {
  readRouteQuality,
  routeDetail,
  noteRouteChoice,
  testRoute,
  routeWarningsSuppressed,
  suppressRouteWarnings,
} from "./player/smartRoutes";
import { RouteHealth } from "./player/routeHealth";
import { validRecovery, type RecoveryRecord } from "./player/recovery";
import RecoveryDialog from "./components/RecoveryDialog";
import type { PlayerUiModel } from "./player/uiModel";
import {
  verifyRoute,
  readRoutes,
  activeRoutes,
  type ServerRoute,
} from "./stores/routes";
import {
  readLater,
  toggleLater,
  clearLater,
  refreshLater,
} from "./stores/watchLater";
import Skeleton from "./components/Skeleton";
import { readLoginHint, saveLoginHint } from "./stores/loginHints";
import { privateError, privateText, routeLabel } from "./privacy";
import { fetchPreviewImage } from "./player/preview";
import {
  withConnectionRemark,
  connectionRemarkHint,
} from "./stores/connectionRemarks";

// New browsing copy stays together for the future translation catalog.
const browseCopy = {
  ascending: "升序，切换为降序",
  descending: "降序，切换为升序",
  ascendingHint: "当前升序，切换为降序",
  descendingHint: "当前降序，切换为升序",
  searchSortHint:
    "搜索排序仅在服务器支持时生效；若顺序不变，可在媒体库中筛选并排序。",
};

type Route =
  | { kind: "favorites" }
  | { kind: "home" }
  | { kind: "history" }
  | { kind: "later" }
  | { kind: "collections" }
  | { kind: "playlists" }
  | { kind: "library"; item: Item }
  | { kind: "catalog"; mediaType?: "Movie" | "Series"; recent?: boolean }
  | { kind: "search"; query: string }
  | { kind: "person"; item: Item; mediaType?: "Movie" | "Series" }
  | { kind: "detail"; item: Item };
interface PageData {
  items: Item[];
  detail: Item | null;
  resume: Item[];
  nextUp: Item[];
  related: Item[];
  searchGroups: SearchGroup[];
  total: number;
  totalKnown: boolean;
  hasMore: boolean;
  genres: string[];
}
interface BrowseState {
  route: Route;
  page: number;
  sort: string;
  sortOrder: SortOrder;
  pageSize: number;
  filter: string;
  browseFilters: BrowseFilters;
  listMode: boolean;
  searchInput: string;
  allServers: boolean;
  scrollTop: number;
  dataKey: string;
}
export default function App() {
  const [playerRevision, setPlayerRevision] = useState(0);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [playerOwner, setPlayerOwner] = useState("");
  const [stoppingPlayer, setStoppingPlayer] = useState(false);
  const stopRequest = useRef<Promise<void> | null>(null);
  const playbackOrigin = useRef<BrowseState | null>(null);
  const searchOrigin = useRef<BrowseState | null>(null);
  const pageCache = useRef(new MetadataCache(12, 4 * 1024 * 1024));
  const pageSequence = useRef(0);
  const restoringPage = useRef(false);
  const pendingScroll = useRef<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const selectedSeasons = useRef(new Map<string, string>());
  const episodePages = useRef(new Map<string, number>());
  const [theater, setTheater] = useState(false),
    [playedItem, setPlayedItem] = useState<Item | null>(null),
    [playedSource, setPlayedSource] = useState("");
  const [showRoutes, setShowRoutes] = useState(false);
  const [mediaCover, setMediaCover] = useState<number[] | null>(null);
  const mediaStateKey = useRef("");
  const [recovery, setRecovery] = useState<RecoveryRecord>();
  const [recoveryBusy, setRecoveryBusy] = useState(false),
    [recoveryError, setRecoveryError] = useState("");
  const recoveryOverride = useRef<RecoveryRecord | undefined>(undefined);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    void invoke("recovery_read")
      .then((v) => {
        if (!disposed) setRecovery(validRecovery(v));
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  const lastSnapshot = useRef<PlayerSnapshot | null>(null);
  const resumeOverride = useRef<{ itemId: string; position: number } | null>(
    null,
  );
  const [replayRequest, setReplayRequest] = useState<{
    item: Item;
    sourceId: string;
    server: string;
    signal: AbortSignal;
  } | null>(null);
  const replayWaiter = useRef<{
    resolve: () => void;
    reject: (e: unknown) => void;
  } | null>(null);
  const [settings, setSettings] = useState(readSettings),
    [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("playback");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [queueState, setQueueState] = useState<QueueState>({
    items: [],
    index: 0,
    busy: false,
    error: "",
    warning: "",
  });
  const [demoUpdates, setDemoUpdates] = useState<Record<string, UserData>>({});
  const [demoSavedItems, setDemoSavedItems] = useState<Record<string, Item>>(
    {},
  );
  const [account, setAccount] = useState<Account | null>(readAccount);
  const [sort, setSort] = useState(() => readSortPreference(account).sort),
    [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    () => readSortPreference(account).sortOrder,
  );
  const [libraryPageSize, setLibraryPageSize] = useState(readPageSize);
  const [routeQualityRevision, setRouteQualityRevision] = useState(0);
  const [routeHint, setRouteHint] = useState<PlayerUiModel["routeHint"]>();
  const availableRoutes = useMemo(
    () => (account ? activeRoutes(account) : []),
    [account, routeQualityRevision],
  );
  const routeQuality = useMemo(
    () => (account ? readRouteQuality(account) : undefined),
    [account, routeQualityRevision],
  );
  const resolutionIndex = useRef(new ResolutionIndex());
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const routeHealth = useRef(new RouteHealth()),
    ignoredRouteHint = useRef("");
  const lastRouteNotice = useRef(0);
  useEffect(() => {
    const update = () => setRouteQualityRevision((n) => n + 1);
    window.addEventListener("miry-route-quality", update);
    return () => window.removeEventListener("miry-route-quality", update);
  }, []);
  useEffect(() => {
    routeHealth.current = new RouteHealth();
    setRouteHint(undefined);
    ignoredRouteHint.current = "";
  }, [account?.server]);
  const scope = searchScope(account);
  useEffect(() => {
    const preference = readSortPreference(account);
    setSort(preference.sort);
    setSortOrder(preference.sortOrder);
  }, [scope]);
  const [libraryPreferences, setLibraryPreferences] = useState(() =>
    readLibraryPreferences(scope),
  );
  useEffect(
    () => setLibraryPreferences(readLibraryPreferences(scope)),
    [scope],
  );
  const updateLibraries = (prefs: LibraryPreferences) => {
    saveLibraryPreferences(scope, prefs);
    setLibraryPreferences(prefs);
  };
  const [later, setLater] = useState(() => readLater(account));
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState<ToastTone>("success");
  const dismissToast = useCallback(() => setToast(""), []);
  useEffect(() => {
    const notify = (event: Event) => {
      const { message, tone } = (
        event as CustomEvent<{ message: string; tone: ToastTone }>
      ).detail;
      setToast(message);
      setToastTone(tone);
    };
    window.addEventListener("miry-toast", notify);
    return () => window.removeEventListener("miry-toast", notify);
  }, []);
  useEffect(() => setLater(readLater(account)), [account]);
  const changeLater = (item: Item) => {
    try {
      const entries = toggleLater(account, item);
      setLater(entries);
      setToastTone("success");
      setToast(
        entries.some((i) => i.Id === item.Id)
          ? "已加入待看清单"
          : "已移出待看清单",
      );
    } catch {
      setError("待看清单保存失败，请检查本机存储空间。");
    }
  };
  const [connections, setConnections] = useState(readConnections);
  const [addingServer, setAddingServer] = useState(false),
    [switching, setSwitching] = useState(false);
  const [allServers, setAllServers] = useState(false),
    [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [browseFilters, setBrowseFilters] =
      useState<BrowseFilters>(emptyFilters),
    [genres, setGenres] = useState<string[]>([]);
  const [listMode, setListMode] = useState(
    () => localStorage.getItem("miry-layout") === "list",
  );
  const [watched, setWatched] = useState(() => readHistory(account));
  const [related, setRelated] = useState<Item[]>([]),
    [playerActive, setPlayerActive] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const switchingLock = useRef(false);
  const addServerPanel = useRef<HTMLDivElement | null>(null);
  const launched = useRef<{
    account: Account;
    item: Item;
    session: string;
    updated: number;
  } | null>(null);
  const [demo, setDemo] = useState(false);
  const [route, setRoute] = useState<Route>({ kind: "home" });
  const pageSize =
    route.kind === "library" ||
    route.kind === "catalog" ||
    route.kind === "search"
      ? libraryPageSize
      : route.kind === "detail" &&
          ["Series", "Season"].includes(route.item.Type)
        ? 100
        : 30;
  const history = useRef<BrowseState[]>([]);
  const mainPanel = useRef<HTMLElement | null>(null);
  const browsing = route.kind === "library" || route.kind === "catalog";
  const queryControls = browsing || route.kind === "search";
  const ordinaryBrowse =
    browsing && !(route.kind === "catalog" && route.recent);
  const changeSort = (nextSort: string, nextOrder: SortOrder) => {
    if (ordinaryBrowse)
      saveSortPreference(account, { sort: nextSort, sortOrder: nextOrder });
    setSort(nextSort);
    setSortOrder(nextOrder);
    setPage(0);
  };
  const [views, setViews] = useState<Item[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [resume, setResume] = useState<Item[]>([]);
  const displayedViews = useMemo(
    () => visibleLibraries(views, libraryPreferences),
    [views, libraryPreferences],
  );
  const [detail, setDetail] = useState<Item | null>(null),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0);
  const [totalKnown, setTotalKnown] = useState(true),
    [hasMore, setHasMore] = useState(false);
  const [nextUp, setNextUp] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const paginationContext = JSON.stringify([
    account && connectionId(account),
    route,
    sort,
    sortOrder,
    pageSize,
    filter,
    browseFilters,
    allServers,
  ]);
  const loadingPageContext = useRef("");
  const client = useMemo(
    () => (account ? new EmbyClient(account) : null),
    [account],
  );
  const currentAccount = useRef(account);
  currentAccount.current = account;
  useEffect(() => {
    const changed = (event: Event) => {
      const owner = (event as CustomEvent<string>).detail;
      if (
        !account ||
        (favoriteScope(account) !== owner &&
          !connections.some((c) => favoriteScope(c.account) === owner))
      )
        return;
      for (const saved of [
        ...history.current,
        ...(playbackOrigin.current ? [playbackOrigin.current] : []),
        ...(searchOrigin.current ? [searchOrigin.current] : []),
      ])
        if (saved.route.kind === "favorites")
          pageCache.current.remove(saved.dataKey);
      if (
        route.kind === "favorites" &&
        (allServers || favoriteScope(account) === owner)
      ) {
        restoringPage.current = false;
        setReload((r) => r + 1);
      }
    };
    window.addEventListener(favoritesChanged, changed);
    return () => window.removeEventListener(favoritesChanged, changed);
  }, [account, connections, route.kind, allServers]);
  useEffect(() => {
    setMediaCover(null);
    if (!client || !playedItem || !isTauri()) return;
    const raw = client.image(playedItem);
    if (!raw) return;
    const url = new URL(raw);
    url.searchParams.delete("api_key");
    const root = new URL(client.account.server);
    if (
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname + "/")
    )
      return;
    const path = url.pathname.slice(root.pathname.length) + url.search;
    const controller = new AbortController();
    void fetchPreviewImage(client, path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setMediaCover(
            Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0)),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [client, playedItem]);
  const snapshotReceiver = useRef<(s: PlayerSnapshot) => void>(() => {});
  const capturePage = useRef<() => BrowseState>(() => {
    throw new Error("页面尚未就绪");
  });
  capturePage.current = () => {
    const dataKey = String(++pageSequence.current);
    if (!busy && !error)
      pageCache.current.set(
        dataKey,
        {
          items,
          detail,
          resume,
          nextUp,
          related,
          searchGroups,
          total,
          totalKnown,
          hasMore,
          genres,
        } satisfies PageData,
        120000,
      );
    return {
      route,
      page,
      sort,
      sortOrder,
      pageSize: libraryPageSize,
      filter,
      browseFilters,
      listMode,
      searchInput,
      allServers,
      scrollTop: mainPanel.current?.scrollTop || 0,
      dataKey,
    };
  };
  function restorePage(state: BrowseState) {
    const data = pageCache.current.get<PageData>(state.dataKey);
    restoringPage.current = !!data;
    pendingScroll.current = state.scrollTop;
    setRoute({ ...state.route });
    setPage(state.page);
    setSort(state.sort);
    setSortOrder(state.sortOrder);
    setLibraryPageSize(state.pageSize);
    savePageSize(state.pageSize);
    setFilter(state.filter);
    setBrowseFilters(state.browseFilters);
    setListMode(state.listMode);
    localStorage.setItem("miry-layout", state.listMode ? "list" : "grid");
    setSearchInput(state.searchInput);
    setAllServers(state.allServers);
    setError("");
    if (data) {
      const progress = readHistory(account).filter(
        (entry) => Date.now() - entry.at < 60000,
      );
      const merge = (item: Item) => {
        const local = progress.find((entry) => entry.item.Id === item.Id);
        return local
          ? {
              ...item,
              UserData: {
                ...item.UserData,
                PlaybackPositionTicks:
                  local.item.UserData?.PlaybackPositionTicks,
                Played: local.item.UserData?.Played,
              },
            }
          : item;
      };
      setItems(data.items.map(merge));
      setDetail(data.detail && merge(data.detail));
      setResume(data.resume.map(merge));
      setNextUp(data.nextUp.map(merge));
      setRelated(data.related.map(merge));
      setSearchGroups(data.searchGroups);
      setTotal(data.total);
      setTotalKnown(data.totalKnown);
      setHasMore(data.hasMore);
      setGenres(data.genres);
      setBusy(false);
    }
  }
  useLayoutEffect(() => {
    if (theater || busy || pendingScroll.current === null || !mainPanel.current)
      return;
    const panel = mainPanel.current;
    const target = pendingScroll.current;
    const restore = () => {
      panel.scrollTop = target;
    };
    restore();
    const content = panel.querySelector(".content");
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(restore);
    if (content) observer?.observe(content);
    const timer = setTimeout(() => {
      observer?.disconnect();
      pendingScroll.current = null;
    }, 15000);
    const cancel = () => {
      observer?.disconnect();
      clearTimeout(timer);
      pendingScroll.current = null;
    };
    panel.addEventListener("wheel", cancel, { once: true });
    panel.addEventListener("pointerdown", cancel, { once: true });
    panel.addEventListener("keydown", cancel, { once: true });
    return () => {
      observer?.disconnect();
      clearTimeout(timer);
      panel.removeEventListener("wheel", cancel);
      panel.removeEventListener("pointerdown", cancel);
      panel.removeEventListener("keydown", cancel);
    };
  }, [busy, theater, route]);
  const queue = useMemo(
    () =>
      new PlaybackQueue(
        {
          stop: async () => {
            if (isTauri()) {
              const state = await invoke<PlayerSnapshot | undefined>(
                "player_stop",
              );
              if (state) snapshotReceiver.current(state);
              else {
                const final = await invoke<PlayerSnapshot>("player_status");
                snapshotReceiver.current(final);
              }
            }
          },
          launch: async (item, fromStart, signal, sourceId) => {
            if (!isTauri()) throw new Error("请在桌面客户端中播放。");
            if (!client) throw new Error("请先登录服务器。");
            const fresh = await client.item(item.Id, signal);
            const local = readHistory(client.account).find(
              (entry) => entry.item.Id === item.Id,
            );
            if (
              !fromStart &&
              local &&
              (!fresh.UserData?.PlaybackPositionTicks ||
                Date.now() - local.at < 60000)
            )
              fresh.UserData = {
                ...fresh.UserData,
                PlaybackPositionTicks:
                  local.item.UserData?.PlaybackPositionTicks || 0,
              };
            const resume = resumeOverride.current;
            if (resume?.itemId === fresh.Id && !fromStart)
              fresh.UserData = {
                ...fresh.UserData,
                PlaybackPositionTicks: Math.round(resume.position * 10000000),
              };
            resumeOverride.current = null;
            const launch = await preparePlayback(
              client,
              fresh,
              fromStart,
              signal,
              sourceId,
              settingsRef.current,
            );
            const restore = recoveryOverride.current;
            if (
              restore?.itemId === fresh.Id &&
              restore.sourceId === launch.sourceId
            ) {
              if (restore.audioIndex != null)
                launch.audioIndex = restore.audioIndex;
              if (restore.subtitleIndex != null)
                launch.subtitleIndex = restore.subtitleIndex;
            }
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");
            await invoke("player_start", { launch });
            recoveryOverride.current = undefined;
            setRecovery(undefined);
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");
            if (!playbackOrigin.current)
              playbackOrigin.current = capturePage.current();
            setPlayerOwner(connectionId(client.account));
            setPlayedItem(fresh);
            setPlayedSource(launch.sourceId);
            setTheater(true);
            launched.current = {
              account: client.account,
              item: fresh,
              session: launch.playSessionId,
              updated: Date.now(),
            };
            setWatched(
              recordHistory(client.account, fresh, launch.startSeconds),
            );
            setPlayerRevision((p) => p + 1);
            return launch.playSessionId;
          },
          episodes: async (item, signal) => {
            if (!client) return [];
            const fresh = item.SeriesId
              ? item
              : await client.item(item.Id, signal);
            if (!fresh.SeriesId)
              throw new Error("服务器没有返回剧集所属系列。");
            return (await client.episodes(fresh.SeriesId, item.Id, signal))
              .Items;
          },
          autoNext: () => settingsRef.current.autoNext,
        },
        setQueueState,
      ),
    [client],
  );
  useEffect(() => () => queue.cancelAuto(), [queue]);
  useEffect(() => {
    if (!replayRequest || client?.account.server !== replayRequest.server)
      return;
    const waiter = replayWaiter.current;
    if (!waiter) return;
    replayWaiter.current = null;
    void queue
      .play(
        replayRequest.item,
        false,
        replayRequest.sourceId || undefined,
        replayRequest.signal,
      )
      .then(waiter.resolve, waiter.reject)
      .finally(() => {
        resumeOverride.current = null;
        setReplayRequest(null);
      });
  }, [queue, client, replayRequest]);
  useEffect(() => {
    if (queueState.error || queueState.warning) setShowQueue(true);
  }, [queueState.error, queueState.warning]);
  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };
  useEffect(() => {
    const update = () => setSettings(readSettings());
    window.addEventListener("miry-settings-changed", update);
    return () => window.removeEventListener("miry-settings-changed", update);
  }, []);
  const updateUserData = (item: Item, data: UserData, owner = account) => {
    if (
      owner &&
      (!currentAccount.current ||
        favoriteScope(owner) !== favoriteScope(currentAccount.current))
    )
      return;
    if (
      data.IsFavorite !== undefined &&
      data.IsFavorite !== !!item.UserData?.IsFavorite
    ) {
      setToastTone("success");
      setToast(data.IsFavorite ? "已加入收藏" : "已移出收藏");
    }
    setDetail((d) =>
      d?.Id === item.Id ? { ...d, UserData: { ...d.UserData, ...data } } : d,
    );
    setItems((list) =>
      list.map((i) =>
        i.Id === item.Id ? { ...i, UserData: { ...i.UserData, ...data } } : i,
      ),
    );
    const merge = (i: Item) =>
      i.Id === item.Id ? { ...i, UserData: { ...i.UserData, ...data } } : i;
    setResume((list) => list.map(merge));
    setNextUp((list) => list.map(merge));
    setRelated((list) => list.map(merge));
    // Keep saved browsing pages consistent with actions taken on a detail page.
    const savedStates = [
      ...history.current,
      ...(playbackOrigin.current ? [playbackOrigin.current] : []),
      ...(searchOrigin.current ? [searchOrigin.current] : []),
    ];
    // Watched changes affect membership and user-based ordering, not only card badges.
    if (data.Played !== undefined || data.PlaybackPositionTicks !== undefined) {
      for (const saved of savedStates) {
        if (
          ["library", "catalog", "search"].includes(saved.route.kind) &&
          (saved.filter !== "all" ||
            ["DatePlayed", "PlayCount"].includes(saved.sort))
        )
          pageCache.current.remove(saved.dataKey);
      }
      if (
        queryControls &&
        (filter !== "all" || ["DatePlayed", "PlayCount"].includes(sort))
      ) {
        restoringPage.current = false;
        setReload((r) => r + 1);
      }
    }
    const savedPages = new Set(savedStates.map((state) => state.dataKey));
    for (const key of savedPages) {
      const data = pageCache.current.get<PageData>(key);
      if (data)
        pageCache.current.set(
          key,
          {
            ...data,
            items: data.items.map(merge),
            detail: data.detail && merge(data.detail),
            resume: data.resume.map(merge),
            nextUp: data.nextUp.map(merge),
            related: data.related.map(merge),
          },
          120000,
        );
    }
    if (demo) {
      setDemoUpdates((all) => ({
        ...all,
        [item.Id]: { ...all[item.Id], ...data },
      }));
      setDemoSavedItems((all) => ({ ...all, [item.Id]: item }));
    }
  };
  const go = (next: Route) => {
    history.current.push(capturePage.current());
    if (history.current.length > 30) history.current.shift();
    if (next.kind === "library" || next.kind === "catalog") {
      setBrowseFilters({
        ...emptyFilters,
        type: next.kind === "catalog" ? next.mediaType || "" : "",
      });
      setFilter("all");
      const preference =
        next.kind === "catalog" && next.recent
          ? { sort: "DateCreated", sortOrder: "Descending" as const }
          : readSortPreference(account);
      setSort(preference.sort);
      setSortOrder(preference.sortOrder);
    }
    setRoute(next);
    if (next.kind === "search") {
      setSearchInput(next.query);
      setBrowseFilters((previous) => ({ ...previous, resolution: "" }));
    }
    setPage(0);
    setError("");
    if (mainPanel.current) mainPanel.current.scrollTop = 0;
  };
  const back = () => {
    const previous = history.current.pop();
    if (previous) restorePage(previous);
    else go({ kind: "home" });
  };
  const navigateSidebar = (next: Route) => {
    const matches = (candidate: Route) =>
      candidate.kind === next.kind &&
      (next.kind !== "library" ||
        (candidate.kind === "library" && candidate.item.Id === next.item.Id));
    if (matches(route)) return;
    const previous = [...history.current]
      .reverse()
      .find((entry) => matches(entry.route));
    if (!previous) {
      go(next);
      return;
    }
    history.current.push(capturePage.current());
    if (history.current.length > 30) history.current.shift();
    const preference =
      next.kind === "library" || (next.kind === "catalog" && !next.recent)
        ? readSortPreference(account)
        : null;
    if (
      preference &&
      (previous.sort !== preference.sort ||
        previous.sortOrder !== preference.sortOrder)
    ) {
      // Keep filters/layout/page size, but an old sidebar snapshot must not revive
      // an obsolete preference or show cached results for another ordering.
      restorePage({
        ...previous,
        ...preference,
        page: 0,
        scrollTop: 0,
        dataKey: "",
      });
    } else restorePage(previous);
  };
  const changePage = (next: number) => {
    if (next === page || !Number.isSafeInteger(next) || next < 0) return;
    setPage(next);
    if (mainPanel.current) mainPanel.current.scrollTop = 0;
  };
  const changePageSize = (next: number) => {
    if (!validPageSize(next) || next === libraryPageSize) return;
    savePageSize(next);
    setLibraryPageSize(next);
    setPage(0);
    if (mainPanel.current) mainPanel.current.scrollTop = 0;
  };
  async function switchConnection(
    connection: Connection,
    destination: Route = { kind: "home" },
  ) {
    if (switchingLock.current) return;
    switchingLock.current = true;
    setSwitching(true);
    setError("");
    try {
      await queue.stop();
      saveAccount(connection.account, connection.remember);
      setAccount(connection.account);
      setViews([]);
      setDemo(false);
      history.current = [];
      pageCache.current.clear();
      playbackOrigin.current = null;
      searchOrigin.current = null;
      pendingScroll.current = null;
      setSearchInput("");
      setRoute(destination);
      setPage(0);
      setBrowseFilters(emptyFilters);
      setFilter("all");
      setWatched(readHistory(connection.account));
      setConnections(readConnections());
      setAddingServer(false);
      setTheater(false);
      setPlayedItem(null);
      setPlayedSource("");
      resumeOverride.current = null;
      lastSnapshot.current = null;
      setPlayerActive(false);
      setShowQueue(false);
      launched.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      switchingLock.current = false;
      setSwitching(false);
    }
  }
  const automaticAttempt = useRef("");
  async function switchLine(
    route: ServerRoute,
    signal: AbortSignal,
    selection: "manual" | "auto" = "manual",
  ) {
    if (!account || switchingLock.current)
      throw new Error("连接正在切换，请稍后再试。");
    switchingLock.current = true;
    setSwitching(true);
    try {
      const checked = await verifyRoute(account, route.url, signal);
      if (selection === "auto") {
        const quality = readRouteQuality(account);
        const status = isTauri()
          ? await invoke<PlayerSnapshot>("player_status")
          : null;
        if (
          quality.mode !== "auto" ||
          quality.recommended !== checked.url ||
          status?.active ||
          queue.state.busy
        )
          throw new DOMException("Aborted", "AbortError");
      }
      const snapshot = isTauri()
        ? await invoke<PlayerSnapshot>("player_status")
        : null;
      const current =
        launched.current ||
        (theater &&
        playedItem &&
        snapshot?.error &&
        snapshot.itemId === playedItem.Id
          ? { item: playedItem, session: snapshot.playSessionId }
          : null);
      const resume =
        current &&
        (snapshot?.active || (snapshot?.error && !snapshot.finished)) &&
        snapshot.playSessionId === current.session
          ? {
              item: current.item,
              position: snapshot.position,
              sourceId: playedSource,
            }
          : null;
      await queue.stop();
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const finalPosition = lastSnapshot.current;
      if (
        resume &&
        finalPosition?.itemId === resume.item.Id &&
        finalPosition.playSessionId === current?.session &&
        Number.isFinite(finalPosition.position)
      )
        resume.position = finalPosition.position;
      const next = {
        ...account,
        homeServer: account.homeServer || account.server,
        server: checked.url,
        serverId: checked.serverId,
      };
      const remember =
        connections.find(
          (c) => connectionId(c.account) === connectionId(account),
        )?.remember || false;
      saveAccount(next, remember);
      setAccount(next);
      setConnections(readConnections());
      noteRouteChoice(next, checked.url, selection === "manual");
      setRouteHint(undefined);
      setPlayerActive(false);
      if (resume) {
        resumeOverride.current = {
          itemId: resume.item.Id,
          position: Number.isFinite(resume.position)
            ? Math.max(0, resume.position)
            : 0,
        };
        const wait = new Promise<void>((resolve, reject) => {
          replayWaiter.current = { resolve, reject };
        });
        setReplayRequest({
          item: resume.item,
          sourceId: resume.sourceId,
          server: next.server,
          signal,
        });
        await wait;
      }
    } finally {
      switchingLock.current = false;
      setSwitching(false);
    }
  }
  async function restartCurrent(sourceId = playedSource) {
    if (!playedItem) return;
    const snapshot = isTauri()
      ? await invoke<PlayerSnapshot>("player_status")
      : lastSnapshot.current;
    if (
      snapshot?.itemId === playedItem.Id &&
      Number.isFinite(snapshot.position)
    )
      resumeOverride.current = {
        itemId: playedItem.Id,
        position: snapshot.finished ? 0 : snapshot.position,
      };
    try {
      await queue.play(playedItem, false, sourceId || undefined);
    } finally {
      resumeOverride.current = null;
    }
  }
  const receiveSnapshot = (snapshot: PlayerSnapshot) => {
    if (
      launched.current &&
      snapshot.playSessionId &&
      snapshot.playSessionId !== launched.current.session
    )
      return;
    lastSnapshot.current = snapshot;
    const mediaKey = `${snapshot.playSessionId}:${snapshot.active}:${snapshot.loaded}:${snapshot.paused}:${queueState.index}:${queueState.items.length}:${settings.systemMedia}:${mediaCover?.length}`;
    if (isTauri() && mediaStateKey.current !== mediaKey) {
      mediaStateKey.current = mediaKey;
      void invoke("system_media_update", {
        info: {
          enabled: settings.systemMedia !== false,
          active: snapshot.active && snapshot.loaded,
          paused: snapshot.paused,
          title: playedItem?.SeriesName || snapshot.title || "",
          episode: playedItem?.Type === "Episode" ? playedItem.Name : "",
          next:
            queueState.index + 1 < queueState.items.length ||
            playedItem?.Type === "Episode",
          previous: queueState.index > 0,
          cover: mediaCover || null,
        },
      }).catch(() => {});
    }
    setPlayerActive(snapshot.active);
    if (account && availableRoutes.length > 1) {
      const bitrate = playedItem?.MediaSources?.find(
        (s) => s.Id === playedSource,
      )?.Bitrate;
      const reason = routeHealth.current.update(snapshot, Date.now(), bitrate);
      if (reason && !snapshot.syncError && !routeWarningsSuppressed()) {
        const hintKey = `${account.server}:${snapshot.playSessionId}:${reason}`;
        if (
          ignoredRouteHint.current !== hintKey &&
          routeHint?.reason !== reason &&
          Date.now() - lastRouteNotice.current > 60000
        ) {
          lastRouteNotice.current = Date.now();
          const q = readRouteQuality(account),
            routes = availableRoutes,
            index = routes.findIndex(
              (r) => r.url === q.recommended && r.url !== account.server,
            );
          setRouteHint({
            reason,
            index: index >= 0 ? index : undefined,
            name:
              index >= 0 ? routeLabel(routes[index].name, index) : undefined,
          });
        }
      } else {
        setRouteHint(undefined);
        ignoredRouteHint.current = "";
      }
    }
    void queue.snapshot(snapshot);
    const current = launched.current;
    if (
      current &&
      snapshot.playSessionId === current.session &&
      snapshot.itemId === current.item.Id &&
      Number.isFinite(snapshot.position) &&
      (Date.now() - current.updated > 1000 || !snapshot.active)
    ) {
      current.updated = Date.now();
      const entries = recordHistory(
        current.account,
        current.item,
        snapshot.position,
        snapshot.finished && !!snapshot.syncComplete,
      );
      if (account && connectionId(current.account) === connectionId(account))
        setWatched(entries);
      if (!snapshot.active)
        updateUserData(current.item, entries[0].item.UserData || {});
      if (!snapshot.active && snapshot.syncComplete) launched.current = null;
    }
  };
  snapshotReceiver.current = receiveSnapshot;
  const systemAction = useRef<(action: string) => Promise<unknown>>(
    async () => {},
  );
  systemAction.current = async (action) => {
    if (
      settings.systemMedia === false ||
      !lastSnapshot.current?.active ||
      queue.state.busy
    )
      return;
    if (action === "play" || action === "pause")
      return invoke("player_control", {
        action: "setPaused",
        value: action === "pause" ? 1 : 0,
      });
    if (action === "next") return queue.next();
    if (action === "previous" && queue.state.index > 0)
      return queue.select(queue.state.index - 1);
  };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false,
      remove: (() => void) | undefined;
    void listen<string>("system-media-action", (e) => {
      if (!disposed) void systemAction.current(e.payload).catch(() => {});
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else remove = unlisten;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);
  useEffect(() => {
    if (
      !account ||
      !availableRoutes.length ||
      theater ||
      playerActive ||
      switching ||
      queueState.busy
    )
      return;
    const q = readRouteQuality(account);
    if (q.mode !== "auto" || !q.recommended || q.recommended === account.server)
      return;
    const route = activeRoutes(account).find(
      (r) => r.url === q.recommended && r.serverId === account.serverId,
    );
    if (!route) return;
    const attempt = `${account.server}|${q.recommended}|${q.tests[q.recommended]?.at}`;
    if (automaticAttempt.current === attempt) return;
    automaticAttempt.current = attempt;
    const controller = new AbortController();
    void switchLine(route, controller.signal, "auto").catch(() => {
      if (!controller.signal.aborted)
        setError("推荐线路暂时无法使用，请手动选择。");
    });
  }, [account, routeQualityRevision, theater, playerActive, queueState.busy]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    void listen<PlayerSnapshot>("player-final-snapshot", (event) => {
      if (!disposed) snapshotReceiver.current(event.payload);
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else remove = unlisten;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);
  async function exitPlayback() {
    if (stopRequest.current) return stopRequest.current;
    setStoppingPlayer(true);
    stopRequest.current = (async () => {
      try {
        await queue.stop();
        const origin = playbackOrigin.current;
        playbackOrigin.current = null;
        setTheater(false);
        setPlayerFullscreen(false);
        setPlayerActive(false);
        setPlayedItem(null);
        setPlayedSource("");
        setShowQueue(false);
        if (origin) restorePage(origin);
        client?.cache.clear();
        const state = lastSnapshot.current;
        if (state?.syncError) setToastTone("warning");
        setToast(
          state?.syncError
            ? "播放位置已保存在本机，服务器同步失败"
            : "播放已停止",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setStoppingPlayer(false);
        stopRequest.current = null;
      }
    })();
    return stopRequest.current;
  }
  const closeServerDialog = useDialogFocus(
    addServerPanel,
    () => setAddingServer(false),
    false,
    addingServer,
    "input:not(:disabled)",
  );

  useEffect(() => {
    if (route.kind !== "library" && route.kind !== "catalog") return;
    if (!client) {
      setGenres([...new Set(demoItems.flatMap((i) => i.Genres || []))]);
      return;
    }
    const controller = new AbortController();
    setGenres([]);
    void client
      .genres(
        route.kind === "library" ? route.item.Id : undefined,
        controller.signal,
      )
      .then((result) => {
        if (!controller.signal.aborted)
          setGenres(result.Items.map((i) => i.Name));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [client, route]);
  useEffect(() => {
    if (!client && !demo) return;
    const samePageContext = loadingPageContext.current === paginationContext;
    loadingPageContext.current = paginationContext;
    if (restoringPage.current) {
      restoringPage.current = false;
      return;
    }
    const controller = new AbortController();
    let active = true;
    setBusy(true);
    setError("");
    setItems([]);
    if (route.kind === "home") setRecommendations([]);
    setDetail(null);
    setResume([]);
    setNextUp([]);
    setSearchGroups([]);
    setRelated([]);
    // Keep the current context's known bounds while another page is loading,
    // so a second jump can cancel the first through the existing request guard.
    if (!samePageContext) {
      setTotal(0);
      setTotalKnown(true);
      setHasMore(false);
    }
    function updatePage(
      result: Parameters<typeof pageInfo>[0],
      limit = pageSize,
    ) {
      // A library can shrink while the user is on its last page.
      if (
        page > 0 &&
        !result.Items.length &&
        Number.isSafeInteger(result.TotalRecordCount) &&
        result.TotalRecordCount > 0 &&
        page * limit >= result.TotalRecordCount
      ) {
        setPage(Math.ceil(result.TotalRecordCount / limit) - 1);
        return;
      }
      const info = pageInfo(result, page * limit, limit);
      setItems(result.Items);
      setTotal(info.total);
      setTotalKnown(info.totalKnown);
      setHasMore(info.hasMore);
    }
    async function load() {
      if (route.kind === "later") {
        setItems(later);
        setTotal(later.length);
        if (client && account && later.length) {
          const refreshed = await refreshLater(
            account,
            client,
            controller.signal,
          ).catch(() => later);
          if (active) setItems(refreshed);
        }
        return;
      }
      if (route.kind === "history") {
        setItems(watched.map((e) => e.item));
        setTotal(watched.length);
        if (client && account)
          void recoverHistoryArtwork(
            client,
            account,
            controller.signal,
            (entries) => {
              if (!active) return;
              setWatched(entries);
              setItems(entries.map((e) => e.item));
              setTotal(entries.length);
            },
          );
        return;
      }
      if (demo) {
        setViews(demoViews);
        const demoList = [
          ...demoItems,
          ...Object.values(demoSavedItems).filter(
            (i) => !demoItems.some((a) => a.Id === i.Id),
          ),
        ].map((i) => ({
          ...i,
          UserData: { ...i.UserData, ...demoUpdates[i.Id] },
        }));
        let list: Item[] = demoList;
        if (route.kind === "collections" || route.kind === "playlists")
          list = [
            {
              Id: "demo-group",
              Name: route.kind === "collections" ? "精选电影" : "周末片单",
              Type: route.kind === "collections" ? "BoxSet" : "Playlist",
            },
          ];
        if (route.kind === "library")
          list =
            route.item.Id === "movies"
              ? demoList.filter((i) => i.Type === "Movie")
              : route.item.Id === "series"
                ? demoList.filter((i) => i.Type === "Series")
                : [{ Id: "ds1", Name: "第 1 季", Type: "Season" }];
        if (route.kind === "favorites")
          list = demoList.filter((i) => i.UserData?.IsFavorite);
        if (route.kind === "search")
          list = demoList.filter((i) => i.Name.includes(route.query));
        if (route.kind === "person") {
          setDetail(
            demoPeople.find((person) => person.Id === route.item.Id) ||
              route.item,
          );
          list = demoList.filter(
            (item) =>
              item.People?.some((person) => person.Id === route.item.Id) &&
              (!route.mediaType || item.Type === route.mediaType),
          );
        }
        if (route.kind === "detail") {
          setDetail({
            ...route.item,
            UserData: { ...route.item.UserData, ...demoUpdates[route.item.Id] },
          });
          list = demoChildren(route.item).map((i) => ({
            ...i,
            UserData: { ...i.UserData, ...demoUpdates[i.Id] },
          }));
          if (["BoxSet", "Playlist"].includes(route.item.Type))
            list = demoList.filter((i) => i.Type === "Movie");
        }
        if (queryControls) {
          list = list.filter(
            (i) =>
              (!browseFilters.type || i.Type === browseFilters.type) &&
              (!browseFilters.genre ||
                i.Genres?.includes(browseFilters.genre)) &&
              (!browseFilters.year ||
                i.ProductionYear === Number(browseFilters.year)) &&
              (!browseFilters.rating ||
                (i.CommunityRating || 0) >= Number(browseFilters.rating)),
          );
          if (filter !== "all")
            list = list.filter(
              (i) => !!i.UserData?.Played === (filter === "played"),
            );
          list = [...list].sort((a, b) => {
            const primary =
              sort === "ProductionYear"
                ? (a.ProductionYear || 0) - (b.ProductionYear || 0)
                : sort === "CommunityRating"
                  ? (a.CommunityRating || 0) - (b.CommunityRating || 0)
                  : sort === "Runtime"
                    ? (a.RunTimeTicks || 0) - (b.RunTimeTicks || 0)
                    : 0;
            return (
              (primary || a.Name.localeCompare(b.Name, "zh-CN")) *
              (sortOrder === "Ascending" ? 1 : -1)
            );
          });
        }
        if (route.kind === "home")
          setResume(
            demoList.filter(
              (i) =>
                (i.UserData?.PlaybackPositionTicks || 0) > 0 &&
                !i.UserData?.Played,
            ),
          );
        if (queryControls)
          updatePage({
            Items: list.slice(page * pageSize, (page + 1) * pageSize),
            TotalRecordCount: list.length,
          });
        else {
          setItems(list);
          setTotal(list.length);
        }
        return;
      }
      const api = client!;
      const signal = controller.signal;
      const libraries = await api.views(signal);
      if (!active) return;
      setViews(libraries.Items);
      if (
        (route.kind === "search" || route.kind === "favorites") &&
        allServers
      ) {
        const groups =
          route.kind === "favorites"
            ? await aggregateFavorites(connections, page, signal)
            : await aggregateSearch(connections, route.query, page, signal, {
                ...libraryQuery(
                  undefined,
                  browseFilters,
                  sort,
                  filter,
                  sortOrder,
                ),
                IncludeItemTypes: browseFilters.type || "Movie,Series,Episode",
                Limit: pageSize,
              });
        if (active) {
          setSearchGroups(groups);
          setTotal(Math.max(0, ...groups.map((g) => g.total)));
          setTotalKnown(groups.every((g) => g.totalKnown));
          setHasMore(groups.some((g) => g.hasMore));
        }
        return;
      }
      if (route.kind === "home") {
        void homeRecommendations(
          [
            ...connections.filter(
              (c) => connectionId(c.account) === connectionId(account!),
            ),
            ...connections.filter(
              (c) => connectionId(c.account) !== connectionId(account!),
            ),
          ],
          libraries.Items,
          signal,
        )
          .then((result) => {
            if (active) setRecommendations(result);
          })
          .catch((e) => {
            if (active && e.name !== "AbortError") setRecommendations([]);
          });
        void api
          .resume(signal)
          .then((result) => {
            if (active) setResume(result.Items);
          })
          .catch((e) => {
            if (e instanceof ApiError && e.status === 401) reportError(e);
            else if (active && e.name !== "AbortError")
              setError("继续观看暂时无法加载。");
          });
        void api
          .nextUp(undefined, signal)
          .then((result) => {
            if (active) setNextUp(result.Items);
          })
          .catch((e) => {
            if (e instanceof ApiError && e.status === 401) reportError(e);
          });
        const latest = await api.items(
          {
            Recursive: true,
            IncludeItemTypes: "Movie,Series",
            SortBy: "DateCreated",
            SortOrder: "Descending",
            Limit: 18,
          },
          signal,
        );
        if (!active) return;
        updatePage(latest, 18);
      } else if (route.kind === "person") {
        const [person, works] = await Promise.allSettled([
          api.person(route.item.Id, signal),
          api.personWorks(route.item.Id, page, route.mediaType, signal),
        ]);
        if (!active) return;
        if (
          person.status === "rejected" &&
          person.reason instanceof ApiError &&
          person.reason.status === 401
        )
          throw person.reason;
        setDetail(person.status === "fulfilled" ? person.value : route.item);
        if (person.status === "rejected")
          setError("人物简介暂时无法加载，请重试。");
        if (works.status === "rejected") throw works.reason;
        updatePage(works.value);
      } else if (route.kind === "detail") {
        const item = await api.item(route.item.Id, signal);
        if (!active) return;
        setDetail(item);
        if (["Movie", "Series"].includes(item.Type))
          void api
            .similar(item.Id, signal)
            .then((result) => {
              if (active) setRelated(result.Items);
            })
            .catch(() => {});
        if (["Series", "Season", "BoxSet", "Playlist"].includes(item.Type)) {
          const children =
            item.Type === "Playlist"
              ? await api.playlistItems(item.Id, page, signal)
              : await api.items(
                  {
                    ParentId: item.Id,
                    SortBy: "IndexNumber",
                    Limit: item.Type === "BoxSet" ? 30 : 100,
                    StartIndex: page * (item.Type === "BoxSet" ? 30 : 100),
                  },
                  signal,
                );
          if (active) {
            updatePage(children);
          }
        }
      } else {
        const query =
          route.kind === "collections" || route.kind === "playlists"
            ? {
                Recursive: true,
                IncludeItemTypes:
                  route.kind === "collections" ? "BoxSet" : "Playlist",
                StartIndex: page * 30,
              }
            : route.kind === "search"
              ? {
                  ...libraryQuery(
                    undefined,
                    browseFilters,
                    sort,
                    filter,
                    sortOrder,
                  ),
                  SearchTerm: route.query,
                  Recursive: true,
                  IncludeItemTypes:
                    browseFilters.type || "Movie,Series,Episode",
                  StartIndex: page * pageSize,
                  Limit: pageSize,
                }
              : {
                  ...libraryQuery(
                    route.kind === "library" ? route.item : undefined,
                    browseFilters,
                    sort,
                    filter,
                    sortOrder,
                  ),
                  StartIndex: page * pageSize,
                  Limit: pageSize,
                };
        const list =
          browseFilters.resolution &&
          (route.kind === "library" || route.kind === "catalog")
            ? await resolutionIndex.current.page(
                api,
                query,
                browseFilters.resolution,
                page,
                signal,
                pageSize,
              )
            : route.kind === "favorites"
              ? await api.favorites(page, signal)
              : await api.items(query, signal);
        if (active) {
          updatePage(list);
        }
      }
    }
    function reportError(e: Error) {
      if (!active || e.name === "AbortError") return;
      if (e instanceof ApiError && e.status === 401) {
        queue.cancelAuto();
        void queue
          .stop()
          .then(() => {
            if (account) removeConnection(account);
            setConnections(
              readConnections().filter(
                (c) =>
                  !account || connectionId(c.account) !== connectionId(account),
              ),
            );
            clearAccount();
            setAddingServer(false);
            setAccount(null);
            setTheater(false);
            setPlayedItem(null);
            playbackOrigin.current = null;
            searchOrigin.current = null;
            pageCache.current.clear();
          })
          .catch((error) => setError(String(error)));
      }
      setError(e.message || "加载失败，请重试。");
    }
    load()
      .catch(reportError)
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    client,
    demo,
    route,
    page,
    reload,
    sort,
    sortOrder,
    pageSize,
    filter,
    browseFilters,
    allServers,
    route.kind === "later" ? later : null,
  ]);
  async function logout() {
    if (busy) return;
    queue.cancelAuto();
    try {
      await queue.stop();
    } catch (e) {
      setError(String(e));
      return;
    }
    if (client) {
      setBusy(true);
      setError("");
      try {
        await client.logout();
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) {
          setError((e as Error).message + " 退出未完成，请重试。");
          setBusy(false);
          return;
        }
      }
    }
    clearAccount();
    if (account) removeConnection(account);
    setConnections(readConnections());
    setAccount(null);
    setTheater(false);
    setPlayedItem(null);
    setDemo(false);
    history.current = [];
    pageCache.current.clear();
    playbackOrigin.current = null;
    searchOrigin.current = null;
    pendingScroll.current = null;
    setPlayerActive(false);
    setPlayedSource("");
    setShowQueue(false);
    setSearchInput("");
    setRoute({ kind: "home" });
    setBusy(false);
  }
  const updateNotice = (
    <AutomaticUpdateNotice
      onPrepareInstall={exitPlayback}
      blocked={
        playerActive ||
        !!playedItem ||
        theater ||
        playerFullscreen ||
        stoppingPlayer ||
        queueState.busy ||
        !!toast ||
        showSettings ||
        showRoutes ||
        addingServer ||
        !!recovery
      }
    />
  );
  if (!account && !demo)
    return (
      <>
        <Login
          initialError={error}
          onLogin={(a, remember) => {
            saveAccount(a, remember);
            setAccount(a);
            setConnections(readConnections());
            setWatched(readHistory(a));
            setError("");
          }}
          onDemo={() => {
            setDemo(true);
            setError("");
          }}
        />
        {updateNotice}
      </>
    );
  const grid = (list: Item[], landscape = false) => (
    <div
      className={
        listMode && route.kind !== "detail"
          ? "grid media-list"
          : landscape
            ? "grid continue-grid"
            : "grid"
      }
    >
      {list.map((item) => {
        const Card =
          listMode && route.kind !== "detail"
            ? MediaListRow
            : landscape
              ? ContinueWatchingCard
              : MediaCard;
        return (
          <Card
            key={item.Id}
            item={item}
            api={client}
            landscape={landscape}
            saved={later.some((i) => i.Id === item.Id)}
            onLater={changeLater}
            onUserData={updateUserData}
            playable={!(route.kind === "detail" && item.Id === detail?.Id)}
            onDetail={(selected) =>
              go(
                selected.Type === "Folder" ||
                  selected.Type === "CollectionFolder"
                  ? { kind: "library", item: selected }
                  : { kind: "detail", item: selected },
              )
            }
            onPlay={async (selected, fromStart, sourceId, signal) => {
              if (queue.state.busy)
                return queue.play(selected, fromStart, sourceId, signal);
              let override: { itemId: string; position: number } | null = null;
              if (
                route.kind === "history" &&
                !fromStart &&
                (item.UserData?.PlaybackPositionTicks || 0) > 0
              )
                resumeOverride.current = override = {
                  itemId: selected.Id,
                  position: item.UserData!.PlaybackPositionTicks! / 10000000,
                };
              try {
                await queue.play(selected, fromStart, sourceId, signal);
              } finally {
                if (override && resumeOverride.current === override)
                  resumeOverride.current = null;
              }
            }}
          >
            {route.kind === "history" && account && (
              <button
                className="history-remove"
                aria-label={`删除观看记录 ${item.Name}`}
                title="删除这条观看记录"
                onClick={() => {
                  const entries = removeHistory(account, item.Id);
                  setWatched(entries);
                  setItems(entries.map((e) => e.item));
                  setTotal(entries.length);
                }}
              >
                <X size={13} />
                删除记录
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
  const title = theater
    ? playedItem?.Name || "播放"
    : route.kind === "home"
      ? "首页"
      : route.kind === "later"
        ? "待看清单"
        : route.kind === "collections"
          ? "合集"
          : route.kind === "playlists"
            ? "播放列表"
            : route.kind === "history"
              ? "观看记录"
              : route.kind === "favorites"
                ? "我的收藏"
                : route.kind === "library"
                  ? route.item.Name
                  : route.kind === "search"
                    ? `“${route.query}”的搜索结果`
                    : route.kind === "catalog"
                      ? browseFilters.type === "Movie"
                        ? "全部电影"
                        : browseFilters.type === "Series"
                          ? "全部剧集"
                          : "全部影片"
                      : detail?.Name || route.item.Name;
  const previousLibrary = [...history.current]
    .reverse()
    .find((entry) => entry.route.kind === "library")?.route;
  const activeLibrary =
    route.kind === "library"
      ? route.item
      : route.kind === "detail" && previousLibrary?.kind === "library"
        ? previousLibrary.item
        : null;
  return (
    <div
      className={`${playerActive ? "shell has-player" : "shell"}${theater ? " theater-shell" : ""}${playerFullscreen && theater ? " fullscreen-player" : ""}`}
    >
      <Sidebar navigation={route}>
        <button
          className="brand"
          aria-label="返回首页"
          onClick={() => navigateSidebar({ kind: "home" })}
        >
          <AppIcon /> miry
        </button>
        <div className="server-switcher">
          <Select
            aria-label="当前服务器"
            title={account?.server}
            disabled={switching || demo}
            value={
              account
                ? String(
                    connections.findIndex(
                      (c) => connectionId(c.account) === connectionId(account),
                    ),
                  )
                : ""
            }
            onChange={(e) => {
              const c = connections[Number(e.target.value)];
              if (c) void switchConnection(c).catch(() => {});
            }}
          >
            {demo && <option value="">演示模式</option>}
            {connections.map((c, index) => (
              <option value={index} key={connectionId(c.account)}>
                {connectionLabel(c.account)}
              </option>
            ))}
          </Select>
          <button
            aria-label="添加服务器"
            title="添加服务器"
            onClick={() => setAddingServer(true)}
          >
            <Plus size={18} />
          </button>
        </div>
        <nav className="sidebar-scroll" aria-label="主要导航">
          <button
            className={route.kind === "home" ? "nav active" : "nav"}
            aria-current={route.kind === "home" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "home" })}
          >
            <Home size={19} /> <span>首页</span>
          </button>
          <button
            className={route.kind === "favorites" ? "nav active" : "nav"}
            aria-current={route.kind === "favorites" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "favorites" })}
          >
            <Heart size={19} /> <span>收藏</span>
          </button>
          <button
            className="nav"
            disabled={!playedItem}
            onClick={() => setTheater(true)}
          >
            <Play size={19} /> <span>播放页面</span>
          </button>
          {availableRoutes.length > 1 && (
            <button className="nav" onClick={() => setShowRoutes(true)}>
              <Network size={19} /> <span>连接线路</span>
            </button>
          )}
          <div className="nav-label">我的媒体库</div>
          <button
            className={`nav sidebar-media-group-start${route.kind === "history" ? " active" : ""}`}
            aria-current={route.kind === "history" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "history" })}
          >
            <History size={19} /> <span>观看记录</span>
          </button>
          <button
            className={route.kind === "later" ? "nav active" : "nav"}
            aria-current={route.kind === "later" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "later" })}
          >
            <Bookmark size={19} /> <span>待看清单</span>{" "}
            {later.length > 0 && <small>{later.length}</small>}
          </button>
          <button
            className={route.kind === "collections" ? "nav active" : "nav"}
            aria-current={route.kind === "collections" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "collections" })}
          >
            <Layers size={19} /> <span>合集</span>
          </button>
          <button
            className={route.kind === "playlists" ? "nav active" : "nav"}
            aria-current={route.kind === "playlists" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "playlists" })}
          >
            <ListVideo size={19} /> <span>播放列表</span>
          </button>
          <div className="library-nav-heading">
            <span>媒体库</span>
            <button
              aria-label="整理媒体库"
              title="整理媒体库"
              onClick={() => {
                setSettingsSection("libraries");
                setShowSettings(true);
              }}
            >
              <SettingsIcon size={15} />
            </button>
          </div>
          <SidebarLibraries
            libraries={displayedViews}
            activeId={activeLibrary?.Id}
            onNavigate={(view) =>
              navigateSidebar({ kind: "library", item: view })
            }
          />
        </nav>
        <button
          className="nav settings-nav"
          onClick={() => {
            setSettingsSection("playback");
            setShowSettings(true);
          }}
        >
          <SettingsIcon size={19} /> <span>设置</span>
        </button>
        <div className="account">
          <div
            className="avatar"
            tabIndex={0}
            data-tooltip={account ? connectionLabel(account) : "演示模式"}
          >
            {(account?.name || "演")[0]}
          </div>
          <div>
            <strong title={account ? connectionLabel(account) : undefined}>
              {account ? connectionLabel(account) : "演示模式"}
            </strong>
            <small title={account?.server}>
              {demo ? "演示模式" : new URL(account!.server).hostname}
            </small>
          </div>
          <button
            title="退出登录"
            aria-label="退出登录"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </Sidebar>
      <main ref={mainPanel} className={`browse-main route-${route.kind}`}>
        <header className="topbar" aria-label="页面导航与搜索">
          <div className="page-navigation">
            {theater && (
              <button
                aria-label="退出播放"
                disabled={stoppingPlayer}
                onClick={() => void exitPlayback().catch(() => {})}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {route.kind !== "home" && (
              <button className="icon" aria-label="返回上一页" onClick={back}>
                <ArrowLeft size={18} />
              </button>
            )}
            <button
              className="nav-home"
              aria-label="回到首页"
              onClick={() => go({ kind: "home" })}
            >
              <Home size={17} />
            </button>
            {route.kind !== "home" && <ChevronRight size={14} />}
            {route.kind === "detail" && activeLibrary && (
              <>
                <button
                  className="parent-library"
                  aria-label={`返回媒体库 ${activeLibrary.Name}`}
                  onClick={() => go({ kind: "library", item: activeLibrary })}
                >
                  {activeLibrary.Name}
                </button>
                <ChevronRight size={14} />
              </>
            )}
            <strong>{title}</strong>
          </div>
          <SearchBar
            key={scope}
            scope={scope}
            value={searchInput}
            onChange={setSearchInput}
            disabled={
              switching ||
              showSettings ||
              showRoutes ||
              addingServer ||
              showQueue ||
              theater
            }
            onSearch={(query) => {
              if (route.kind !== "search")
                searchOrigin.current = capturePage.current();
              go({ kind: "search", query });
            }}
            onClear={() => {
              if (route.kind !== "search") return;
              const previous = searchOrigin.current;
              searchOrigin.current = null;
              if (previous) restorePage({ ...previous, searchInput: "" });
              else go({ kind: "home" });
            }}
          />
          <label className="search-scope">
            <input
              type="checkbox"
              checked={allServers}
              onChange={(e) => {
                setAllServers(e.target.checked);
                setPage(0);
              }}
            />
            全部服务器
          </label>
          <button
            className="icon"
            aria-label="刷新"
            onClick={() => {
              client?.cache.clear();
              setReload((r) => r + 1);
            }}
          >
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </header>
        <div className="content">
          {error && (
            <ErrorState
              message={privateText(error)}
              onRetry={() => setReload((r) => r + 1)}
            />
          )}
          {route.kind === "detail" && detail ? (
            <MediaDetail
              key={detail.Id}
              item={detail}
              api={client}
              saved={later.some((i) => i.Id === detail.Id)}
              onPlay={(item, fromStart, sourceId, signal) =>
                queue.play(item, fromStart, sourceId, signal)
              }
              onLater={() => changeLater(detail)}
              onChange={(data) => updateUserData(detail, data)}
              onPerson={(item) => go({ kind: "person", item })}
              onCollection={
                ["BoxSet", "Playlist"].includes(detail.Type) &&
                items.some((i) => ["Movie", "Episode"].includes(i.Type))
                  ? () => {
                      void queue
                        .playCollection(items)
                        .catch(() => setShowQueue(true));
                    }
                  : undefined
              }
            />
          ) : route.kind === "person" ? (
            <>
              <PersonDetail
                key={route.item.Id}
                item={detail || route.item}
                api={client}
              />
              <div className="person-works-heading">
                <h2>
                  相关作品{" "}
                  <small>
                    {busy ? "加载中" : `${totalKnown ? "" : "至少 "}${total}`}
                  </small>
                </h2>
                <div
                  className="person-work-filters"
                  role="group"
                  aria-label="人物作品筛选"
                >
                  {(
                    [
                      { name: "全部", type: undefined },
                      { name: "电影", type: "Movie" },
                      { name: "剧集", type: "Series" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.name}
                      aria-pressed={route.mediaType === tab.type}
                      onClick={() => {
                        setRoute({ ...route, mediaType: tab.type });
                        setPage(0);
                      }}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            route.kind !== "home" && (
              <PageHeader
                title={title}
                count={
                  busy
                    ? "加载中"
                    : `${totalKnown ? "" : "至少 "}${total} 个内容`
                }
                actions={
                  <ViewToggle
                    list={listMode}
                    onChange={(list) => {
                      setListMode(list);
                      localStorage.setItem(
                        "miry-layout",
                        list ? "list" : "grid",
                      );
                    }}
                  />
                }
              />
            )
          )}
          {route.kind === "later" && later.length > 0 && (
            <div className="history-toolbar">
              <button
                className="secondary compact"
                onClick={() => {
                  clearLater(account);
                  setLater([]);
                }}
              >
                清空待看清单
              </button>
            </div>
          )}
          {route.kind === "history" && watched.length > 0 && (
            <div className="history-toolbar">
              <button
                className="secondary compact"
                onClick={() => {
                  if (account) clearHistory(account);
                  setWatched([]);
                  setItems([]);
                  setTotal(0);
                }}
              >
                清空观看记录
              </button>
            </div>
          )}
          {route.kind === "person" && (
            <ViewToggle
              list={listMode}
              onChange={(list) => {
                setListMode(list);
                localStorage.setItem("miry-layout", list ? "list" : "grid");
              }}
            />
          )}
          {queryControls && (
            <div className="library-controls">
              <div className="library-sort-control">
                <label>
                  排序
                  <Select
                    aria-label="媒体排序"
                    value={sort}
                    onChange={(e) => {
                      changeSort(
                        e.target.value,
                        defaultSortOrder(e.target.value),
                      );
                    }}
                  >
                    {librarySorts.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <Tooltip
                  text={
                    sortOrder === "Ascending"
                      ? browseCopy.ascendingHint
                      : browseCopy.descendingHint
                  }
                >
                  <button
                    type="button"
                    className="icon sort-direction"
                    aria-label={
                      sortOrder === "Ascending"
                        ? browseCopy.ascending
                        : browseCopy.descending
                    }
                    aria-pressed={sortOrder === "Descending"}
                    onClick={() => {
                      changeSort(
                        sort,
                        sortOrder === "Ascending" ? "Descending" : "Ascending",
                      );
                    }}
                  >
                    {sortOrder === "Ascending" ? (
                      <ArrowUp size={18} aria-hidden="true" />
                    ) : (
                      <ArrowDown size={18} aria-hidden="true" />
                    )}
                  </button>
                </Tooltip>
              </div>
              <label>
                观看状态
                <Select
                  aria-label="观看状态"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">全部</option>
                  <option value="unplayed">未看</option>
                  <option value="played">已看</option>
                </Select>
              </label>
              <LibraryFilters
                showResolution={browsing}
                value={browseFilters}
                genres={genres}
                resetActive={filter !== "all"}
                onReset={() => {
                  setBrowseFilters(emptyFilters);
                  setFilter("all");
                  setPage(0);
                }}
                onChange={(value) => {
                  setBrowseFilters(value);
                  setPage(0);
                }}
              />
            </div>
          )}
          {route.kind === "search" && (
            <p className="search-sort-hint">{browseCopy.searchSortHint}</p>
          )}
          {browsing && !error && (
            <LibraryPagination
              label="影片翻页"
              page={page}
              pageSize={pageSize}
              count={items.length}
              total={total}
              totalKnown={totalKnown}
              hasMore={hasMore}
              onChange={changePage}
              loading={busy}
              contextKey={paginationContext}
            />
          )}
          {busy ? (
            <Skeleton variant={route.kind === "home" ? "home" : "grid"} />
          ) : (
            <>
              {route.kind === "home" && !error && (
                <HomeView
                  recommendations={demo ? undefined : recommendations}
                  onRecommendation={(entry) => {
                    if (
                      account &&
                      connectionId(account) ===
                        connectionId(entry.connection.account)
                    )
                      go({ kind: "detail", item: entry.item });
                    else
                      void switchConnection(entry.connection, {
                        kind: "detail",
                        item: entry.item,
                      }).catch(() => {});
                  }}
                  items={items}
                  views={displayedViews}
                  resume={resume}
                  nextUp={nextUp}
                  api={client}
                  later={later}
                  onPlay={(item, fromStart, sourceId, signal) =>
                    queue.play(item, fromStart, sourceId, signal)
                  }
                  onDetail={(item) => go({ kind: "detail", item })}
                  onLater={changeLater}
                  onUserData={updateUserData}
                  onCatalog={(mediaType, recent) =>
                    go({ kind: "catalog", mediaType, recent })
                  }
                  onLibrary={(item) => go({ kind: "library", item })}
                />
              )}
              {route.kind === "detail" &&
                detail &&
                ["Series", "Season"].includes(detail.Type) && (
                  <EpisodeBrowser
                    key={detail.Id}
                    api={client}
                    parent={detail}
                    currentId={playerActive ? playedItem?.Id : undefined}
                    initialSeasonId={selectedSeasons.current.get(
                      `${account ? connectionId(account) : "demo"}:${detail.Id}`,
                    )}
                    initialPage={
                      episodePages.current.get(
                        `${scope}:${detail.Id}:${selectedSeasons.current.get(`${account ? connectionId(account) : "demo"}:${detail.Id}`) || items[0]?.Id || detail.Id}`,
                      ) || 0
                    }
                    onPageChange={(season, page) => {
                      const key = `${scope}:${detail.Id}:${season}`;
                      episodePages.current.delete(key);
                      episodePages.current.set(key, page);
                      if (episodePages.current.size > 100)
                        episodePages.current.delete(
                          episodePages.current.keys().next().value!,
                        );
                    }}
                    progressItems={watched
                      .filter((entry) => Date.now() - entry.at < 60000)
                      .map((entry) => entry.item)}
                    onSeasonChange={(id) => {
                      const key = `${account ? connectionId(account) : "demo"}:${detail.Id}`;
                      selectedSeasons.current.delete(key);
                      selectedSeasons.current.set(key, id);
                      episodePages.current.set(
                        `${scope}:${detail.Id}:${id}`,
                        0,
                      );
                      if (selectedSeasons.current.size > 100)
                        selectedSeasons.current.delete(
                          selectedSeasons.current.keys().next().value!,
                        );
                    }}
                    seasons={
                      detail.Type === "Series"
                        ? items.filter((i) => i.Type === "Season")
                        : []
                    }
                    onPlay={(item, fromStart, sourceId, signal) =>
                      queue.play(item, fromStart, sourceId, signal)
                    }
                    onDetail={(item) => go({ kind: "detail", item })}
                  />
                )}
              {(route.kind === "search" || route.kind === "favorites") &&
                allServers &&
                !demo &&
                searchGroups.map((group) => (
                  <section
                    key={connectionId(group.connection.account)}
                    className="search-group"
                  >
                    <div className="section-heading">
                      <h2>{connectionLabel(group.connection.account)}</h2>
                      <small>
                        {group.totalKnown ? "" : "至少 "}
                        {group.total}{" "}
                        {route.kind === "favorites" ? "个收藏" : "个结果"}
                      </small>
                    </div>
                    {group.error ? (
                      <ErrorState
                        title={
                          route.kind === "favorites"
                            ? "此服务器收藏加载失败"
                            : "此服务器搜索失败"
                        }
                        message={privateText(group.error)}
                      />
                    ) : group.items.length ? (
                      <div className={listMode ? "grid media-list" : "grid"}>
                        {group.items.map((item) => {
                          const Card = listMode ? MediaListRow : MediaCard;
                          return (
                            <Card
                              key={item.Id}
                              item={item}
                              api={new EmbyClient(group.connection.account)}
                              playable={false}
                              onUserData={(selected, data) => {
                                if (
                                  account &&
                                  favoriteScope(account) ===
                                    favoriteScope(group.connection.account)
                                )
                                  updateUserData(
                                    selected,
                                    data,
                                    group.connection.account,
                                  );
                              }}
                              onDetail={() => {
                                if (
                                  account &&
                                  connectionId(account) ===
                                    connectionId(group.connection.account)
                                )
                                  go({ kind: "detail", item });
                                else
                                  void switchConnection(group.connection, {
                                    kind: "detail",
                                    item,
                                  }).catch(() => {});
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState
                        title={
                          route.kind === "favorites"
                            ? "还没有收藏"
                            : "没有搜索结果"
                        }
                        description={
                          route.kind === "favorites"
                            ? "收藏喜欢的电影和剧集后，它们会出现在这里。"
                            : "试试其他关键词。"
                        }
                      />
                    )}
                  </section>
                ))}
              {!(
                (route.kind === "search" || route.kind === "favorites") &&
                allServers &&
                !demo
              ) &&
                route.kind !== "home" &&
                !error &&
                (route.kind !== "detail" ||
                  ((items.length > 0 ||
                    ["BoxSet", "Playlist"].includes(detail?.Type || "")) &&
                    !["Series", "Season"].includes(detail?.Type || ""))) && (
                  <section>
                    {items.length ? (
                      grid(items, route.kind === "history")
                    ) : (
                      <EmptyState
                        title={
                          route.kind === "favorites"
                            ? "还没有收藏"
                            : route.kind === "later"
                              ? "待看清单为空"
                              : route.kind === "history"
                                ? "还没有观看记录"
                                : route.kind === "search"
                                  ? "没有搜索结果"
                                  : route.kind === "collections"
                                    ? "还没有合集"
                                    : route.kind === "playlists"
                                      ? "还没有播放列表"
                                      : detail?.Type === "BoxSet"
                                        ? "此合集没有内容"
                                        : detail?.Type === "Playlist"
                                          ? "此播放列表没有内容"
                                          : "这里还没有内容"
                        }
                        description={
                          route.kind === "favorites"
                            ? "在海报或详情页点击收藏，喜欢的内容会出现在这里。"
                            : route.kind === "later"
                              ? "将想看的电影或剧集加入待看，方便下次找到。"
                              : route.kind === "history"
                                ? "开始播放后，本机观看记录会显示在这里。"
                                : route.kind === "search"
                                  ? "试试其他关键词。"
                                  : route.kind === "person"
                                    ? "服务器暂未提供这位演职员的作品。"
                                    : "请选择其他媒体库，或稍后刷新。"
                        }
                      />
                    )}
                  </section>
                )}
              {route.kind === "detail" && related.length > 0 && (
                <section className="related">
                  <div className="section-heading">
                    <h2>相似影片</h2>
                  </div>
                  {grid(related)}
                </section>
              )}
            </>
          )}
          {(browsing || route.kind === "search" || !busy) &&
            route.kind !== "home" &&
            !error &&
            route.kind !== "history" &&
            route.kind !== "later" &&
            detail?.Type !== "Season" &&
            (queryControls || page > 0 || hasMore) &&
            (queryControls ? (
              <LibraryPagination
                label="列表底部翻页"
                page={page}
                pageSize={pageSize}
                onPageSizeChange={changePageSize}
                showRange={route.kind !== "search" || !allServers}
                count={items.length}
                total={total}
                totalKnown={totalKnown}
                hasMore={hasMore}
                onChange={changePage}
                loading={busy}
                contextKey={paginationContext}
              />
            ) : (
              <Pagination
                page={page}
                pages={totalKnown ? Math.ceil(total / pageSize) : undefined}
                busy={busy}
                hasMore={hasMore}
                onChange={changePage}
                contextKey={paginationContext}
              />
            ))}
          {playedItem &&
            (!account ||
              !playerOwner ||
              playerOwner === connectionId(account)) && (
              <PlayerPanel
                settings={settings}
                routeHint={routeHint}
                onRouteDismiss={(session) => {
                  if (session) suppressRouteWarnings();
                  if (account && lastSnapshot.current && routeHint)
                    ignoredRouteHint.current = `${account.server}:${lastSnapshot.current.playSessionId}:${routeHint.reason}`;
                  setRouteHint(undefined);
                }}
                onRouteProbe={async (index, media) => {
                  if (!account) return;
                  const route = activeRoutes(account)[index];
                  if (route)
                    await testRoute(
                      account,
                      route,
                      new AbortController().signal,
                      media && playedItem
                        ? { item: playedItem, sourceId: playedSource }
                        : undefined,
                    );
                }}
                dock
                theater={theater}
                item={playedItem || undefined}
                api={client}
                sourceId={playedSource}
                onSourceChange={restartCurrent}
                onRestart={() => restartCurrent()}
                onTheater={() => setTheater(true)}
                onReturn={exitPlayback}
                onFullscreenChange={(fullscreen) => {
                  setPlayerFullscreen(fullscreen);
                  if (fullscreen) setTheater(true);
                }}
                routes={
                  account
                    ? availableRoutes.map((r, index) => ({
                        name: routeLabel(r.name, index),
                        selected: r.url === account.server,
                        quality: routeQuality?.tests[r.url]
                          ? routeQuality.recommended === r.url
                            ? "推荐"
                            : routeQuality.tests[r.url].label
                          : undefined,
                        detail: routeQuality?.tests[r.url]
                          ? routeDetail(routeQuality.tests[r.url])
                          : undefined,
                      }))
                    : []
                }
                onRouteSelect={async (index) => {
                  if (!account) return;
                  const route = activeRoutes(account)[index];
                  if (route)
                    await switchLine(route, new AbortController().signal);
                }}
                queuePresentation={{
                  items: queueState.items,
                  index: queueState.index,
                  busy: queueState.busy,
                  autoNext: settings.autoNext,
                  error: queueState.error || queueState.warning,
                }}
                onQueueSelect={(index) => queue.select(index)}
                onQueueRemove={(index) => queue.remove(index)}
                onAutoChange={(autoNext) =>
                  updateSettings({ ...settings, autoNext })
                }
                overlayOpen={
                  showRoutes ||
                  showSettings ||
                  showQueue ||
                  addingServer ||
                  !!recovery
                }
                introSeconds={settings.introSeconds}
                outroSeconds={settings.outroSeconds}
                revision={playerRevision}
                onStopped={() => {
                  client?.cache.clear();
                }}
                onSnapshot={receiveSnapshot}
                onStop={exitPlayback}
                onPrevious={() =>
                  queue.select(Math.max(0, queueState.index - 1))
                }
                onNext={() => queue.next(true)}
                previousDisabled={queueState.index === 0 || queueState.busy}
                nextDisabled={
                  !queueState.items.length ||
                  queueState.busy ||
                  (queueState.index + 1 >= queueState.items.length &&
                    queueState.items[queueState.index]?.Type !== "Episode")
                }
              />
            )}
          {showQueue && (
            <div className="queue-drawer">
              <button
                className="queue-close"
                aria-label="关闭队列"
                onClick={() => setShowQueue(false)}
              >
                <X size={18} />
              </button>
              <QueuePanel
                queue={queue}
                state={queueState}
                autoNext={settings.autoNext}
                onAutoChange={(autoNext) =>
                  updateSettings({ ...settings, autoNext })
                }
              />
            </div>
          )}
        </div>
      </main>
      {recovery && account?.serverId === recovery.serverId && !theater && (
        <RecoveryDialog
          record={recovery}
          busy={recoveryBusy}
          error={recoveryError}
          onIgnore={() => {
            void invoke("recovery_clear")
              .then(() => setRecovery(undefined))
              .catch(() => setRecoveryError("无法清除中断记录，请重试。"));
          }}
          onContinue={() => {
            if (!client || recoveryBusy) return;
            setRecoveryBusy(true);
            setRecoveryError("");
            const entry = recovery;
            void (async () => {
              const item = await client.item(entry.itemId);
              resumeOverride.current = {
                itemId: entry.itemId,
                position: entry.position,
              };
              recoveryOverride.current = entry;
              await queue.play(item, false, entry.sourceId || undefined);
              if (queue.state.error) throw Error(queue.state.error);
            })()
              .catch((e) => setRecoveryError(privateError(e)))
              .finally(() => {
                resumeOverride.current = null;
                recoveryOverride.current = undefined;
                setRecoveryBusy(false);
              });
          }}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onEndpoints={() => {
            setShowSettings(false);
            setShowRoutes(true);
          }}
          snapshot={lastSnapshot.current || undefined}
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
          api={client}
          initialSection={settingsSection}
          views={views}
          libraries={libraryPreferences}
          onLibrariesChange={updateLibraries}
        />
      )}
      {showRoutes && account && (
        <RoutePanel
          account={account}
          media={
            playedItem
              ? { item: playedItem, sourceId: playedSource }
              : undefined
          }
          onClose={() => setShowRoutes(false)}
          onSwitch={switchLine}
        />
      )}
      {updateNotice}
      {toast && (
        <Toast
          key={toast}
          message={toast}
          tone={toastTone}
          onDismiss={dismissToast}
        />
      )}
      {addingServer && (
        <div
          className="modal-backdrop server-login"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeServerDialog();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="添加服务器"
        >
          <div className="server-login-card" ref={addServerPanel}>
            <button
              className="server-login-close"
              aria-label="取消添加服务器"
              onClick={closeServerDialog}
            >
              <X size={20} />
            </button>
            <Login
              allowDemo={false}
              initialError=""
              onLogin={(a, remember) =>
                switchConnection({ account: a, remember })
              }
              onDemo={closeServerDialog}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function remarkHint(server: string, username: string) {
  try {
    return connectionRemarkHint(normalizeServer(server), username);
  } catch {
    return "";
  }
}

function Login({
  onLogin,
  onDemo,
  initialError,
  allowDemo = true,
}: {
  onLogin: (account: Account, remember: boolean) => void | Promise<void>;
  onDemo: () => void;
  initialError: string;
  allowDemo?: boolean;
}) {
  const [server, setServer] = useState(
      localStorage.getItem("miry-server") || "",
    ),
    [username, setUsername] = useState(() =>
      readLoginHint(localStorage.getItem("miry-server") || ""),
    ),
    [password, setPassword] = useState(""),
    [remark, setRemark] = useState(() => remarkHint(server, username)),
    [remember, setRemember] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  const pending = useRef<AbortController | null>(null);
  const [connectStage, setConnectStage] = useState<"probe" | "login">("probe");
  const [diagnosticFeedback, setDiagnosticFeedback] = useState("");
  const remarkChanged = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  async function reconnect(connection: Connection) {
    setBusy(true);
    setError("");
    try {
      await onLogin(
        remarkChanged.current
          ? { ...connection.account, remark: remark.trim() }
          : connection.account,
        connection.remember,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDiagnosticFeedback("");
    setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    setConnectStage("probe");
    let stage: "probe" | "login" = "probe";
    try {
      const client = new EmbyClient({
        server: normalizeServer(server),
        userId: "",
        token: "",
        name: "",
        deviceId: getDeviceId(),
      });
      const info = await client.serverInfo(controller.signal);
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      setConnectStage("login");
      stage = "login";
      const account = {
        ...(await client.login(username.trim(), password, controller.signal)),
        serverId: info.Id,
      };
      await onLogin(
        remarkChanged.current
          ? { ...account, remark: remark.trim() }
          : withConnectionRemark(account),
        remember,
      );
      localStorage.setItem("miry-server", server.trim());
      saveLoginHint(account.server, account.name);
      setPassword("");
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "已取消连接。"
          : `${stage === "probe" ? "服务器探测失败" : "登录失败"}：${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
      pending.current = null;
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="brand">
          <AppIcon /> miry
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <h2>连接你的媒体库</h2>
          {readConnections().length > 0 && (
            <div className="saved-connections">
              {readConnections().map((c) => (
                <button
                  type="button"
                  disabled={busy}
                  key={connectionId(c.account)}
                  onClick={() => void reconnect(c)}
                >
                  连接 {connectionLabel(c.account)}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {privateText(error)}
              <button
                type="button"
                className="secondary compact"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      JSON.stringify(readNetworkDiagnostics(), null, 2),
                    );
                    setDiagnosticFeedback(
                      "匿名诊断已复制，未包含地址、密码或令牌。",
                    );
                  } catch {
                    setDiagnosticFeedback("诊断复制失败，请检查剪贴板权限。");
                  }
                }}
              >
                复制匿名诊断
              </button>
              {diagnosticFeedback && (
                <small role="status">{diagnosticFeedback}</small>
              )}
            </div>
          )}
          <label>
            服务器地址
            <input
              required
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="粘贴服务器地址"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              onBlur={() => {
                const name = readLoginHint(server);
                if (name) setUsername(name);
                if (!remarkChanged.current)
                  setRemark(remarkHint(server, name || username));
              }}
              disabled={busy}
            />
          </label>
          <label>
            备注（可选）
            <input
              aria-label="服务器备注"
              type="text"
              autoComplete="off"
              maxLength={60}
              placeholder="例如：家里的媒体库"
              value={remark}
              onChange={(e) => {
                remarkChanged.current = true;
                setRemark(e.target.value);
              }}
              disabled={busy}
            />
          </label>
          <label>
            用户名
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => {
                if (!remarkChanged.current)
                  setRemark(remarkHint(server, username));
              }}
              disabled={busy}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />
            记住登录（仅在自己的电脑上使用）
          </label>
          <button className="primary" disabled={busy}>
            {busy
              ? connectStage === "probe"
                ? "正在探测服务器…"
                : "服务器已连接，正在登录…"
              : "连接服务器"}{" "}
            <ArrowRight size={17} />
          </button>
          {busy && (
            <button
              type="button"
              className="cancel"
              onClick={() => pending.current?.abort()}
            >
              <X size={16} />
              取消连接
            </button>
          )}
          {allowDemo && (
            <>
              <div className="divider">或者先体验</div>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={onDemo}
              >
                打开演示媒体库
              </button>
            </>
          )}
          <small className="privacy">
            密码不会保存。默认登录仅保留在当前会话中；勾选记住登录会在本机保存访问令牌。
          </small>
        </form>
      </section>
    </div>
  );
}
