async function auditLoginTheme(page) {
  const reports = [];
  for (const width of [780, 1280])
    for (const pref of ["light", "dark", "system-light", "system-dark"]) {
      await page.setViewportSize({ width, height: width === 780 ? 600 : 860 });
      await page.emulateMedia({
        colorScheme: pref.endsWith("dark") ? "dark" : "light",
        reducedMotion: "reduce",
      });
      await page.evaluate(async (pref) => {
        const { saveAppearance } = await import("/src/stores/appearance.ts");
        saveAppearance({
          theme: pref.startsWith("system") ? "system" : pref,
          uiSize: "large",
        });
      }, pref);
      await page.waitForFunction(() => {
        const probe = document.createElement("span");
        probe.style.cssText = "color:var(--surface);transition:none";
        document.body.append(probe);
        const target = getComputedStyle(probe).color;
        probe.style.color = "var(--muted)";
        const muted = getComputedStyle(probe).color;
        probe.remove();
        return (
          getComputedStyle(document.querySelector(".login-layout"))
            .backgroundColor === target &&
          getComputedStyle(document.querySelector(".login-panel label"))
            .color === muted
        );
      });
      const measured = await page.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const luminance = (s) =>
          rgb(s)
            .map((v) => v / 255)
            .map((v) =>
              v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            )
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const bg = getComputedStyle(
          document.querySelector(".login-layout"),
        ).backgroundColor;
        const contrast = (color) => {
          const a = luminance(color),
            b = luminance(bg);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const labels = [
          ...document.querySelectorAll(
            ".login-panel label,.login-panel .privacy,.login-panel .divider,.login-panel h2,.login-story .brand",
          ),
        ].map((e) => {
          const s = getComputedStyle(e);
          return {
            selector: e.tagName + "." + e.className,
            color: s.color,
            background: bg,
            contrast: contrast(s.color),
          };
        });
        return {
          theme: document.documentElement.dataset.theme,
          bg,
          labels,
          rootWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      if (measured.theme !== (pref.endsWith("dark") ? "dark" : "light"))
        throw Error("Theme resolution failed");
      for (const item of measured.labels)
        if (item.contrast < 4.5)
          throw Error(
            "Login text contrast regression: " +
              pref +
              " " +
              item.selector +
              " " +
              item.contrast,
          );
      if (measured.scrollWidth > measured.rootWidth + 1)
        throw Error("Login horizontal overflow");
      await page
        .getByRole("button", { name: "打开演示媒体库" })
        .scrollIntoViewIfNeeded();
      const action = await page
        .getByRole("button", { name: "打开演示媒体库" })
        .boundingBox();
      if (!action || action.y + action.height > (width === 780 ? 600 : 860) + 1)
        throw Error("Login lower controls unreachable");
      await page
        .getByRole("heading", { name: "连接你的媒体库" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/playwright/v105/login-fixed-${width}-${pref}-large.png`,
        fullPage: true,
      });
      reports.push({ width, pref, measured, action });
    }
  return { result: "PASS", scenarios: reports.length, reports };
}
