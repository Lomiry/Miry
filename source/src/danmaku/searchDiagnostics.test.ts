import { expect, it } from "vitest";
import {
  readDanmakuDiagnostics,
  transportDiagnostic,
} from "./searchDiagnostics";
it("bounded production diagnostics keep transport facts and exclude raw headers, URLs and bodies", () => {
  for (let n = 0; n < 50; n++)
    transportDiagnostic(
      {
        path: "/api/v2/search/episodes",
        status: 200,
        responseBytes: 117,
        elapsedMs: 16,
        contentType: "application/json",
        appIdPresent: true,
        Authorization: "private-token",
        signature: "private-signature",
        query: "private-title",
        body: "private-body",
        url: "https://private.test",
      },
      "RATE_LIMITED",
    );
  const history = readDanmakuDiagnostics();
  expect(history).toHaveLength(40);
  expect(history.at(-1)).toMatchObject({
    status: 200,
    responseBytes: 117,
    appIdPresent: true,
    errorKind: "RATE_LIMITED",
  });
  expect(JSON.stringify(history)).not.toMatch(
    /private|Authorization|signature|https?:/,
  );
  transportDiagnostic({
    path: "/api/v2/search/episodes?token=private",
    contentType: "private-token",
  });
  expect(readDanmakuDiagnostics().at(-1)).toMatchObject({
    contentType: "other",
  });
  expect(readDanmakuDiagnostics().at(-1)).not.toHaveProperty("path");
});
