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
  const set = (k: keyof BrowseFilters, v: string) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <label>
        类型
        <Select
          aria-label="媒体类型"
          value={value.type}
          onChange={(e) => set("type", e.target.value)}
        >
          <option value="">全部</option>
          <option value="Movie">电影</option>
          <option value="Series">剧集</option>
        </Select>
      </label>
      {showResolution && (
        <label>
          清晰度
          <Select
            aria-label="清晰度"
            value={value.resolution || ""}
            onChange={(e) => set("resolution", e.target.value)}
          >
            <option value="">全部</option>
            <option value="4K">4K / UHD</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="SD">SD / 其他</option>
          </Select>
        </label>
      )}
      <label>
        题材
        <Select
          aria-label="题材"
          value={value.genre}
          onChange={(e) => set("genre", e.target.value)}
        >
          <option value="">全部</option>
          {[...new Set([...genres, value.genre].filter(Boolean))].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </label>
      <label>
        年份
        <input
          aria-label="上映年份"
          type="number"
          min="1888"
          max="2100"
          placeholder="全部"
          value={value.year}
          onChange={(e) => set("year", e.target.value)}
        />
      </label>
      <label>
        评分
        <Select
          aria-label="最低评分"
          value={value.rating}
          onChange={(e) => set("rating", e.target.value)}
        >
          <option value="">全部</option>
          {[6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n} 分以上
            </option>
          ))}
        </Select>
      </label>
      {(resetActive || Object.values(value).some(Boolean)) && (
        <button
          className="filter-reset"
          onClick={() => (onReset ? onReset() : onChange(emptyFilters))}
        >
          重置筛选
        </button>
      )}
    </>
  );
}
