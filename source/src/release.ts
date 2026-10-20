import source from "./release-source.json";
import { invoke } from "@tauri-apps/api/core";

export const RELEASE_REPOSITORY = `${source.owner}/${source.repository}`;
export const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
export const RELEASE_PAGE_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;

export interface ReleaseInfo {
  version: string;
  tag_name: string;
  name: string;
  notes: string;
  url: string;
  published_at: string | null;
  newer: boolean;
  assets: { name: string; size: number; browser_download_url: string }[];
}

let pending: Promise<ReleaseInfo> | undefined;
// Manual and automatic callers share only an in-flight request, never a result cache.
export function checkRelease(): Promise<ReleaseInfo> {
  return (pending ??= invoke<ReleaseInfo>("check_release").finally(() => {
    pending = undefined;
  }));
}
