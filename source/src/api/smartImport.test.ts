import { expect, it } from "vitest";
import { parseConnectionText } from "./smartImport";
it("extracts explicit credentials, port and path from mixed prose", () => {
  expect(
    parseConnectionText(
      "欢迎使用\n地址：https://media.example.test:8443/prefix\n用户名：demo\n密码：sample!\n请勿外传",
    ),
  ).toEqual([
    {
      address: "https://media.example.test:8443/prefix",
      username: "demo",
      password: "sample!",
    },
  ]);
});
it("supports separately labelled bare IP, protocol, port and prefix", () => {
  expect(
    parseConnectionText(
      "地址：192.0.2.10\n协议：http\n端口：8096\n路径前缀：/media",
    )[0].address,
  ).toBe("http://192.0.2.10:8096/media");
});
it("deduplicates endpoints and rejects links with embedded credentials or query secrets", () => {
  expect(
    parseConnectionText(
      "https://a.example.test https://a.example.test/emby https://u:p@b.example.test https://c.example.test?token=sample",
    ),
  ).toHaveLength(2);
});
it("does not share credentials between unverified servers", () => {
  const candidates = parseConnectionText(
    "线路 https://a.example.test 与 https://b.example.test\n用户名：demo\n密码：sample",
  );
  expect(candidates).toHaveLength(2);
  expect(candidates.every((c) => !c.username && !c.password)).toBe(true);
});
it("leaves ambiguous, unlabelled and conflicting credentials empty", () => {
  expect(
    parseConnectionText(
      "https://a.example.test\n用户名：\n普通说明\n密码：\n不要推断",
    )[0],
  ).toMatchObject({ username: "", password: "" });
  expect(
    parseConnectionText(
      "https://a.example.test\n账号可能是 demo 密码可能是 sample",
    )[0].username,
  ).toBe("");
  expect(
    parseConnectionText(
      "https://a.example.test\n用户名: a\n用户名: b\n密码: a\n密码: b",
    )[0],
  ).toMatchObject({ username: "", password: "" });
  expect(
    parseConnectionText("https://a.example.test\n用户名: demo 密码: sample")[0]
      .username,
  ).toBe("");
});
it("preserves IPv6, ignores ordinary prose and bounds candidate count", () => {
  expect(
    parseConnectionText("https://[2001:db8::1]:8920/path")[0].address,
  ).toBe("https://[2001:db8::1]:8920/path");
  expect(parseConnectionText("欢迎观看，不代表 Server ID abc")).toEqual([]);
  expect(
    parseConnectionText(
      Array.from({ length: 30 }, (_, i) => `https://a${i}.example.test`).join(
        "\n",
      ),
    ),
  ).toHaveLength(20);
});
it("recognizes Chinese protocol/port variants without inventing an API path", () => {
  expect(
    parseConnectionText(
      "服务器：media.example.test\n协议是：http\n端口是：8443",
    )[0].address,
  ).toBe("http://media.example.test:8443");
  expect(
    parseConnectionText("服务器：https://media.example.test\n端口号为：8443")[0]
      .address,
  ).toBe("https://media.example.test:8443");
});
it("preserves explicitly supplied default ports and paths over separate metadata", () => {
  expect(
    parseConnectionText(
      "https://media.example.test:443/proxy\n端口：8443\n路径：/other",
    )[0].address,
  ).toBe("https://media.example.test/proxy");
  expect(
    parseConnectionText("https://media.example.test/emby")[0].address,
  ).toBe("https://media.example.test/emby");
});
it("deduplicates before applying a separate port and rejects unusable port values", () => {
  expect(
    parseConnectionText(
      "https://media.example.test\nhttps://media.example.test/\n端口：8443",
    ),
  ).toMatchObject([{ address: "https://media.example.test:8443" }]);
  expect(
    parseConnectionText("服务器地址：media.example.test\n端口：70000"),
  ).toEqual([]);
});
it("does not assign an ambiguous shared port to unrelated addresses", () => {
  expect(
    parseConnectionText(
      "https://a.example.test\nhttps://b.example.test\n端口是：8443",
    ).map((c) => c.address),
  ).toEqual(["https://a.example.test", "https://b.example.test"]);
});
