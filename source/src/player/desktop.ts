import type { Account } from "../types/emby";
import type { PlayerSnapshot } from "./playback";
import {
  readNetworkDiagnostics,
  redactNetworkDetail,
} from "../api/diagnostics";
import { readRouteQuality } from "./smartRoutes";
import { readDanmakuDiagnostics } from "../danmaku/searchDiagnostics";
import { readProviderCounters } from "../danmaku/requestDiagnostics";
export function newerVersion(latest: string, current: string) {
  const parse = (s: string) =>
    /^\d+\.\d+\.\d+$/.test(s) ? s.split(".").map(Number) : undefined;
  const a = parse(latest),
    b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
export function diagnostics(account?: Account, s?: PlayerSnapshot) {
  const secrets = account
    ? [account.token, account.server, account.userId, account.deviceId]
    : [];
  const q = account ? readRouteQuality(account) : undefined;
  return {
    network: readNetworkDiagnostics(),
    danmaku: readDanmakuDiagnostics(),
    danmakuRequests: readProviderCounters(),
    routes: q
      ? {
          mode: q.mode,
          pinned: !!q.pinned,
          recommended: !!q.recommended,
          tests: Object.values(q.tests).map((t) => ({
            at: t.at,
            score: t.score,
            metrics: t.metrics,
          })),
        }
      : undefined,
    playback: s
      ? {
          active: s.active,
          loaded: s.loaded,
          position: s.position,
          duration: s.duration,
          playMethod: s.playMethod,
          mediaQuality: s.mediaQuality,
          video: s.videoParams,
          output: s.videoOutput,
          windowsHdr: s.windowsHdr,
          outputPolicy: s.outputPolicy,
          renderer: s.renderer,
          hardwareDecoder: s.hardwareDecoder,
          audioOutput: s.audioOutput,
          audioFallback: s.audioFallback,
          error: redactNetworkDetail(s.error, secrets),
          syncError: redactNetworkDetail(s.syncError, secrets),
          networkDetails: (s.networkDetails || []).map((v) =>
            redactNetworkDetail(v, secrets),
          ),
        }
      : undefined,
  };
}
