import { useState } from "react";
import { Heart } from "lucide-react";
import type { EmbyClient } from "../api/client";
import type { Item, UserData } from "../types/emby";
import { privateText } from "../privacy";

export default function FavoriteButton({
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
  const favorite = !!item.UserData?.IsFavorite;
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = api
        ? await api.setFavorite(item.Id, !favorite)
        : { ...item.UserData, IsFavorite: !favorite };
      onChange(data);
    } catch (e) {
      setError(privateText(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="tile-favorite"
        disabled={busy}
        title={favorite ? "取消收藏" : "收藏"}
        aria-label={`${favorite ? "取消收藏" : "收藏"} ${item.Name}`}
        aria-pressed={favorite}
        onClick={() => void toggle()}
      >
        <Heart size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
      {error && (
        <p className="card-feedback" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
