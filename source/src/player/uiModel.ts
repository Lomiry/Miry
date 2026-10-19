import type { PlayerSnapshot } from "./playback";
import type { VideoFit } from "./videoFit";
import type { Item } from "../types/emby";
import { redactNetworkDetail } from "../api/diagnostics";
import type { Shortcuts } from "./shortcuts";
import type { PreviewFrame } from "./preview";
import type {
  DanmakuPresentation,
  DanmakuSettings,
  DanmakuCommand,
} from "../danmaku/types";

export type PlayerMenu =
  | "danmaku"
  | "subtitle"
  | "audio"
  | "volume"
  | "more"
  | "speed"
  | "chapters"
  | "loop"
  | "routes"
  | "versions"
  | "settings"
  | "queue";
export type PlayerAction =
  | { kind: "video-fit"; mode: VideoFit; playSessionId: string }
  | {
      kind: "danmaku";
      command: DanmakuCommand;
      patch?: Partial<DanmakuSettings>;
      query?: string;
      matchId?: string;
    }
  | { kind: "preview"; time: number | null }
  | { kind: "mpv-key"; code: string }
  | { kind: "route-probe"; index: number; media: boolean }
  | { kind: "route-dismiss" | "route-suppress" }
  | { kind: "control"; action: string; value?: number; persist?: boolean }
  | { kind: "return" | "next" | "previous" | "restart" | "diagnostics" }
  | { kind: "source"; id: string }
  | { kind: "route" | "queue-select" | "queue-remove"; index: number }
  | { kind: "auto-next"; value: boolean };

export interface PlayerUiModel {
  state: PlayerSnapshot;
  revision: number;
  theater: boolean;
  canHide: boolean;
  busy: boolean;
  error: string;
  diagnosticFeedback: string;
  sourceId?: string;
  item?: Item;
  introSeconds: number;
  outroSeconds: number;
  shortcuts?: Shortcuts;
  preview?: PreviewFrame | null;
  danmaku?: DanmakuPresentation;
  inputConfig?: boolean;
  shortcutsBlocked?: boolean;
  previousDisabled: boolean;
  nextDisabled: boolean;
  capabilities: {
    return: boolean;
    previous: boolean;
    next: boolean;
    restart: boolean;
    versions: boolean;
  };
  routes: {
    name: string;
    selected: boolean;
    quality?: string;
    detail?: string;
  }[];
  routeHint?: { reason: string; index?: number; name?: string };
  queue?: {
    items: Item[];
    index: number;
    busy: boolean;
    autoNext: boolean;
    error?: string;
  };
}

// Owned controls receive presentation data, never account tokens or media URLs.
export function presentationModel(model: PlayerUiModel): PlayerUiModel {
  const item = (value: Item): Item => ({
    Id: value.Id,
    Name: value.Name,
    Type: value.Type,
    IndexNumber: value.IndexNumber,
    ParentIndexNumber: value.ParentIndexNumber,
    IntroStartPositionTicks: value.IntroStartPositionTicks,
    IntroEndPositionTicks: value.IntroEndPositionTicks,
    CreditsPositionTicks: value.CreditsPositionTicks,
    Chapters: value.Chapters?.map((c) => ({
      Name: c.Name,
      StartPositionTicks: c.StartPositionTicks,
      MarkerType: c.MarkerType,
    })),
    MediaSources: value.MediaSources?.map((s) => ({
      Id: s.Id,
      Name: s.Name,
      Container: s.Container,
    })),
  });
  return {
    ...model,
    error: redactNetworkDetail(model.error),
    item: model.item ? item(model.item) : undefined,
    queue: model.queue
      ? { ...model.queue, items: model.queue.items.map(item) }
      : undefined,
    state: {
      ...model.state,
      networkDetails: undefined,
      error: redactNetworkDetail(model.state.error),
      syncError: redactNetworkDetail(model.state.syncError),
      tracks: model.state.tracks.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        lang: t.lang,
        codec: t.codec,
        selected: t.selected,
      })),
    },
  };
}
