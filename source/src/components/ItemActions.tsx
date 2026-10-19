import { useState } from "react";
import { privateText } from "../privacy";
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
        {item.UserData?.Played ? "标为未看" : "标为已看"}
      </button>
      <button
        disabled={busy}
        className={item.UserData?.IsFavorite ? "selected" : ""}
        onClick={() => update("favorite")}
      >
        <Heart size={16} />
        {item.UserData?.IsFavorite ? "取消收藏" : "收藏"}
      </button>
      {error && (
        <p role="alert" className="play-error">
          {privateText(error)}
        </p>
      )}
    </div>
  );
}
