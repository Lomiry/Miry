import type { ButtonHTMLAttributes } from "react";
export default function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${className}`}
      aria-label={label}
      data-tooltip={label}
    >
      {children}
    </button>
  );
}
