# Miry v1.0.8 构建与对应源码

Windows x64 需要已安装的 Node/npm、Rust MSVC、C++ Build Tools、Windows SDK 和完整 7-Zip。使用 package-lock.json 与 src-tauri/Cargo.lock 固定依赖。

```powershell
npm ci
powershell -File scripts/bootstrap-runtime-public-v108.ps1
node scripts/rust-delta-notices.mjs --check
npm run tauri build -- --test-nsis -- --locked
```

最后一项生成普通本地 PUBLIC 测试安装包，不产生官方 updater 签名、不修改正式签名门禁或公钥。正式构建必须另行具备合法应用接入配置与自己的获授权签名能力，遵守 docs/PROVIDER-PUBLIC-BUILDS.md；不能冒用官方私钥。OFFICIAL 输入、App Secret、生成模块和原私钥均不提供，不承诺公开构建与 OFFICIAL 字节可重复。

本次仅发布已签名 RC2，未因整理文档重新构建或执行此恢复流程。公开适配恢复入口固定使用正式 v1.0.8 安装器与其哈希，只静态解包 mpv；旧入口保留历史属性。内部 updater 测试资料沿用既有公开排除范围，不承诺公开快照可执行完整内部测试套件。安装/升级/卸载/GUI等实机验收未完成，由所有者明确接受风险并跳过，不表示测试通过。
