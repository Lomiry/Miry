# Miry v1.0.7 第三方源码与许可材料

本版使用 OFFICIAL RC7，源码提交 `956124c665478091dc9ed7e4429cefe09a25c2f4`，不使用 RC6。

[对应应用源码](../../../source/README.md) · [构建说明](../../../source/BUILDING.md) · [来源与安装包映射](SOURCE-MAPPING.json) · [逐文件源码摘要](../../../source/SNAPSHOT-MANIFEST.json) · [许可范围](../../../source/LICENSE-SCOPE.json) · [权属待证](../../../source/RIGHTS-STATUS.md) · [依赖索引](THIRD-PARTY-SOURCES.json) · [SHA256](SHA256.txt)

[原有 NOTICE](../../../source/tools/mpv/licenses/rust-v106/NOTICE.txt) 与 [v1.0.7 补充 NOTICE](../../../source/tools/mpv/licenses/rust-v107/NOTICE.txt) 一同适用；[原文与摘要](../../../source/tools/mpv/licenses/rust-v107/INDEX.json) 保留 Frank Denis MIT 及 rust-crypto 原始 ISC 标注段落、Graydon Hoare/Mozilla 版权，不改写原始许可证。RC7 实际安装包的 11 份补充材料、7 份原文均已逐字节校验。

仅检查相对 v1.0.6 的 21 个新增包版本；504 个不变版本和运行时材料沿用既有验证。Windows x64 选中 minisign-verify 0.3.0、rustls-platform-verifier 0.7.1、tauri-plugin-updater 2.14.0、zip 4.6.1，完整精确 crate 源码在 [sources/](sources/)，版本、上游 URL、版权许可及锁文件 SHA256 见索引。其余 17 项仅记录目标限定来源，不分发其归档。objc2-osa-kit 经 updater 的 macOS 专用 osakit 链引入，不参与 Windows 目标；RC7 不含其源码、二进制或 Apple SDK，见 [目标范围证据](WINDOWS-TARGET-SCOPE.json)。

不变运行时的 MPL 对应源码、CDLA 数据/协议、SDK 告知、Rust 原文和源码索引继续提供于 [compliance](../../../source/tools/mpv/compliance/)；[逐成员源码/配方索引](../../../source/tools/mpv/compliance/runtime/THIRD-PARTY-SOURCES.json) 与历史独立分卷对应关系沿用既有精确记录，不重复上传数 GB：

- [Miry-v1.0.1-third-party-sources-1.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-1.zip) — 1791428285 字节；SHA256 `91f3ca312a10a724aa8c52a2af46bb542378b9fd16b2b764ab8a6bbbe19aa1a3`。
- [Miry-v1.0.1-third-party-sources-2.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-2.zip) — 1790458555 字节；SHA256 `ab6a9010e6bbe2088b7f6dad254c31e56d538c60d3005de90fc44b6c52db1fc8`。
- [Miry-v1.0.1-third-party-sources-3.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-3.zip) — 490257003 字节；SHA256 `727f0fedde3475ce82bc0fc1463b816461bf3783d7e3cb5fa994f7f978c0c51e`。

安装程序 SHA256 `0e05936d613f00bbc73f44aafe5454a0f35e7e8a5ef484b5a28476bd226bfaa2`；签名文件 SHA256 `14b6454569be646ffe74f942973b3ad36be973ea4b3920c0ed619657d8cd43b0`。正式公钥验签、1.0.7 版本绑定及错误版本拒绝通过。

本次随包许可缺失阻断已解除，不将完整应用声明为已完成 MIT 清权。原逐文件范围、第三方例外与待证权属保留。真实安装/升级/卸载、配置保留及应用内 NSIS 交接/重启仍未完成端到端验收。
