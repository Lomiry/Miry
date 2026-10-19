export interface RecoveryRecord {
  serverId: string;
  itemId: string;
  sourceId: string;
  title: string;
  position: number;
  audioIndex?: number | null;
  subtitleIndex?: number | null;
  timestamp: number;
  version: string;
}
export function validRecovery(value: unknown): RecoveryRecord | undefined {
  const r = value as RecoveryRecord | null;
  if (
    !r ||
    typeof r.serverId !== "string" ||
    !r.serverId ||
    typeof r.itemId !== "string" ||
    !r.itemId ||
    typeof r.sourceId !== "string" ||
    typeof r.title !== "string" ||
    !Number.isFinite(r.position) ||
    r.position < 0 ||
    r.position > 365 * 86400 ||
    !Number.isFinite(r.timestamp) ||
    Date.now() - r.timestamp >= 7 * 864e5 ||
    r.timestamp > Date.now() + 60000
  )
    return;
  return r;
}
