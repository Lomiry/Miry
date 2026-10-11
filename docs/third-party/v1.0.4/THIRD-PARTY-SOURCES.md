# Miry v1.0.4 third-party corresponding sources

Miry v1.0.4 uses the unchanged v1.0.1 mpv runtime (2,107 files, 138 PE files) and the same third-party dependency versions as v1.0.3. These materials contain third-party sources only, never Miry application source, credentials or personal configuration.

Download every original v1.0.1 ZIP part below; each remains independently extractable. Their original source versions, build recipes, patches, upstream locks, source/binary hashes and licenses remain authoritative.

- [Miry-v1.0.1-third-party-sources-1.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-1.zip)
  SHA256: `91f3ca312a10a724aa8c52a2af46bb542378b9fd16b2b764ab8a6bbbe19aa1a3`

- [Miry-v1.0.1-third-party-sources-2.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-2.zip)
  SHA256: `ab6a9010e6bbe2088b7f6dad254c31e56d538c60d3005de90fc44b6c52db1fc8`

- [Miry-v1.0.1-third-party-sources-3.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-3.zip)
  SHA256: `727f0fedde3475ce82bc0fc1463b816461bf3783d7e3cb5fa994f7f978c0c51e`

[Detailed source index](THIRD-PARTY-SOURCES.json) changes only the Miry version from the existing v1.0.3 index to 1.0.4; the source material version remains 1.0.1. The index preserves all 1,281 entries and source-part mappings. SHA256.txt in this directory checks these documentation files. The installer SHA256 is provided as plain text in the Release supplemental notes.

Original technical/license/build description follows unchanged. Statements below describing original packaging refer to v1.0.1.

# Miry v1.0.1 第三方对应源码

本组归档提供随 Miry v1.0.1 分发的第三方组件源码，不含 Miry 应用源码、账号、配置、凭据或验收日志。Miry 应用继续闭源。

请保存全部 ZIP 分册和 THIRD-PARTY-SOURCES.json。每一册都是可独立解压的标准 ZIP；各分册保留相同的封装时索引和说明；本公开说明补充正式获取方式。索引说明组件版本、原始二进制包哈希、官方构建信息、对应源码、源码校验结果及各文件所在分册。SHA256.txt 校验交付文件。

mpv 使用原有上游提交 a1f50f2c38206dc943f331cf5a5b02f97a0ce219 的完整、未修改源码重新构建。启用 libcurl，保留跨地址重定向的认证隔离；FFmpeg9.0.2、libplacebo7.360.1 和其实际运行库均来自 MSYS2 UCRT64 官方软件包。Git-free source archive 的上游版本标签为 v0.41.0-UNKNOWN，精确源码提交和归档哈希见索引。

msys2-sources 保存完整来源归档：PKGBUILD、.SRCINFO、上游源文件/VCS仓库、补丁和构建脚本。二进制对应 PKGBUILD 的 SHA256 已与官方 .BUILDINFO 核对。额外收录构建时头文件/静态依赖的历史版本。三个已移除的旧源包从精确版本的官方 MSYS2 配方、原始补丁和校验一致的上游归档恢复；其来源记录见索引。

rust-crates 保存对应 Cargo.lock 和实际 librsvg CI 解析的 registry 源码及许可证；build-locks 保留原始上游锁文件及 windows-sys0.60.2/windows-targets0.53.5 的精确构建解析。npm 保存应用实际生产依赖的完整原始源码包。Rust/NPM 下载分别核对 Cargo checksum / package-lock integrity。

## 构建第三方组件

在 MSYS2 UCRT64 环境中，按索引的版本及 .BUILDINFO 准备 GCC、binutils、Meson、Ninja、pkgconf 和依赖。解开各 .src.tar 包后使用其原有 PKGBUILD（makepkg-mingw）重建相应库；VCS 源包保留了配方指定的 Git refs/objects。先安装依赖，再构建 mpv。

mpv 原始源码解开为 mpv-source 后：

```sh
meson setup mpv-build mpv-source --buildtype=release --wrap-mode=nodownload -Dstrip=true -Dlibmpv=false -Dlibcurl=enabled -Dmanpage-build=disabled -Dhtml-build=disabled -Dpdf-build=disabled
meson compile -C mpv-build
meson install -C mpv-build --destdir mpv-install
```

Miry 的实际重建还通过 GCC -ffile-prefix-map 将源码、构建和 UCRT64 头文件目录映射为 mpv-source、mpv-build、ucrt64，避免二进制记录个人构建路径。目录位置、时间及 Git 元数据不同可能改变二进制哈希；不承诺逐字节可重复构建。运行库仅取索引列出的 PE import 依赖，不需要注册 mpv、MSYS2 shell 或全局安装。

离线重建 Rust 库时，将对应 .crate 导入 Cargo 的 registry cache 或 vendor 目录，使用保留的锁文件和原配方；librsvg 的精确 Windows 依赖覆盖记录同时提供。完整源码、许可证、专利及版权声明保留在各原始上游归档中，随安装的工具目录也提供 notices/licenses。

## 分发与许可

mpv 为 GPL-2.0-or-later；本次 FFmpeg 构建启用 GPL/version3，组合播放器按适用的 GPLv3-or-later 条款提供完整对应源码。各运行库/Rust/NPM 组件保持自己的许可证，不能用一份通用 GPL 文本概括全部组件。Miry 通过独立 mpv 进程的 IPC 进行播放。

后续发行若继续使用完全相同的第三方组件，应明确列出本组精确源码分册、索引及哈希的免费公开获取位置；第三方组件变更时须重新补齐对应材料。第三方源码可公开分发，Miry 应用源码归档继续本地私有。本套材料随 Miry v1.0.1 公开提供：[正式发布页](https://github.com/Lomiry/Miry/releases/tag/v1.0.1)。源码分册及索引保持原封装内容；分册内说明中的本地交付状态为封装时记录，当前获取方式以本发布页为准。
