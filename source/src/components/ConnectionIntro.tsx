import { Play, MessageSquare, Network } from "lucide-react";
import AppIcon from "./AppIcon";
import LanguageSelect from "./LanguageSelect";
import { t } from "../i18n/core";

export default function ConnectionIntro({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <section className="login-intro" aria-labelledby="login-title">
      <div className="brand login-brand">
        <AppIcon /> Miry
      </div>
      <h1 id="login-title">{t("library.connect_to_your_library")}</h1>
      <p>{t("library.connection_intro")}</p>
      {!compact && (
        <ul className="login-features">
          <li className="login-feature">
            <Play size={22} aria-hidden="true" />
            <div>
              <h2>{t("connection.play_title")}</h2>
              <p>{t("connection.play_body")}</p>
            </div>
          </li>
          <li className="login-feature">
            <MessageSquare size={22} aria-hidden="true" />
            <div>
              <h2>{t("connection.danmaku_title")}</h2>
              <p>{t("connection.danmaku_body")}</p>
            </div>
          </li>
          <li className="login-feature">
            <Network size={22} aria-hidden="true" />
            <div>
              <h2>{t("connection.routes_title")}</h2>
              <p>{t("connection.routes_body")}</p>
            </div>
          </li>
        </ul>
      )}
      <div className="login-language">
        <LanguageSelect />
      </div>
    </section>
  );
}
