import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useState } from "react";
import { Check, Heart } from "lucide-react";
import type { Item, UserData } from "../types/emby";
import type { EmbyClient } from "../api/client";
export default function ItemActions({
  api,
  item,
  onChange,
}: {
  api: EmbyClient | null;
  item: Item;
  onChange: (data: UserData) => void;
}) {
  useI18n();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function update(kind: "played" | "favorite") {
    setBusy(true);
    setError("");
    const value =
      kind === "played" ? !item.UserData?.Played : !item.UserData?.IsFavorite;
    try {
      const data = api
        ? await (kind === "played"
            ? api.setPlayed(item.Id, value)
            : api.setFavorite(item.Id, value))
        : {
            ...item.UserData,
            ...(kind === "played"
              ? { Played: value, PlaybackPositionTicks: 0, PlayedPercentage: 0 }
              : { IsFavorite: value }),
          };
      onChange(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="item-actions">
      <button
        disabled={busy}
        className={item.UserData?.Played ? "selected" : ""}
        onClick={() => update("played")}
      >
        <Check size={16} />
        {item.UserData?.Played
          ? t("library.mark_unwatched")
          : t("library.mark_watched")}
      </button>
      <button
        disabled={busy}
        className={item.UserData?.IsFavorite ? "selected" : ""}
        onClick={() => update("favorite")}
      >
        <Heart size={16} />
        {item.UserData?.IsFavorite
          ? t("library.remove_favorite")
          : t("library.favorites")}
      </button>
      {error && (
        <p role="alert" className="play-error">
          {displayError(error)}
        </p>
      )}
    </div>
  );
}
