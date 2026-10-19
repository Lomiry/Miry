## UNIC / Unicode 10.0 — R1.1-B candidate supplement

Additional candidate notices for five UNIC 0.9.0 crates and the independently attributed Unicode 10.0 data are linked from [the unified index](licenses/THIRD-PARTY-NOTICE-INDEX.md#r11-b-unic--unicode-10-candidate-supplement) and [the UNIC notice](licenses/rust/unic-0.9.0/NOTICE.md). The approved B1 + G1–G6 base below is unchanged. INDEPENDENT REVIEW REQUIRED / LEGAL INTERPRETATION REQUIRED / NOT RELEASED. Final linkage, installer inclusion and installed-user visibility NOT VERIFIED.

# Miry v1.0.6 — notice integration staging

See the [unified notice index](licenses/THIRD-PARTY-NOTICE-INDEX.md) and [structured component mapping](licenses/THIRD-PARTY-COMPONENTS.json) for the B1 + G1–G6 scope. Original legal texts remain in their original paths. SOURCE INTEGRATED / BUNDLE PATH ELIGIBLE only; INSTALLER CONTENT, FINAL LINKAGE and installed-user visibility NOT VERIFIED.

## Historical v1.0.1 material — source availability not verified for v1.0.6

The following original v1.0.1 heading, source-part names and same-Release statements are historical context. They do not demonstrate current v1.0.6 public source access or close P5. The B1 marker and all subsequent B1 tables are preserved without additional component tables.

# Miry 1.0.1 第三方材料

本目录包含独立 mpv 播放器及其实际运行库。上游源码提交、组件版本、官方软件包来源、文件哈希和完整对应源码分册的哈希见 source-manifest.json。mpv 原始版权/许可见 Copyright、LICENSE.GPL、LICENSE.LGPL；FFmpeg GPLv3/LGPLv3 等原文及其他原始许可见 licenses/。

mpv 由原有上游提交 a1f50f2c38206dc943f331cf5a5b02f97a0ce219 重新构建，启用 libcurl。FFmpeg9.0.2 / libplacebo7.360.1，UCRT64运行库保持 MSYS2 原始二进制。mpv 及 FFmpeg 的适用 GPLv3-or-later 义务通过同版本完整第三方对应源码归档提供。各组件许可证分别保留；Miry 应用仍为个人维护的闭源项目。

同版本安装包交付目录（公开分发时为同一个 Release）同时提供 Miry-v1.0.1-third-party-sources-*.zip 全部分册、THIRD-PARTY-SOURCES.json、THIRD-PARTY-SOURCES.md 和 SHA256.txt。分册含完整上游源码、补丁、构建配方、精确依赖和离线 Rust crate 源码，不包含 Miry 应用源码。获取源代码不需要 Emby/弹幕账号或凭据。

项目发布页：https://github.com/Lomiry/Miry/releases
MSYS2 官方软件包：https://repo.msys2.org/mingw/ucrt64/
MSYS2 官方源码：https://repo.msys2.org/mingw/sources/
mpv 上游：https://github.com/mpv-player/mpv

Miry 的生产 JavaScript/Rust 第三方依赖源码也收录在源码分册，原始许可证保存在 licenses/npm 和 licenses/rust。GPL、LGPL、MIT、Apache、BSD 等各自按原文生效，本说明不替代原始许可。系统 Windows/WebView2 组件由操作系统/Microsoft提供。

## Miry v1.0.6 B1 notice staging

The following exact-version notices are staged for the native libraries mapped below. The files in `licenses/` are preserved upstream texts; this index does not replace those texts.

| Component | Version | Distributed DLL(s) | SPDX | Original notice files | Source material | Status |
| --- | --- | --- | --- | --- | --- | --- |
| libass | 0.17.5 | `libass-9.dll` | ISC | `licenses/libass/COPYING` | `Miry-v1.0.1-third-party-sources-1.zip`, MSYS2 source member for `mingw-w64-libass-0.17.5-1` | SOURCE FILE PRESENT; STAGING INTEGRATION READY |
| libvorbis | 1.3.7 | `libvorbis-0.dll`, `libvorbisenc-2.dll` | BSD-3-Clause | `licenses/libvorbis/COPYING` | `Miry-v1.0.1-third-party-sources-1.zip`, MSYS2 source member for `mingw-w64-libvorbis-1.3.7-3` | SOURCE FILE PRESENT; STAGING INTEGRATION READY |
| libtheora | 1.2.0 | `libtheoradec-2.dll`, `libtheoraenc-2.dll` | BSD-3-Clause | `licenses/libtheora/COPYING`; `licenses/libtheora/LICENSE` (original On2 patent statement) | `Miry-v1.0.1-third-party-sources-1.zip`, MSYS2 source member for `mingw-w64-libtheora-1.2.0-1` | SOURCE FILE PRESENT; patent applicability remains separately disclosed |
| libvpx | 1.17.0 | `libvpx-1.dll` | BSD-3-Clause | `licenses/libvpx/LICENSE`; `licenses/libvpx/PATENTS` (original patent material) | `Miry-v1.0.1-third-party-sources-1.zip`, MSYS2 source member for `mingw-w64-libvpx-1.17.0-1` | SOURCE FILE PRESENT; patent applicability remains separately disclosed |

The component-to-binary-to-source mapping, exact file hashes, package metadata and recipe hashes are recorded in `licenses/B1-SOURCE-MAP.json`. The source archive SHA256 is `91f3ca312a10a724aa8c52a2af46bb542378b9fd16b2b764ab8a6bbbe19aa1a3`; the per-file hashes are in the mapping file.

Staged notice file SHA256 values:

| File | SHA256 |
| --- | --- |
| `licenses/libass/COPYING` | `f7e30699d02798351e7f839e3d3bfeb29ce65e44efa7735c225464c4fd7dfe9c` |
| `licenses/libvorbis/COPYING` | `ec1815db59fcd302846df949d7424876cb2e2dc5ed1606c5fb0b36787b1cf43a` |
| `licenses/libtheora/COPYING` | `8417fad7da775735564e209484a2e011e0fa201e94f01fdbee6e4977e478e6fc` |
| `licenses/libtheora/LICENSE` | `2c902950c73a63cd285dc0c36573de9c5fefe66d49312949c51d941f33e92932` |
| `licenses/libvpx/LICENSE` | `8267348d5af1262c11d1a08de2f5afc77457755f1ac658627dd9acf71011d615` |
| `licenses/libvpx/PATENTS` | `cc3273e0694ea5896145e0677699b53471b03ea43021ddc50e7923fbb9f5023c` |

The Tauri resource rule maps `../tools/mpv/` recursively to the installed `tools/mpv/` directory. Therefore these staged files are integration-ready for a future authorized build. The existing v1.0.6 candidate was not rebuilt or modified, and its inclusion of these newly staged files is **NOT VERIFIED**.

## D0.6-B2 — brotli-decompressor 6.0.1 / src/context.rs

Component ID: `brotli-decompressor@6.0.1`. Original Cargo declaration: `BSD-3-Clause/MIT` (retained literally; no SPDX OR/AND interpretation). This is a file-level notice engineering candidate, not final legal approval.

The following original source header applies specifically to `src/context.rs`:

```text
// Copyright 2013 Google Inc. All Rights Reserved.
//
// Distributed under MIT license.
// See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
//

```

- [Google MIT full text](licenses/rust/brotli-9.0.0/LICENSE.MIT), SHA256 `3d180008e36922a4e8daec11c34c7af264fed5962d07924aea928c38e8663c94`. Existing exact bytes reused for this file; component identity remains brotli-decompressor 6.0.1.
- [Dropbox 2016 BSD-3-Clause original](licenses/rust/brotli-decompressor-6.0.1/LICENSE), SHA256 `c0c56f26d9c051cac4d200c34c84e7ae9aaa853e01a982a1df08b09931e518ae`. Preserved separately; it does not replace the Google file attribution.
- [Versioned file/source mapping](licenses/rust/brotli-decompressor-6.0.1/SOURCE-MAP-D0.6-B2.json): fixed source revisions, exact header slice, B1 evidence cross-references and original-resource paths.

Dropbox initial direct-port commit: `3c32e43b16ee0b2736685c2b6ebfdc0db0cd7dc7`. Dropbox 2018 table extension: `8234c4931cc2682fc3ad07adb83e194d94b352b7`; matching Google 2018 witness: `35e69fc7cf9421ab04ffc9d52cb36d07fa12984a`. A unique Google donor SHA is **NOT CONFIRMED**.

Historical copyright lines remain distinct:

- `Copyright (c) 2009, 2010, 2013-2015 by the Brotli Authors.` — Google `23934731f55d06e5b83701bf82c2f53bb9ddf56d`, B1-05; exact historical full text retained in the B1 evidence package, SHA256 `6e86408ccace4d14d2a9116cb81fe9fbab65f51fb01e123596e1ff5f010abe0c`.
- `Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.` — Google 2018 witness, B1-07; exact full text is the shared resource linked above.

These two historical originals are not merged or rewritten. Whether the 2015 full text must also ship separately, contribution boundaries and final notice sufficiency remain **LEGAL_REVIEW_REQUIRED**. Other crate files are **NOT VERIFIED** by this patch. Static Tauri resource eligibility does not establish installer inclusion or user visibility. Full D0.6-B coverage remains pending; **NOT RELEASED**.

## Miry v1.0.6 R1.3 complete candidate resources

[Full NOTICE](licenses/rust-v106/NOTICE.txt), [INDEX](licenses/rust-v106/INDEX.json), [Original resources](licenses/rust-v106/RESOURCE-MANIFEST.json).

Original bytes and file grants are preserved. Independent review and final artifact/source/data acceptance remain required.
