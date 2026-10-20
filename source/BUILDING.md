# v1.0.7 构建与对应源码

Windows x64 需要 Node.js/npm、Rust MSVC、C++ Build Tools、Windows SDK 和完整 7-Zip。依赖由 package-lock.json 与 src-tauri/Cargo.lock 固定。

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-runtime-public-v107.ps1
node scripts/rust-delta-notices.mjs --check
npm run tauri build -- --bundles nsis -- --locked
```

默认 PUBLIC 不含 Provider 接入凭据；现有 Tauri 构建入口要求受控 Updater 签名环境（独立开发构建应使用自己的密钥，不能冒用正式密钥）。正式 RC7 沿用 OFFICIAL 外部输入边界，见 docs/PROVIDER-PUBLIC-BUILDS.md。正式私钥、密码、Provider 输入与生成模块均不提供；不承诺公开快照可逐字节重现 OFFICIAL。以上为构建说明，本次发布未重新构建。

运行时恢复仍使用已固定的 v1.0.3 基线和 v1.0.7 补充清单；v1.0.7 未替换运行时。补充 NOTICE 在原递归 tools/mpv 资源映射内，构建入口强制校验。源码、补丁、PKGBUILD 和各自摘要沿用第三方资料入口中的三个历史独立分卷，不重复上传。内部 updater 测试数据未公开，完整内部测试套件不在本快照承诺范围。

公开适配入口沿用 v1.0.6 已公开的保护逻辑：先校验保留资源和未知文件，再恢复基线缺失资源；不会用旧运行时覆盖新许可。原提交的 bootstrap-runtime.ps1 仍原样提供但不是上述推荐命令。此公开适配入口未用于 RC7 构建，本轮只做静态清单/脚本检查，未执行网络恢复或重新构建。
