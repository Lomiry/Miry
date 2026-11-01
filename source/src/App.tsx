import { displayError } from "./privacy";
import { t, formatNumber } from "./i18n/core";
import { useI18n } from "./i18n/react";
import ConnectionIntro from "./components/ConnectionIntro";
import SmartImport from "./components/SmartImport";
import CertificateOption from "./components/CertificateOption";
import ServerSwitcher from "./components/ServerSwitcher";
import { canFallback, findFallback } from "./player/routeFallback";
import useDialogFocus from "./components/useDialogFocus";
import Select from "./components/Select";
import Tooltip from "./components/Tooltip";
import {
  readPageSize,
  savePageSize,
  validPageSize,
  readSortPreference,
  saveSortPreference,
  readBrowseMode,
  saveBrowseMode,
  type BrowseMode,
} from "./stores/browsePreferences";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { rankSearchCandidates } from "./api/search";
import InfiniteLoad from "./components/InfiniteLoad";
import WindowedBrowse from "./components/WindowedBrowse";
import BrowseBoundary from "./components/BrowseBoundary";
import {
  readBrowseLocation,
  saveBrowseLocation,
} from "./stores/browseLocation";
import {
  Home,
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
  Network,
  Bookmark,
  Layers,
  ListVideo,
  Search,
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
import SearchOverview from "./components/SearchOverview";
import SearchCounts from "./components/SearchCounts";
import { searchPresentation } from "./api/searchPresentation";
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
import {
  readSettings,
  applySettingsUpdate,
  type SettingsUpdate,
} from "./stores/settings";
import { syncTrayBehavior } from "./stores/trayBehavior";
import Sidebar from "./components/Sidebar";
import SidebarLibraries from "./components/SidebarLibraries";
import { PlaybackQueue, type QueueState } from "./player/queue";
import { preparePlayback, continuationSettings } from "./player/playback";
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
  autoRouteVersion,
  setRouteMode,
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
  saveRoute,
  captureRoute,
  currentRoute,
  activeRoutes,
  routeDisplayName,
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
import { privateError } from "./privacy";
import { fetchPreviewImage } from "./player/preview";
import {
  withConnectionRemark,
  connectionRemarkHint,
} from "./stores/connectionRemarks";

// New browsing copy stays together for the future translation catalog.
const browseCopy = {
  get ascending() {
    return t("library.ascending_switch_to_descending");
  },
  get descending() {
    return t("library.descending_switch_to_ascending");
  },
  get ascendingHint() {
    return t("library.currently_ascending_switch_to_descending");
  },
  get descendingHint() {
    return t("library.currently_descending_switch_to_ascending");
  },
  get searchSortHint() {
    return t("library.search_sorting_depends_on_server_support_if");
  },
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
  searchMatches: Item[];
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
  browseMode: BrowseMode;
  filter: string;
  browseFilters: BrowseFilters;
  listMode: boolean;
  searchInput: string;
  allServers: boolean;
  scrollTop: number;
  dataKey: string;
}
export default function App() {
  const language = useI18n();

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
  const [account, updateAccount] = useState<Account | null>(readAccount);
  const [restoredBrowse] = useState(() => readBrowseLocation(account));
  const routeOperation = useRef<{
    controller: AbortController;
    valid: () => boolean;
    done: Promise<void>;
  } | null>(null);
  const accountOwner = useRef(account);
  function setAccount(next: Account | null) {
    // Change ownership synchronously, before React commits a replacement login.
    if (next !== accountOwner.current)
      routeOperation.current?.controller.abort();
    accountOwner.current = next;
    updateAccount(next);
  }
  const [sort, setSort] = useState(
      () => restoredBrowse?.sort || readSortPreference(account).sort,
    ),
    [filter, setFilter] = useState(restoredBrowse?.filter || "all");
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    () => restoredBrowse?.sortOrder || readSortPreference(account).sortOrder,
  );
  const [libraryPageSize, setLibraryPageSize] = useState(readPageSize);
  const [browseMode, setBrowseMode] = useState(
    () => restoredBrowse?.mode || readBrowseMode(),
  );
  const [searchMatches, setSearchMatches] = useState<Item[]>([]);
  const batchCursor = useRef({ context: "", page: -1, reload: -1 });
  const batchLock = useRef(false);
  const retryBatch = useRef<{ context: string; page: number } | null>(null);
  const [appending, setAppending] = useState(false);
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
    const update = () => {
      const pending = routeOperation.current;
      if (pending && !pending.valid()) pending.controller.abort();
      setRouteQualityRevision((n) => n + 1);
    };
    window.addEventListener("miry-route-quality", update);
    return () => {
      window.removeEventListener("miry-route-quality", update);
      routeOperation.current?.controller.abort();
    };
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
          ? t("library.added_to_watch_later")
          : t("library.removed_from_watch_later"),
      );
    } catch {
      setError(t("library.could_not_save_watch_later_check_your"));
    }
  };
  const [connections, setConnections] = useState(readConnections);
  const [addingServer, setAddingServer] = useState(false),
    [switching, setSwitching] = useState(false);
  const [allServers, setAllServers] = useState(false),
    [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(
      restoredBrowse?.filters || emptyFilters,
    ),
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
  const lastPersistedSnapshot = useRef("");
  const [demo, setDemo] = useState(false);
  const [route, setRoute] = useState<Route>(() =>
    restoredBrowse
      ? { kind: "library", item: restoredBrowse.item }
      : { kind: "home" },
  );
  useEffect(() => {
    if (account && route.kind === "library")
      saveBrowseLocation(account, {
        item: route.item,
        filters: browseFilters,
        sort,
        sortOrder,
        filter,
        mode: browseMode,
      });
    else if (route.kind !== "detail") saveBrowseLocation(account);
  }, [account, route, browseFilters, sort, sortOrder, filter, browseMode]);
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
  const infinite =
    browsing && browseMode === "infinite" && !browseFilters.resolution;
  const queryControls = browsing || route.kind === "search";
  const groupedResults =
    route.kind === "search" || (route.kind === "favorites" && allServers);
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
    browseMode,
  ]);
  const loadingPageContext = useRef("");
  const client = useMemo(
    () => (account ? new EmbyClient(account) : null),
    [
      account?.server,
      account?.userId,
      account?.token,
      account?.deviceId,
      account?.ignoreCertificateErrors,
    ],
  );
  const retryLoad = () => {
    if (infinite) {
      if (busy || batchLock.current || !error) return;
      batchLock.current = true;
      retryBatch.current = { context: paginationContext, page };
    }
    setReload((value) => value + 1);
  };
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
  const snapshotReceiver = useRef<(s: PlayerSnapshot) => boolean>(() => false);
  const capturePage = useRef<() => BrowseState>(() => {
    throw new Error(t("library.the_page_is_not_ready_yet"));
  });
  capturePage.current = () => {
    const dataKey = String(++pageSequence.current);
    if (!busy && !error)
      pageCache.current.set(
        dataKey,
        {
          items,
          searchMatches,
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
      browseMode,
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
    const saved = pageCache.current.get<PageData>(state.dataKey);
    const entries =
      state.route.kind === "history" ? readHistory(account) : null;
    const data =
      saved && entries
        ? {
            ...saved,
            items: entries.map((entry) => entry.item),
            total: entries.length,
          }
        : saved;
    if (entries) setWatched(entries);
    restoringPage.current = !!data;
    pendingScroll.current =
      !data && state.browseMode === "infinite" ? null : state.scrollTop;
    setRoute({ ...state.route });
    setPage(!data && state.browseMode === "infinite" ? 0 : state.page);
    setBrowseMode(state.browseMode);
    saveBrowseMode(state.browseMode);
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
      setSearchMatches(data.searchMatches.map(merge));
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
  const playbackHandoff = useRef<PlayerSnapshot | null>(null);
  const miniPresentation = useRef(false);
  const queue = useMemo(
    () =>
      new PlaybackQueue(
        {
          stop: async (preservePresentation = false) => {
            if (isTauri()) {
              const state = await invoke<PlayerSnapshot | undefined>(
                "player_stop",
                preservePresentation
                  ? { preservePresentation: true }
                  : undefined,
              );
              if (!preservePresentation) playbackHandoff.current = null;
              if (state) {
                if (preservePresentation && state.playSessionId)
                  playbackHandoff.current = state;
                snapshotReceiver.current(state);
              } else {
                const final = await invoke<PlayerSnapshot>("player_status");
                snapshotReceiver.current(final);
              }
            }
          },
          launch: async (item, fromStart, signal, sourceId, selection) => {
            if (!isTauri())
              throw new Error(t("library.open_the_desktop_app_to_play_media"));
            if (!client)
              throw new Error(t("library.sign_in_to_a_server_first"));
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
              continuationSettings(
                settingsRef.current,
                playbackHandoff.current,
              ),
              selection,
            );
            const handoff = playbackHandoff.current;
            launch.preservePresentation = !!handoff?.playSessionId;
            if (handoff) {
              launch.volume = handoff.volume;
              launch.muted = handoff.muted;
              launch.speed =
                handoff.speed && handoff.speed >= 0.5 && handoff.speed <= 3
                  ? handoff.speed
                  : 1;
            }
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
            if (!miniPresentation.current) setTheater(true);
            launched.current = {
              account: client.account,
              item: fresh,
              session: launch.playSessionId,
              updated: Date.now(),
            };
            lastPersistedSnapshot.current = "";
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
              throw new Error(
                t("library.the_server_did_not_return_the_series"),
              );
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
  const updateSettings = (update: SettingsUpdate) => {
    const next = applySettingsUpdate(update);
    setSettings(next);
  };
  useEffect(() => {
    const update = () => setSettings(readSettings());
    window.addEventListener("miry-settings-changed", update);
    return () => window.removeEventListener("miry-settings-changed", update);
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    void syncTrayBehavior(settings).catch(() => {});
  }, [settings.closeToTray, settings.minimizeToTray, language]);
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
      setToast(
        data.IsFavorite
          ? t("library.added_to_favorites")
          : t("library.removed_from_favorites"),
      );
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
    setSearchMatches((list) => list.map(merge));
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
            searchMatches: data.searchMatches.map(merge),
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
    routeOperation.current?.controller.abort();
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
  const routePlayback = useRef({ theater, playerActive });
  routePlayback.current = { theater, playerActive };
  function beginAutoRoute(owner: Account, parent?: AbortSignal) {
    routeOperation.current?.controller.abort();
    const controller = new AbortController(),
      abort = () => controller.abort();
    const version = autoRouteVersion(owner),
      session = launched.current;
    const playbackSession = lastSnapshot.current?.playSessionId;
    let finish!: () => void;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const pending = {
      controller,
      done,
      valid: () =>
        !controller.signal.aborted &&
        accountOwner.current === owner &&
        readRouteQuality(owner).mode === "auto" &&
        autoRouteVersion(owner) === version &&
        launched.current === session &&
        lastSnapshot.current?.playSessionId === playbackSession &&
        !routePlayback.current.theater &&
        !routePlayback.current.playerActive &&
        !queue.state.busy,
    };
    parent?.addEventListener("abort", abort, { once: true });
    if (parent?.aborted) abort();
    routeOperation.current = pending;
    return {
      ...pending,
      dispose: () => {
        parent?.removeEventListener("abort", abort);
        if (routeOperation.current === pending) routeOperation.current = null;
        finish();
      },
    };
  }
  async function switchLine(
    route: ServerRoute,
    signal: AbortSignal,
    selection: "manual" | "auto" | "fallback" = "manual",
    preverified?: Awaited<ReturnType<typeof verifyRoute>>,
    automatic?: ReturnType<typeof beginAutoRoute>,
  ) {
    if (!account || accountOwner.current !== account)
      throw new DOMException("Aborted", "AbortError");
    const lease = captureRoute(account, route);
    let manualIntent: string | undefined;
    if (account && selection === "manual") {
      const previous = routeOperation.current;
      previous?.controller.abort();
      setRouteMode(account, "manual", route.url);
      manualIntent = readRouteQuality(account).intent;
      // Let the existing native operation settle before the explicit choice.
      // This is cancellation/serialization, not a retry or a second route queue.
      if (previous) await previous.done;
      if (
        signal.aborted ||
        accountOwner.current !== account ||
        !currentRoute(account, lease)
      )
        throw new DOMException("Aborted", "AbortError");
    }
    if (!account || switchingLock.current)
      throw new Error(t("library.switching_connections_try_again_shortly"));
    switchingLock.current = true;
    setSwitching(true);
    const operation =
      selection === "manual"
        ? undefined
        : automatic || beginAutoRoute(account, signal);
    const requestSignal = operation?.controller.signal || signal;
    const assertCurrent = () => {
      const latest = readRouteQuality(account);
      if (
        signal.aborted ||
        requestSignal.aborted ||
        accountOwner.current !== account ||
        !currentRoute(account, lease) ||
        (selection === "manual" &&
          (latest.mode !== "manual" || latest.intent !== manualIntent)) ||
        (operation &&
          (!operation.valid() ||
            !activeRoutes(account).some((r) => r.url === route.url) ||
            (selection === "auto" &&
              readRouteQuality(account).recommended !== route.url)))
      ) {
        operation?.controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }
    };
    try {
      assertCurrent();
      const target = currentRoute(account, lease)!;
      const checked =
        preverified ||
        (await verifyRoute(
          account,
          target.url,
          requestSignal,
          target.ignoreCertificateErrors,
        ));
      assertCurrent();
      const snapshot = isTauri()
        ? await invoke<PlayerSnapshot>("player_status")
        : null;
      assertCurrent();
      if (operation && snapshot?.active) {
        operation.controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }
      const current =
        launched.current ||
        ((theater || miniPresentation.current) &&
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
      assertCurrent();
      await queue.stop(!!resume);
      assertCurrent();
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
        ignoreCertificateErrors: checked.ignoreCertificateErrors,
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
      operation?.dispose();
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
      return false;
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
              index >= 0 ? routeDisplayName(routes[index], index) : undefined,
          });
        }
      } else {
        setRouteHint(undefined);
        ignoredRouteHint.current = "";
      }
    }
    void queue.snapshot(snapshot);
    const current = launched.current;
    const persistenceKey =
      snapshot.playSessionId &&
      snapshot.itemId &&
      Number.isFinite(snapshot.position)
        ? JSON.stringify([
            snapshot.playSessionId,
            snapshot.itemId,
            snapshot.position,
            snapshot.active,
            snapshot.finished && !!snapshot.syncComplete,
          ])
        : "";
    let persisted =
      !snapshot.active &&
      !!persistenceKey &&
      lastPersistedSnapshot.current === persistenceKey;
    if (
      current &&
      snapshot.playSessionId === current.session &&
      snapshot.itemId === current.item.Id &&
      Number.isFinite(snapshot.position) &&
      (Date.now() - current.updated > 1000 || !snapshot.active)
    ) {
      try {
        let entries;
        if (!persisted) {
          entries = recordHistory(
            current.account,
            current.item,
            snapshot.position,
            snapshot.finished && !!snapshot.syncComplete,
            { requirePersistence: true },
          );
          lastPersistedSnapshot.current = persistenceKey;
          persisted = true;
        }
        entries ??= readHistory(current.account);
        if (account && connectionId(current.account) === connectionId(account))
          setWatched(entries);
        if (!snapshot.active)
          updateUserData(current.item, entries[0]?.item.UserData || {});
        current.updated = Date.now();
        if (!snapshot.active && snapshot.syncComplete) launched.current = null;
      } catch {
        console.error("Playback history write failed");
      }
    }
    return persisted;
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
    const attempt = `${autoRouteVersion(account)}|${q.recommended}|${q.tests[q.recommended]?.at}`;
    if (automaticAttempt.current === attempt) return;
    automaticAttempt.current = attempt;
    const controller = new AbortController();
    void switchLine(route, controller.signal, "auto").catch((error) => {
      if (!controller.signal.aborted && error?.name !== "AbortError")
        setError(t("library.the_recommended_route_is_unavailable_select_a"));
    });
  }, [
    account,
    routeQualityRevision,
    theater,
    playerActive,
    queueState.busy,
    switching,
  ]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    void listen<PlayerSnapshot>("player-final-snapshot", (event) => {
      if (disposed) return;
      const persisted = snapshotReceiver.current(event.payload);
      if (event.payload.persistenceId)
        void invoke("player_final_saved", {
          persistenceId: event.payload.persistenceId,
          persisted,
        }).catch(() => console.error("Final playback history receipt failed"));
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
            ? t("library.playback_position_saved_locally_server_sync_failed")
            : t("library.playback_stopped"),
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
    const forceBatch =
      infinite &&
      retryBatch.current?.context === paginationContext &&
      retryBatch.current.page === page;
    retryBatch.current = null;
    if (restoringPage.current) {
      restoringPage.current = false;
      batchCursor.current = { context: paginationContext, page, reload };
      batchLock.current = false;
      setAppending(false);
      return;
    }
    const append =
      infinite &&
      batchCursor.current.context === paginationContext &&
      page === batchCursor.current.page + 1 &&
      page > 0;
    if (infinite && page > 0 && !append) {
      setPage(0);
      return;
    }
    batchLock.current = true;
    const controller = new AbortController();
    let active = true;
    let invalidatingAccount = false;
    setBusy(true);
    setAppending(append);
    setError("");
    if (!append) setItems([]);
    setSearchMatches([]);
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
        !infinite &&
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
      const loadedIds = new Set(append ? items.map((item) => item.Id) : []);
      if (
        append &&
        result.Items.length &&
        result.Items.every((item) => loadedIds.has(item.Id))
      )
        throw new Error(t("library.repeated_batch"));
      setItems((previous) => [
        ...new Map(
          (append ? [...previous, ...result.Items] : result.Items).map(
            (item) => [item.Id, item],
          ),
        ).values(),
      ]);
      batchCursor.current = { context: paginationContext, page, reload };
      setTotal(info.total);
      setTotalKnown(info.totalKnown);
      setHasMore(info.hasMore && (!infinite || result.Items.length > 0));
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
        const entries = readHistory(account);
        setWatched(entries);
        setItems(entries.map((e) => e.item));
        setTotal(entries.length);
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
          list = rankSearchCandidates(demoList, route.query);
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
      const libraries =
        route.kind === "search"
          ? { Items: [] as Item[] }
          : await api.views(signal);
      if (!active) return;
      if (route.kind !== "search") setViews(libraries.Items);
      if (groupedResults) {
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
              setError(t("library.continue_watching_is_unavailable_right_now"));
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
          setError(t("library.could_not_load_the_biography_try_again"));
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
              : await api.items(query, signal, { forceRefresh: forceBatch });
        if (active) {
          updatePage(list);
          if ("suggestions" in list)
            setSearchMatches(list.suggestions as Item[]);
        }
      }
    }
    function reportError(e: Error) {
      if (!active || e.name === "AbortError") return;
      if (
        account &&
        accountOwner.current === account &&
        !theater &&
        !playerActive &&
        !queue.state.busy &&
        canFallback(e)
      ) {
        const operation = beginAutoRoute(account, controller.signal);
        void findFallback(account, operation.controller.signal, operation.valid)
          .then(async (candidate) => {
            if (candidate && active && accountOwner.current === account)
              await switchLine(
                candidate.route,
                controller.signal,
                "fallback",
                candidate.checked,
                operation,
              );
          })
          .catch(() => {
            /* Preserve the original connection failure. */
          })
          .finally(operation.dispose);
      }
      if (e instanceof ApiError && e.status === 401) {
        if (invalidatingAccount || accountOwner.current !== account) return;
        invalidatingAccount = true;
        queue.cancelAuto();
        void queue
          .stop()
          .then(() => {
            if (!active || accountOwner.current !== account) return;
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
          .catch((error) => {
            if (active && accountOwner.current === account)
              setError(String(error));
          });
      }
      setError(e.message || t("library.could_not_load_content_try_again"));
    }
    load()
      .catch(reportError)
      .finally(() => {
        if (active) {
          setBusy(false);
          batchLock.current = false;
        }
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
    browseMode,
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
          setError(
            (e as Error).message +
              t("library.could_not_exit_playback_try_again"),
          );
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
          initialError={displayError(error)}
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
  const grid = (
    list: Item[],
    landscape = false,
    windowed = true,
  ): React.ReactNode =>
    infinite && windowed && list.length > 120 ? (
      <BrowseBoundary resetKey={paginationContext}>
        <WindowedBrowse
          items={list}
          root={mainPanel.current}
          layout={listMode}
          render={(visible) => grid(visible, landscape, false)}
        />
      </BrowseBoundary>
    ) : (
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
                let override: { itemId: string; position: number } | null =
                  null;
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
                  aria-label={t("library.remove_viewing_history_for", {
                    p0: item.Name,
                  })}
                  title={t("library.remove_this_viewing_history_entry")}
                  onClick={() => {
                    const entries = removeHistory(account, item.Id);
                    setWatched(entries);
                    setItems(entries.map((e) => e.item));
                    setTotal(entries.length);
                  }}
                >
                  <X size={13} /> {t("library.remove_entry")}{" "}
                </button>
              )}
            </Card>
          );
        })}
      </div>
    );
  const title = theater
    ? playedItem?.Name || t("library.play")
    : route.kind === "home"
      ? t("library.home")
      : route.kind === "later"
        ? t("library.watch_later")
        : route.kind === "collections"
          ? t("library.collections")
          : route.kind === "playlists"
            ? t("library.playlists")
            : route.kind === "history"
              ? t("library.viewing_history")
              : route.kind === "favorites"
                ? t("library.my_favorites")
                : route.kind === "library"
                  ? route.item.Name
                  : route.kind === "search"
                    ? t("library.search_results_for", { p0: route.query })
                    : route.kind === "catalog"
                      ? browseFilters.type === "Movie"
                        ? t("library.all_movies")
                        : browseFilters.type === "Series"
                          ? t("library.all_tv_shows")
                          : t("library.all_media")
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
      className={`${playerActive && !miniPresentation.current ? "shell has-player" : "shell"}${theater ? " theater-shell" : ""}${playerFullscreen && theater ? " fullscreen-player" : ""}`}
    >
      <Sidebar
        navigation={route}
        header={
          route.kind === "search" ? (
            <div className="search-sidebar-context">
              <Search size={23} />
              <strong>{t("search.page")}</strong>
              <small>{t("search.all_connections")}</small>
            </div>
          ) : (
            <ServerSwitcher
              account={account}
              connections={connections}
              busy={busy || switching}
              demo={demo}
              onSwitch={(c) => void switchConnection(c).catch(() => {})}
              onAdd={() => setAddingServer(true)}
              onEdit={() => setShowRoutes(true)}
              onLogout={() => void logout()}
            />
          )
        }
      >
        <nav
          className="sidebar-scroll"
          aria-label={t("library.main_navigation")}
        >
          {account && route.kind !== "search" && (
            <button className="nav" onClick={() => setShowRoutes(true)}>
              <Network size={19} />
              <span>{t("routeC.edit")}</span>
            </button>
          )}
          <button
            className={route.kind === "home" ? "nav active" : "nav"}
            aria-current={route.kind === "home" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "home" })}
          >
            <Home size={19} /> <span>{t("library.home")}</span>
          </button>
          <button
            className={route.kind === "favorites" ? "nav active" : "nav"}
            aria-current={route.kind === "favorites" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "favorites" })}
          >
            <Heart size={19} /> <span>{t("library.favorites")}</span>
          </button>
          <div className="nav-label">{t("library.my_libraries")}</div>
          <button
            className={`nav sidebar-media-group-start${route.kind === "history" ? " active" : ""}`}
            aria-current={route.kind === "history" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "history" })}
          >
            <History size={19} /> <span>{t("library.viewing_history")}</span>
          </button>
          <button
            className={route.kind === "later" ? "nav active" : "nav"}
            aria-current={route.kind === "later" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "later" })}
          >
            <Bookmark size={19} /> <span>{t("library.watch_later")}</span>{" "}
            {later.length > 0 && <small>{later.length}</small>}
          </button>
          <button
            className={route.kind === "collections" ? "nav active" : "nav"}
            aria-current={route.kind === "collections" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "collections" })}
          >
            <Layers size={19} /> <span>{t("library.collections")}</span>
          </button>
          <button
            className={route.kind === "playlists" ? "nav active" : "nav"}
            aria-current={route.kind === "playlists" ? "page" : undefined}
            onClick={() => navigateSidebar({ kind: "playlists" })}
          >
            <ListVideo size={19} /> <span>{t("library.playlists")}</span>
          </button>
          {route.kind !== "search" && (
            <>
              <div className="library-nav-heading">
                <span>{t("library.libraries")}</span>
                <button
                  aria-label={t("library.manage_libraries")}
                  title={t("library.manage_libraries")}
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
            </>
          )}
        </nav>
        <button
          className="nav settings-nav"
          onClick={() => {
            setSettingsSection("playback");
            setShowSettings(true);
          }}
        >
          <SettingsIcon size={19} /> <span>{t("library.settings")}</span>
        </button>
      </Sidebar>
      <main ref={mainPanel} className={`browse-main route-${route.kind}`}>
        <header
          className="topbar"
          aria-label={t("library.page_navigation_and_search")}
        >
          <div className="page-navigation">
            {theater && (
              <button
                aria-label={t("library.exit_playback")}
                disabled={stoppingPlayer}
                onClick={() => void exitPlayback().catch(() => {})}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {route.kind !== "home" && (
              <button
                className="icon"
                aria-label={t("library.go_back")}
                onClick={back}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <button
              className="nav-home"
              aria-label={t("library.go_to_home")}
              onClick={() => go({ kind: "home" })}
            >
              <Home size={17} />
            </button>
            {route.kind !== "home" && <ChevronRight size={14} />}
            {route.kind === "detail" && activeLibrary && (
              <>
                <button
                  className="parent-library"
                  aria-label={t("library.back_to_library", {
                    p0: activeLibrary.Name,
                  })}
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
            sensitiveValues={
              account ? [account.name, account.userId, account.token] : []
            }
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
          {route.kind === "favorites" && (
            <label className="search-scope">
              <input
                type="checkbox"
                checked={allServers}
                onChange={(e) => {
                  setAllServers(e.target.checked);
                  setPage(0);
                }}
              />{" "}
              {t("library.all_servers")}{" "}
            </label>
          )}
          <button
            className="icon"
            aria-label={t("library.refresh")}
            onClick={() => {
              client?.cache.clear();
              if (infinite) setPage(0);
              setReload((r) => r + 1);
            }}
          >
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </header>
        <div className="content">
          {error && (
            <ErrorState message={displayError(error)} onRetry={retryLoad} />
          )}
          {route.kind === "detail" && detail ? (
            <MediaDetail
              key={detail.Id}
              item={detail}
              api={client}
              saved={later.some((i) => i.Id === detail.Id)}
              onPlay={(item, fromStart, sourceId, signal, selection) =>
                queue.play(item, fromStart, sourceId, signal, selection)
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
                  {" "}
                  {t("library.related_titles")}{" "}
                  <small>
                    {busy
                      ? t("library.loading")
                      : totalKnown
                        ? formatNumber(total)
                        : t("library.minimum_count", { count: total })}
                  </small>
                </h2>
                <div
                  className="person-work-filters"
                  role="group"
                  aria-label={t("library.filter_filmography")}
                >
                  {(
                    [
                      { name: t("library.all"), type: undefined },
                      { name: t("library.movies"), type: "Movie" },
                      { name: t("library.tv_shows"), type: "Series" },
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
            route.kind !== "home" &&
            route.kind !== "search" && (
              <PageHeader
                title={title}
                count={
                  busy
                    ? t("library.loading")
                    : t(
                        totalKnown
                          ? "library.items_count"
                          : "library.items_count_minimum",
                        { count: total },
                      )
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
                {" "}
                {t("library.clear_watch_later")}{" "}
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
                {" "}
                {t("library.clear_viewing_history")}{" "}
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
          {route.kind === "search" && (
            <SearchOverview
              query={route.query}
              groups={searchGroups}
              busy={busy}
              demoTotal={demo ? items.length : undefined}
              demoSupplemental={demo ? searchMatches.length : undefined}
              filtered={
                filter !== "all" || Object.values(browseFilters).some(Boolean)
              }
            />
          )}
          {queryControls && (
            <div
              className={
                route.kind === "search"
                  ? "library-controls search-filters"
                  : "library-controls"
              }
              aria-label={
                route.kind === "search" ? t("search.filters") : undefined
              }
            >
              {route.kind === "search" && (
                <ViewToggle
                  list={listMode}
                  onChange={(list) => {
                    setListMode(list);
                    localStorage.setItem("miry-layout", list ? "list" : "grid");
                  }}
                />
              )}
              {browsing && (
                <label>
                  {t("library.browse_mode")}
                  <Select
                    aria-label={t("library.browse_mode")}
                    value={browseMode}
                    onChange={(event) => {
                      const mode = event.target.value as BrowseMode;
                      saveBrowseMode(mode);
                      setBrowseMode(mode);
                      setPage(0);
                      if (mainPanel.current) mainPanel.current.scrollTop = 0;
                    }}
                  >
                    <option value="pages">{t("library.browse_pages")}</option>
                    <option
                      value="infinite"
                      disabled={!!browseFilters.resolution}
                    >
                      {t("library.browse_infinite")}
                    </option>
                  </Select>
                </label>
              )}
              <div className="library-sort-control">
                <label>
                  {" "}
                  {t("library.sort")}{" "}
                  <Select
                    aria-label={t("library.sort_media")}
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
                {" "}
                {t("library.watch_status")}{" "}
                <Select
                  aria-label={t("library.watch_status")}
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">{t("library.all")}</option>
                  <option value="unplayed">{t("library.unwatched")}</option>
                  <option value="played">{t("library.watched")}</option>
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
                  if (
                    browsing &&
                    value.resolution &&
                    browseMode === "infinite"
                  ) {
                    saveBrowseMode("pages");
                    setBrowseMode("pages");
                  }
                  setPage(0);
                }}
              />
            </div>
          )}
          {route.kind === "search" && (
            <p className="search-sort-hint">{browseCopy.searchSortHint}</p>
          )}
          {browsing && browseFilters.resolution && (
            <p className="search-sort-hint">
              {t("library.resolution_uses_pages")}
            </p>
          )}
          {browsing && !infinite && !error && (
            <LibraryPagination
              label={t("library.media_pagination")}
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
          {busy && !appending ? (
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
              {groupedResults &&
                !demo &&
                searchGroups.map((rawGroup) => {
                  const group =
                    route.kind === "search"
                      ? { ...rawGroup, ...searchPresentation(rawGroup) }
                      : rawGroup;
                  return (
                    <section
                      key={connectionId(group.connection.account)}
                      className="search-group"
                    >
                      <div className="section-heading">
                        <h2>{connectionLabel(group.connection.account)}</h2>
                        <small>
                          {route.kind === "search" ? (
                            <SearchCounts
                              primary={group.items.length}
                              supplemental={group.suggestions?.length || 0}
                            />
                          ) : (
                            t(
                              route.kind === "favorites"
                                ? group.totalKnown
                                  ? "library.favorites_count"
                                  : "library.favorites_count_minimum"
                                : group.totalKnown
                                  ? "library.results_count"
                                  : "library.results_count_minimum",
                              { count: group.total },
                            )
                          )}
                        </small>
                      </div>
                      {group.error ? (
                        <ErrorState
                          title={
                            route.kind === "favorites"
                              ? t(
                                  "library.could_not_load_favorites_from_this_server",
                                )
                              : t("library.search_failed_on_this_server")
                          }
                          message={displayError(group.error)}
                        />
                      ) : group.items.length || group.suggestions?.length ? (
                        <div className={listMode ? "grid media-list" : "grid"}>
                          {[...group.items, ...(group.suggestions || [])].map(
                            (item, index) => {
                              const Card = listMode ? MediaListRow : MediaCard;
                              return (
                                <Fragment key={item.Id}>
                                  {index === group.items.length && (
                                    <h3 style={{ gridColumn: "1 / -1" }}>
                                      {t("library.supplemental_matches")}
                                    </h3>
                                  )}
                                  <Card
                                    item={item}
                                    api={
                                      new EmbyClient(group.connection.account)
                                    }
                                    playable={
                                      !!account &&
                                      connectionId(account) ===
                                        connectionId(group.connection.account)
                                    }
                                    onPlay={(
                                      item,
                                      fromStart,
                                      sourceId,
                                      signal,
                                    ) =>
                                      queue.play(
                                        item,
                                        fromStart,
                                        sourceId,
                                        signal,
                                      )
                                    }
                                    onUserData={(selected, data) => {
                                      const owner = favoriteScope(
                                        group.connection.account,
                                      );
                                      const mergeGroups = (
                                        groups: SearchGroup[],
                                      ) =>
                                        groups.map((g) =>
                                          favoriteScope(
                                            g.connection.account,
                                          ) !== owner
                                            ? g
                                            : {
                                                ...g,
                                                items: g.items.map((i) =>
                                                  i.Id === selected.Id
                                                    ? {
                                                        ...i,
                                                        UserData: {
                                                          ...i.UserData,
                                                          ...data,
                                                        },
                                                      }
                                                    : i,
                                                ),
                                                suggestions: g.suggestions?.map(
                                                  (i) =>
                                                    i.Id === selected.Id
                                                      ? {
                                                          ...i,
                                                          UserData: {
                                                            ...i.UserData,
                                                            ...data,
                                                          },
                                                        }
                                                      : i,
                                                ),
                                              },
                                        );
                                      setSearchGroups(mergeGroups);
                                      for (const saved of [
                                        ...history.current,
                                        ...(searchOrigin.current
                                          ? [searchOrigin.current]
                                          : []),
                                      ]) {
                                        const cached =
                                          pageCache.current.get<PageData>(
                                            saved.dataKey,
                                          );
                                        if (
                                          cached?.searchGroups.some(
                                            (g) =>
                                              favoriteScope(
                                                g.connection.account,
                                              ) === owner,
                                          )
                                        )
                                          pageCache.current.set(
                                            saved.dataKey,
                                            {
                                              ...cached,
                                              searchGroups: mergeGroups(
                                                cached.searchGroups,
                                              ),
                                            },
                                            120000,
                                          );
                                      }
                                      if (
                                        account &&
                                        favoriteScope(account) ===
                                          favoriteScope(
                                            group.connection.account,
                                          )
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
                                        void switchConnection(
                                          group.connection,
                                          {
                                            kind: "detail",
                                            item,
                                          },
                                        ).catch(() => {});
                                    }}
                                  />
                                </Fragment>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <EmptyState
                          title={
                            route.kind === "favorites"
                              ? t("library.no_favorites_yet")
                              : t("library.no_results_found")
                          }
                          description={
                            route.kind === "favorites"
                              ? t("library.favorite_movies_and_tv_shows_to_see")
                              : t("library.try_different_search_terms")
                          }
                        />
                      )}
                    </section>
                  );
                })}
              {!(groupedResults && !demo) &&
                route.kind !== "home" &&
                (!error || appending) &&
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
                            ? t("library.no_favorites_yet")
                            : route.kind === "later"
                              ? t("library.watch_later_is_empty")
                              : route.kind === "history"
                                ? t("library.no_viewing_history_yet")
                                : route.kind === "search"
                                  ? t("library.no_results_found")
                                  : route.kind === "collections"
                                    ? t("library.no_collections_yet")
                                    : route.kind === "playlists"
                                      ? t("library.no_playlists_yet")
                                      : detail?.Type === "BoxSet"
                                        ? t("library.this_collection_is_empty")
                                        : detail?.Type === "Playlist"
                                          ? t("library.this_playlist_is_empty")
                                          : t("library.no_content_here_yet")
                        }
                        description={
                          route.kind === "favorites"
                            ? t(
                                "library.select_favorite_on_a_poster_or_details",
                              )
                            : route.kind === "later"
                              ? t("library.add_movies_or_tv_shows_to_watch")
                              : route.kind === "history"
                                ? t(
                                    "library.your_local_viewing_history_appears_here_after",
                                  )
                                : route.kind === "search"
                                  ? t("library.try_different_search_terms")
                                  : route.kind === "person"
                                    ? t(
                                        "library.the_server_has_no_titles_listed_for",
                                      )
                                    : t(
                                        "library.select_another_library_or_refresh_later",
                                      )
                        }
                      />
                    )}
                  </section>
                )}
              {route.kind === "detail" && related.length > 0 && (
                <section className="related">
                  <div className="section-heading">
                    <h2>{t("library.similar_titles")}</h2>
                  </div>
                  {grid(related)}
                </section>
              )}
              {route.kind === "search" && demo && searchMatches.length > 0 && (
                <section className="related">
                  <h2>{t("library.supplemental_matches")}</h2>
                  <p className="search-sort-hint">
                    {t("library.supplemental_hint")}
                  </p>
                  {grid(searchMatches)}
                </section>
              )}
            </>
          )}
          {infinite && (
            <>
              <InfiniteLoad
                root={mainPanel.current}
                loading={busy}
                error={!!error}
                hasMore={hasMore}
                count={items.length}
                onLoad={() => {
                  if (busy || batchLock.current || (!hasMore && !error)) return;
                  if (error) retryLoad();
                  else {
                    batchLock.current = true;
                    setPage((value) => value + 1);
                  }
                }}
              />
            </>
          )}
          {!infinite &&
            (browsing || route.kind === "search" || !busy) &&
            route.kind !== "home" &&
            !error &&
            route.kind !== "history" &&
            route.kind !== "later" &&
            detail?.Type !== "Season" &&
            (queryControls || page > 0 || hasMore) &&
            (queryControls ? (
              <LibraryPagination
                label={t("library.pagination_at_the_end_of_the_list")}
                page={page}
                pageSize={pageSize}
                onPageSizeChange={changePageSize}
                showRange={route.kind !== "search" || searchGroups.length === 1}
                count={
                  route.kind === "search" && !demo && searchGroups.length === 1
                    ? searchGroups[0].items.length
                    : items.length
                }
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
                onMiniChange={(active) => {
                  miniPresentation.current = active;
                  if (active) {
                    const origin = playbackOrigin.current;
                    const originRoute = origin?.route;
                    playbackOrigin.current = null;
                    setTheater(false);
                    setPlayerFullscreen(false);
                    if (
                      origin &&
                      (originRoute?.kind !== "library" ||
                        views.some((view) => view.Id === originRoute.item.Id))
                    ) {
                      restorePage(origin);
                    } else go({ kind: "home" });
                  } else {
                    // Browsing B never changes A's session. Remember that page
                    // for the next Mini entry before presenting the playing A.
                    playbackOrigin.current = capturePage.current();
                    setTheater(true);
                  }
                }}
                onReturn={exitPlayback}
                onFullscreenChange={(fullscreen) => {
                  setPlayerFullscreen(fullscreen);
                  if (fullscreen) setTheater(true);
                }}
                routes={
                  account
                    ? availableRoutes.map((r, index) => ({
                        name: routeDisplayName(r, index),
                        selected: r.url === account.server,
                        quality: routeQuality?.tests[r.url]
                          ? routeQuality.recommended === r.url
                            ? t("library.recommended")
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
                aria-label={t("library.close_queue")}
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
          error={displayError(recoveryError)}
          onIgnore={() => {
            void invoke("recovery_clear")
              .then(() => setRecovery(undefined))
              .catch(() =>
                setRecoveryError(
                  t("library.could_not_clear_the_interrupted_playback_record"),
                ),
              );
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
          onSwitch={(route, signal, checked) =>
            switchLine(route, signal, "manual", checked)
          }
          onUpdate={(next) => {
            const remember =
              connections.find(
                (c) => connectionId(c.account) === connectionId(next),
              )?.remember || false;
            saveAccount(next, remember);
            setAccount(next);
            setConnections(readConnections());
          }}
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
          aria-label={t("library.add_server")}
        >
          <div className="server-login-card" ref={addServerPanel}>
            <button
              className="server-login-close"
              aria-label={t("library.cancel_adding_server")}
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
  useI18n();

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
  const [ignoreCertificateErrors, setIgnoreCertificateErrors] = useState(false);
  const [importAddresses, setImportAddresses] = useState<string[]>([]);
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
        ignoreCertificateErrors,
      });
      const info = await client.serverInfo(controller.signal);
      if (
        readConnections().some(
          ({ account: saved }) =>
            saved.server === client.account.server &&
            saved.serverId &&
            saved.serverId !== info.Id,
        )
      )
        throw new Error(t("routeC.identity_changed"));
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      setConnectStage("login");
      stage = "login";
      const account = {
        ...(await client.login(username.trim(), password, controller.signal)),
        serverId: info.Id,
        serverName: info.ServerName,
      };
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      for (const address of importAddresses) {
        try {
          if (
            !readRoutes(account).some(
              (route) => route.url === normalizeServer(address),
            )
          )
            saveRoute(account, {
              name: t("routeC.pending"),
              url: normalizeServer(address),
              serverId: "",
              status: "pending",
            });
        } catch {
          /* Invalid edited candidates are not saved. */
        }
      }
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
          ? t("library.connection_cancelled")
          : t(stage === "probe" ? "errors.server_probe" : "errors.login", {
              detail: privateError(e),
            }),
      );
    } finally {
      setBusy(false);
      pending.current = null;
    }
  }
  return (
    <div className={`login-layout${allowDemo ? "" : " login-embedded"}`}>
      <ConnectionIntro compact={!allowDemo} />
      <section className="login-panel">
        <form onSubmit={submit}>
          <h2>{t("library.emby_server")}</h2>
          <div className="login-import">
            <SmartImport
              disabled={busy}
              onConfirm={(candidate, pending) => {
                setServer(candidate.address);
                setUsername(candidate.username);
                setPassword(candidate.password);
                setImportAddresses(pending);
                setIgnoreCertificateErrors(false);
              }}
            />
          </div>
          {readConnections().length > 0 && (
            <div className="saved-connections">
              {readConnections().map((c) => (
                <button
                  type="button"
                  disabled={busy}
                  key={connectionId(c.account)}
                  onClick={() => void reconnect(c)}
                >
                  {" "}
                  {t("library.connect")} {connectionLabel(c.account)}
                </button>
              ))}
            </div>
          )}
          <label>
            {" "}
            {t("library.server_address")}{" "}
            <input
              required
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("library.paste_server_address")}
              value={server}
              onChange={(e) => {
                setServer(e.target.value);
                setIgnoreCertificateErrors(false);
              }}
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
            {" "}
            {t("library.remark_optional")}{" "}
            <input
              aria-label={t("library.server_remark")}
              type="text"
              autoComplete="off"
              maxLength={60}
              placeholder={t("library.for_example_home_library")}
              value={remark}
              onChange={(e) => {
                remarkChanged.current = true;
                setRemark(e.target.value);
              }}
              disabled={busy}
            />
          </label>
          <div className="login-credentials">
            <label>
              {" "}
              {t("library.username")}{" "}
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
              {" "}
              {t("library.password")}{" "}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />{" "}
            {t("library.remember_me_only_on_your_own_computer")}{" "}
          </label>
          <div className="route-security">
            <CertificateOption
              value={ignoreCertificateErrors}
              onChange={setIgnoreCertificateErrors}
              disabled={busy}
            />
          </div>
          <div className="login-feedback">
            {error && (
              <div className="error" role="alert">
                {displayError(error)}
                <button
                  type="button"
                  className="secondary compact"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(readNetworkDiagnostics(), null, 2),
                      );
                      setDiagnosticFeedback(
                        t(
                          "library.anonymous_diagnostics_copied_addresses_passwords_and_tokens",
                        ),
                      );
                    } catch {
                      setDiagnosticFeedback(
                        t(
                          "library.could_not_copy_diagnostics_check_clipboard_permissions",
                        ),
                      );
                    }
                  }}
                >
                  {t("library.copy_anonymous_diagnostics")}
                </button>
                {diagnosticFeedback && (
                  <small role="status">{diagnosticFeedback}</small>
                )}
              </div>
            )}
          </div>
          <button className="primary" disabled={busy}>
            {busy
              ? connectStage === "probe"
                ? t("library.checking_server")
                : t("library.connected_signing_in")
              : t("library.connect_to_server")}{" "}
            <ArrowRight size={17} />
          </button>
          {busy && (
            <button
              type="button"
              className="cancel"
              onClick={() => pending.current?.abort()}
            >
              <X size={16} /> {t("library.cancel_connection")}{" "}
            </button>
          )}
          <small className="privacy">
            {" "}
            {t("library.your_password_is_never_saved_sign_in")}{" "}
          </small>
        </form>
        {allowDemo && (
          <div className="login-support">
            <span>{t("library.or_try_it_first")}</span>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onDemo}
            >
              {t("library.open_demo_library")} <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
