import { useEffect, useId, useState } from "react";
import Select from "./Select";
import { isComposingKey } from "../player/shortcuts";
import {
  minPageSize,
  maxPageSize,
  pageSizeOptions,
  validPageSize,
} from "../stores/browsePreferences";

// Keep new copy together for the future shared translation catalog.
const copy = {
  label: "每页显示",
  custom: "自定义",
  input: "自定义每页数量",
  apply: "应用",
  hint: `请输入 ${minPageSize}–${maxPageSize} 的整数`,
};
export default function PageSizeControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [custom, setCustom] = useState(
    !pageSizeOptions.some((n) => n === value),
  );
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();
  useEffect(() => {
    setCustom(!pageSizeOptions.some((n) => n === value));
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <div className="page-size-control">
      <label>
        {copy.label}
        <Select
          aria-label={copy.label}
          value={custom ? "custom" : String(value)}
          onChange={(e) => {
            if (e.target.value === "custom") {
              setCustom(true);
              setDraft(String(value));
              setInvalid(false);
            } else {
              setCustom(false);
              setInvalid(false);
              onChange(Number(e.target.value));
            }
          }}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="custom">{copy.custom}</option>
        </Select>
      </label>
      {custom && (
        <form
          className="page-size-custom"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = Number(draft);
            if (!/^\d+$/.test(draft) || !validPageSize(next)) {
              setInvalid(true);
              return;
            }
            setInvalid(false);
            onChange(next);
          }}
        >
          <input
            aria-label={copy.input}
            aria-describedby={hintId}
            aria-invalid={invalid || undefined}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isComposingKey(e.nativeEvent))
                e.preventDefault();
            }}
          />
          <button type="submit">{copy.apply}</button>
          <span
            id={hintId}
            className={invalid ? "page-size-error" : "visually-hidden"}
            aria-live="polite"
          >
            {copy.hint}
          </span>
        </form>
      )}
    </div>
  );
}
