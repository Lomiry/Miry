import { t } from "../i18n/core";
export default function CertificateOption({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="check certificate-option">
      <input
        type="checkbox"
        disabled={disabled}
        checked={value}
        onChange={(e) => {
          if (!e.target.checked || window.confirm(t("routeC.tls_warning")))
            onChange(e.target.checked);
        }}
      />
      <span>
        {t("routeUi.ignore_tls")}
        {value && (
          <small className="certificate-warning">
            {t("routeC.tls_warning")}
          </small>
        )}
        {value && <small>{t("routeC.tls_images")}</small>}
      </span>
    </label>
  );
}
