import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
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
  useI18n();

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
  title = t("library.media_is_unavailable_right_now"),
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  useI18n();

  return (
    <div className="error content-error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{title}</strong>
        <p>{localizeMessage(message)}</p>
      </div>
      {onRetry && <button onClick={onRetry}>{t("library.retry")}</button>}
    </div>
  );
}
