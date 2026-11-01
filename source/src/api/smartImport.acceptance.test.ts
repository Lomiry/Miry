import { expect, it } from "vitest";
import { parseConnectionText } from "./smartImport";

it.each(["端口是8096", "端口号为8096", "端口是 8096", "端口号为：8096"])(
  "accepts the explicit natural-language port phrase %s",
  (port) => {
    expect(
      parseConnectionText(`地址：media.example.test\n协议：http\n${port}`),
    ).toMatchObject([{ address: "http://media.example.test:8096" }]);
  },
);
it.each(["0", "65536", "-1", "abc", "8096-extra"])(
  "rejects an unusable separately specified port %s without silently falling back",
  (port) => {
    expect(
      parseConnectionText(`https://media.example.test\n端口：${port}`),
    ).toEqual([]);
  },
);
it.each([
  [
    "https://media.example.test:9443/media/emby",
    "https://media.example.test:9443/media/emby",
  ],
  ["http://[2001:db8::1]:8096/proxy", "http://[2001:db8::1]:8096/proxy"],
  [
    "https://media.example.test:443/custom",
    "https://media.example.test/custom",
  ],
])(
  "preserves explicit authority/path %s over shared metadata",
  (address, expected) => {
    expect(
      parseConnectionText(`${address}\n端口：8920\n路径：/other`)[0].address,
    ).toBe(expected);
  },
);
it("combines an IPv6 host with a separately labelled non-default HTTPS port", () => {
  expect(
    parseConnectionText("服务器地址：[2001:db8::2]\n协议：https\n端口：9443")[0]
      .address,
  ).toBe("https://[2001:db8::2]:9443");
});
it.each([
  "https://media.example.test/path?api_key=synthetic-only",
  "https://media.example.test/path?mode=public",
  "https://media.example.test/path#fragment",
  "https://user:synthetic-only@media.example.test/path",
  "https://media.example.test:99999/path",
  "https://",
  "file:///fixture/path",
])(
  "rejects unsupported/unsafe URL syntax rather than dropping it: %s",
  (address) => {
    expect(parseConnectionText(address)).toEqual([]);
  },
);
it("preserves explicit percent-encoded service paths and adds no API suffix", () => {
  expect(
    parseConnectionText("https://media.example.test/a%20b/base")[0].address,
  ).toBe("https://media.example.test/a%20b/base");
});
