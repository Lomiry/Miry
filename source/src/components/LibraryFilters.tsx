import { t } from "../i18n/core";
import { useI18n } from "../i18n/react";
import Select from "./Select";
export interface BrowseFilters {
  genre: string;
  year: string;
  rating: string;
  type: string;
  resolution?: string;
}
export const emptyFilters: BrowseFilters = {
  genre: "",
  year: "",
  rating: "",
  type: "",
  resolution: "",
};
export default function LibraryFilters({
  value,
  onChange,
  genres,
  onReset,
  resetActive = false,
  showResolution = true,
}: {
  value: BrowseFilters;
  onChange: (v: BrowseFilters) => void;
  genres: string[];
  onReset?: () => void;
  resetActive?: boolean;
  showResolution?: boolean;
}) {
  useI18n();

  const set = (k: keyof BrowseFilters, v: string) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <label>
        {" "}
        {t("library.type")}{" "}
        <Select
          aria-label={t("library.media_type")}
          value={value.type}
          onChange={(e) => set("type", e.target.value)}
        >
          <option value="">{t("library.all")}</option>
          <option value="Movie">{t("library.movies")}</option>
          <option value="Series">{t("library.tv_shows")}</option>
        </Select>
      </label>
      {showResolution && (
        <label>
          {" "}
          {t("library.resolution")}{" "}
          <Select
            aria-label={t("library.resolution")}
            value={value.resolution || ""}
            onChange={(e) => set("resolution", e.target.value)}
          >
            <option value="">{t("library.all")}</option>
            <option value="4K">4K / UHD</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="SD">{t("library.sd_other")}</option>
          </Select>
        </label>
      )}
      <label>
        {" "}
        {t("library.genre")}{" "}
        <Select
          aria-label={t("library.genre")}
          value={value.genre}
          onChange={(e) => set("genre", e.target.value)}
        >
          <option value="">{t("library.all")}</option>
          {[...new Set([...genres, value.genre].filter(Boolean))].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {" "}
        {t("library.year")}{" "}
        <input
          aria-label={t("library.release_year")}
          type="number"
          min="1888"
          max="2100"
          placeholder={t("library.all")}
          value={value.year}
          onChange={(e) => set("year", e.target.value)}
        />
      </label>
      <label>
        {" "}
        {t("library.rating")}{" "}
        <Select
          aria-label={t("library.minimum_rating")}
          value={value.rating}
          onChange={(e) => set("rating", e.target.value)}
        >
          <option value="">{t("library.all")}</option>
          {[6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n} {t("library.and_above")}{" "}
            </option>
          ))}
        </Select>
      </label>
      {(resetActive || Object.values(value).some(Boolean)) && (
        <button
          className="filter-reset"
          onClick={() => (onReset ? onReset() : onChange(emptyFilters))}
        >
          {" "}
          {t("library.reset_filters")}{" "}
        </button>
      )}
    </>
  );
}
