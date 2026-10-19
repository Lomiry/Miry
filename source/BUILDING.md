# 构建与对应源码

在本目录运行构建。Windows x64 需要 Node.js/npm、Rust MSVC、C++ Build Tools、Windows SDK 和完整 7-Zip。依赖版本由 package-lock.json 与 src-tauri/Cargo.lock 锁定。

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-runtime.ps1
npm run tauri build -- --bundles nsis -- --locked
```

默认 PUBLIC 无需维护者凭据。恢复脚本下载并校验锁定的历史运行时，保留候选中的附加许可与新版 NOTICE。恢复/构建流程已在原候选验证，本次只重用结果。

OFFICIAL 使用 docs/PROVIDER-PUBLIC-BUILDS.md 所述外部受控输入；输入目录与输出目录必须位于源码/Git 外且仅构建者可访问。不得提交凭据输入、生成模块、构建缓存或含凭据程序。公开源码不能逐字节复现冻结 OFFICIAL，未提供其凭据或完整工具链重现证明。

运行时对应源码见 tools/mpv/compliance/runtime/THIRD-PARTY-SOURCES.json 与 RECIPIENT-README.md；原始源码、补丁及 PKGBUILD 在 v1.0.1 三个独立分卷内，分卷与当前运行时的对应关系沿用既有精确校验。MPL 源码、CDLA 数据与协议、WebView2 SDK 告知及 Rust 原始许可随 tools/mpv/compliance 和 tools/mpv/licenses 提供。第三方材料的存在不解除 RIGHTS-STATUS.md 所列待证事项。
