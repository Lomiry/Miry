import { checkRelease } from "../release";

export interface UpdateCandidate {
  version: string;
  url: string;
  notes: string;
}
// Keep the settled attempt for this main WebView's lifetime, including failures.
// A new launch starts fresh; legacy persisted preferences are unused.
let attempt: Promise<UpdateCandidate | undefined> | undefined;
let dismissedVersion: string | undefined;

export function dismissUpdate(version: string) {
  dismissedVersion = version;
}
export function automaticUpdate(): Promise<UpdateCandidate | undefined> {
  attempt ??= checkRelease()
    .then((release) =>
      release.newer && /^\d+\.\d+\.\d+(?:\+[\w.-]+)?$/.test(release.version)
        ? {
            version: release.version,
            url: release.url,
            notes: release.notes.trim().slice(0, 600),
          }
        : undefined,
    )
    .catch(() => undefined);
  return attempt.then((value) =>
    value?.version === dismissedVersion ? undefined : value,
  );
}
