import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage } from "./core";
export function useI18n() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}
