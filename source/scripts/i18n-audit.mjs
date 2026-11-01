import fs from "node:fs";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const han = /\p{Script=Han}/u;
export function placeholders(text) {
  const simple = text.replace(
    /\{(\w+), plural, one \{[^{}]*\} other \{[^{}]*\}\}/g,
    "{$1}",
  );
  return [
    ...new Set([...simple.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].sort();
}
export function readCatalog(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const catalog = {},
    duplicates = [];
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      ts.isStringLiteral(node.initializer)
    ) {
      const key = node.name.text;
      if (key in catalog) duplicates.push(key);
      catalog[key] = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { catalog, duplicates };
}
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file)
        ? [file]
        : [];
  });
}
export function auditI18n() {
  const zh = readCatalog("src/i18n/zh-CN.ts"),
    en = readCatalog("src/i18n/en-US.ts");
  const issues = [],
    exceptions = [];
  for (const duplicate of [...zh.duplicates, ...en.duplicates])
    issues.push(`Duplicate key: ${duplicate}`);
  const keys = [
    ...new Set([...Object.keys(zh.catalog), ...Object.keys(en.catalog)]),
  ];
  for (const key of keys) {
    const a = zh.catalog[key],
      b = en.catalog[key];
    if (!a?.trim() || !b?.trim())
      issues.push(`Missing or empty translation: ${key}`);
    else if (
      JSON.stringify(placeholders(a)) !== JSON.stringify(placeholders(b))
    )
      issues.push(`Placeholder mismatch: ${key}`);
    if (b && han.test(b.replaceAll("弹弹play", "")))
      issues.push(`Unexpected Chinese in English catalog: ${key}`);
  }
  for (const file of sourceFiles("src").filter(
    (file) => !file.startsWith("src/i18n/"),
  )) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        if (!(key in zh.catalog)) issues.push(`${file}: unknown key ${key}`);
        else {
          const names = placeholders(zh.catalog[key]);
          const params = node.arguments[1];
          if (
            names.length &&
            (!params ||
              (ts.isObjectLiteralExpression(params) &&
                names.some(
                  (name) =>
                    !params.properties.some(
                      (p) => p.name?.getText(source) === name,
                    ),
                )))
          )
            issues.push(`${file}: missing interpolation arguments for ${key}`);
        }
      }
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isJsxText(node)) &&
        han.test(node.text)
      ) {
        const text = node.text.trim();
        let reason;
        if (file === "src/demo.ts") reason = "demo media content";
        else if (
          file === "src/App.tsx" &&
          ["精选电影", "周末片单", "第 1 季"].includes(text)
        )
          reason = "demo media name";
        else if (
          file === "src/components/LanguageSelect.tsx" &&
          text === "简体中文"
        )
          reason = "language autonym";
        else if (file === "src/privacy.ts" && text.startsWith("$1[凭据已隐藏]"))
          reason = "credential redaction marker";
        else if (
          file === "src/api/smartImport.ts" &&
          [
            "用户名|用户名称|username|user",
            "密码|password|passwd|pass",
            "端口|port",
            "路径前缀|路径|path",
            "协议|protocol",
          ].includes(text)
        )
          reason = "connection import field parser vocabulary";
        else if (
          file === "src/danmaku/online.ts" &&
          ["零一二三四五六七八九", "十"].includes(text)
        )
          reason = "episode numeral parser";
        else if (
          [
            "src/danmaku/parser.ts",
            "src/danmaku/parser.worker.ts",
            "src/danmaku/online.ts",
          ].includes(file) &&
          Object.values(zh.catalog).includes(node.text)
        )
          reason =
            "canonical worker message, localized at presentation boundary";
        if (reason)
          exceptions.push({
            file,
            line:
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1,
            reason,
          });
        else
          issues.push(
            `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: hardcoded UI text ${JSON.stringify(text)}`,
          );
      }
      if (
        ts.isTemplateExpression(node) &&
        han.test(
          node.head.text +
            node.templateSpans.map((span) => span.literal.text).join(""),
        )
      ) {
        const text =
          node.head.text +
          node.templateSpans
            .map((span, i) => `{p${i}}${span.literal.text}`)
            .join("");
        if (
          file === "src/demo.ts" ||
          (file === "src/danmaku/online.ts" &&
            Object.values(zh.catalog).includes(text))
        )
          exceptions.push({ file, reason: "canonical media/worker template" });
        else issues.push(`${file}: hardcoded template ${text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { keys: keys.length, issues, exceptions };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = auditI18n();
  console.log(JSON.stringify(result, null, 2));
  if (result.issues.length) process.exitCode = 1;
}
