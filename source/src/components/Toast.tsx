import { t, localizeMessage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useEffect, useRef } from "react";
import { Check, Info, AlertTriangle, AlertCircle, X } from "lucide-react";
export type ToastTone = "success" | "info" | "warning" | "error";
export function notifyToast(message: string, tone: ToastTone = "info") {
  window.dispatchEvent(
    new CustomEvent("miry-toast", { detail: { message, tone } }),
  );
}
export default function Toast({
  message,
  onDismiss,
  tone = "success",
}: {
  message: string;
  onDismiss: () => void;
  tone?: ToastTone;
}) {
  useI18n();

  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = setTimeout(
      () => dismiss.current(),
      tone === "error" || tone === "warning" ? 6000 : 3600,
    );
    return () => clearTimeout(timer);
  }, [message, tone]);
  const Icon = {
    success: Check,
    info: Info,
    warning: AlertTriangle,
    error: AlertCircle,
  }[tone];
  return (
    <div
      className={`ui-toast toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={16} />
      <span>{localizeMessage(message)}</span>
      <button
        aria-label={t("library.dismiss_notification")}
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}
