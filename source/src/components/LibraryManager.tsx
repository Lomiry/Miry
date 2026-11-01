import { displayError } from "../privacy";
import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
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
  useI18n();

  const [error, setError] = useState("");
  const ordered = orderedLibraries(views, value);
  function change(next: LibraryPreferences) {
    try {
      onChange(next);
      setError("");
    } catch {
      setError(t("library.settings_were_not_saved_check_your_local"));
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
          <h3>{t("library.home_and_sidebar")}</h3>
          <p>{t("library.choose_your_favorite_libraries_and_arrange_their")}</p>
        </div>
        <button
          className="library-reset"
          aria-label={t("library.reset_library_preferences")}
          onClick={() => change(defaultLibraries())}
        >
          <RotateCcw size={15} /> {t("library.restore_defaults")}{" "}
        </button>
      </div>
      <ul aria-label={t("library.library_display_preferences")}>
        {ordered.map((view, index) => (
          <li
            key={view.Id}
            className={value.hidden.includes(view.Id) ? "library-hidden" : ""}
          >
            <label>
              <Checkbox
                aria-label={t("library.show_library", { p0: view.Name })}
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
                aria-label={t("library.move_library_up", { p0: view.Name })}
                title={t("library.move_up")}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                disabled={index === ordered.length - 1}
                aria-label={t("library.move_library_down", { p0: view.Name })}
                title={t("library.move_down")}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!views.length && (
        <p className="setting-note">
          {t("library.no_libraries_are_available_refresh_and_try")}
        </p>
      )}
      {views.length > 0 &&
        views.every((view) => value.hidden.includes(view.Id)) && (
          <p className="setting-note">
            {" "}
            {t("library.all_library_shortcuts_are_hidden_you_can")}{" "}
          </p>
        )}
      {error && (
        <p className="error" role="alert">
          {displayError(error)}
        </p>
      )}
    </div>
  );
}
