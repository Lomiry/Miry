import type { InputHTMLAttributes } from "react";

export default function Checkbox({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input {...props} type="checkbox" className={`ui-checkbox ${className}`} />
  );
}
