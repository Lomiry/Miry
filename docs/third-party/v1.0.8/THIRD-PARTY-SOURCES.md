# Miry v1.0.8 第三方许可与对应源码

使用已验签 OFFICIAL RC2；[发行源码与构建身份](SOURCE-MAPPING.json)、[逐文件应用快照](../../../source/SNAPSHOT-MANIFEST.json)、[许可范围及待证](../../../source/RIGHTS-STATUS.md)。公开 Tag 必须指向本次快照提交，不使用旧版 main 代替。

当前 Cargo/npm 依赖版本与正式 v1.0.7 一致，无新增包版本；固定 mpv 来源清单一致。沿用既有完整源材料及其精确来源、补丁、PKGBUILD、许可证和逐成员索引，不将不存在依赖变更误写为新授权。

[机器索引](THIRD-PARTY-SOURCES.json) · [原有 NOTICE](../../../source/tools/mpv/licenses/rust-v106/NOTICE.txt) · [当前补充 NOTICE](../../../source/tools/mpv/licenses/rust-v107/NOTICE.txt) · [原始许可与字节索引](../../../source/tools/mpv/licenses/rust-v107/INDEX.json) · [四个 Windows 包精确源码](sources/) · [MPL/CDLA及运行时供应](../../../source/tools/mpv/compliance/) · [完整运行时源码/配方逐成员索引](../../../source/tools/mpv/compliance/runtime/THIRD-PARTY-SOURCES.json)。minisign-verify 的 Frank Denis MIT、rust-crypto 原始 ISC 标注及 Graydon Hoare/Mozilla 原文均保留。非 Windows 的 osakit/Apple SDK 不作为本目标供应。

完整运行时对应源码沿用以下固定历史独立分卷。本轮匿名 HEAD 均为200、大小及 GitHub digest 匹配；未重新下载数GB，不改历史版本：

- [Miry-v1.0.1-third-party-sources-1.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-1.zip) — 1791428285 bytes；SHA256 `91f3ca312a10a724aa8c52a2af46bb542378b9fd16b2b764ab8a6bbbe19aa1a3`。
- [Miry-v1.0.1-third-party-sources-2.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-2.zip) — 1790458555 bytes；SHA256 `ab6a9010e6bbe2088b7f6dad254c31e56d538c60d3005de90fc44b6c52db1fc8`。
- [Miry-v1.0.1-third-party-sources-3.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-3.zip) — 490257003 bytes；SHA256 `727f0fedde3475ce82bc0fc1463b816461bf3783d7e3cb5fa994f7f978c0c51e`。

本 Release 的 `Miry_1.0.8_third-party-materials.zip` 另含当前原始许可、compliance 源码/数据/配方索引及上述四个 crate；不是替代三个完整历史分卷的空壳，也不含 Miry 私有应用源码、凭据或内部 QA。材料无需账号即可获取。

沿用文件级例外与待证权属，不宣称整个应用已完成 MIT 清权。安装、升级、卸载及完整GUI/长期运行/多屏由所有者接受风险并跳过，不能写成PASS。
