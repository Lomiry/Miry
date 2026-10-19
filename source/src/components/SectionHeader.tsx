import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  id,
  children,
  className = "",
  level = 2,
}: {
  title: string;
  id?: string;
  children?: ReactNode;
  className?: string;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={`section-header ${className}`}>
      <Heading id={id}>{title}</Heading>
      {children && <div className="section-header-actions">{children}</div>}
    </div>
  );
}
