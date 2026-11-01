// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SearchOverview from "./SearchOverview";
import { setLanguage, t } from "../i18n/core";
afterEach(cleanup);

it.each(["zh-CN", "en-US"] as const)(
  "counts visible demo supplements with the same explicit primary split in %s",
  (language) => {
    setLanguage(language, false);
    render(
      <SearchOverview
        query="Fixture"
        groups={[]}
        busy={false}
        demoTotal={0}
        demoSupplemental={2}
        filtered={true}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain(
      t("search.displayed_count", { count: 2 }),
    );
    expect(status.textContent).toContain(
      t("search.primary_count", { count: 0 }),
    );
    expect(status.textContent).toContain(
      t("search.supplemental_count", { count: 2 }),
    );
    expect(screen.getByText(t("search.filters_active"))).toBeTruthy();
    setLanguage("zh-CN", false);
  },
);
