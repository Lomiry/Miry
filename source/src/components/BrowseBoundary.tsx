import { Component, type ReactNode } from "react";
import { t } from "../i18n/core";
import { redactNetworkDetail } from "../api/diagnostics";

export default class BrowseBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="empty-state" role="alert">
        <h2>{t("library.render_failed")}</h2>
        <p>{t("library.render_preserved")}</p>
        <button onClick={() => this.setState({ error: null })}>
          {t("library.retry_view")}
        </button>
        <details>
          <summary>{t("library.error_details")}</summary>
          <pre>
            {redactNetworkDetail(
              String(this.state.error.stack || this.state.error.message),
            ).slice(0, 8000)}
          </pre>
        </details>
      </section>
    );
  }
}
