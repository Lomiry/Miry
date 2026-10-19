import { useState } from "react";
import { ArrowUp, ArrowDown, Film, Tv, RotateCcw } from "lucide-react";
import type { Item } from "../types/emby";
import Checkbox from "./Checkbox";
import {
  orderedLibraries,
  defaultLibraries,
  type LibraryPreferences,
} from "../stores/libraryPreferences";

export default function LibraryManager({
  views,
  value,
  onChange,
}: {
  views: Item[];
  value: LibraryPreferences;
  onChange: (prefs: LibraryPreferences) => void;
}) {
  const [error, setError] = useState("");
  const ordered = orderedLibraries(views, value);
  function change(next: LibraryPreferences) {
    try {
      onChange(next);
      setError("");
    } catch {
      setError("设置未保存，请检查本机存储空间后重试。");
    }
  }
  function move(index: number, direction: number) {
    const order = ordered.map((view) => view.Id);
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    change({ ...value, order });
  }
  return (
    <div className="library-manager">
      <div className="library-manager-heading">
        <div>
          <h3>首页与侧栏</h3>
          <p>选择常用媒体库，并调整显示顺序。</p>
        </div>
        <button
          className="library-reset"
          aria-label="恢复媒体库默认设置"
          onClick={() => change(defaultLibraries())}
        >
          <RotateCcw size={15} />
          恢复默认
        </button>
      </div>
      <ul aria-label="媒体库显示设置">
        {ordered.map((view, index) => (
          <li
            key={view.Id}
            className={value.hidden.includes(view.Id) ? "library-hidden" : ""}
          >
            <label>
              <Checkbox
                aria-label={`显示媒体库 ${view.Name}`}
                checked={!value.hidden.includes(view.Id)}
                onChange={(event) =>
                  change({
                    ...value,
                    hidden: event.target.checked
                      ? value.hidden.filter((id) => id !== view.Id)
                      : [...value.hidden, view.Id],
                  })
                }
              />
              {/电视|series/i.test(view.Name) ? (
                <Tv size={18} />
              ) : (
                <Film size={18} />
              )}
              <span>{view.Name}</span>
            </label>
            <div>
              <button
                disabled={index === 0}
                aria-label={`上移媒体库 ${view.Name}`}
                title="上移"
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                disabled={index === ordered.length - 1}
                aria-label={`下移媒体库 ${view.Name}`}
                title="下移"
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!views.length && (
        <p className="setting-note">当前没有可显示的媒体库，请刷新后再试。</p>
      )}
      {views.length > 0 &&
        views.every((view) => value.hidden.includes(view.Id)) && (
          <p className="setting-note">
            媒体库入口已全部隐藏，可在这里重新开启。
          </p>
        )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
