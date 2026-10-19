import { Film, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({
  title,
  description,
  icon = <Film />,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty content-state">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message,
  title = "媒体内容暂时无法加载",
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error content-error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry && <button onClick={onRetry}>重试</button>}
    </div>
  );
}
