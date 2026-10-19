# 安装、历史校验与第三方资料

最新正式版为 v1.0.6；OFFICIAL 文件名为 `Miry-Setup-v1.0.6.exe`。普通用户下载对应版本的 `Miry-Setup-vX.Y.Z.exe`，退出 Miry 后安装。升级前备份配置并保留用户数据，不要手动清除 AppData。采用 Windows x64 当前用户安装，安装程序包含 mpv；缺少 WebView2 时官方引导程序可能需要联网。更新由用户手动下载安装，应用不提供后台自动更新。

安装程序未数字签名，Windows SmartScreen 可能提示警告。请从本仓库的 Releases 获取文件，并核对下表中的 SHA256。用户账号与设置保存在独立 AppData 中，与安装目录分离。

Miry 为个人维护的非商业客户端。v1.0.6 提供[完整应用源码](../../source/README.md)；MIT 按明确范围适用，第三方例外和 291 项继承路径权属待证见[许可披露](../../source/RIGHTS-STATUS.md)。历史 v1.0.0–v1.0.5 自动源码包的原供应范围保持不变。

## 每个版本的安装程序

下表校验值与已发布安装程序的 GitHub SHA256 摘要一致；本次只迁移资料，未替换安装程序。

| Version | Installer | Bytes | SHA256 |
| --- | --- | ---: | --- |
| v1.0.0 | [Miry-Setup-v1.0.0.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.0/Miry-Setup-v1.0.0.exe) | 51,302,005 | `2a714ded5b7cec4d05d893b6f03d8e5097c1d459617971342ffb2f246efcb567` |
| v1.0.1 | [Miry-Setup-v1.0.1.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-Setup-v1.0.1.exe) | 57,652,107 | `d59a1c51fe154d0b342de614c8b97e2ecdfdc89f4995a7370f0616edb27a8ef6` |
| v1.0.2 | [Miry-Setup-v1.0.2.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.2/Miry-Setup-v1.0.2.exe) | 57,644,209 | `33442052574f2e168ccd06d9e89f5478a08212fafa590ca22a6dc50a3bfd1389` |
| v1.0.3 | [Miry-Setup-v1.0.3.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.3/Miry-Setup-v1.0.3.exe) | 57,661,510 | `07c4eedffb6b220012d164b6547e0ca767ded5203f564e9901311e92be056b46` |
| v1.0.4 | [Miry-Setup-v1.0.4.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.4/Miry-Setup-v1.0.4.exe) | 57,675,702 | `f0a4f607c03443975a3a15760834e3e231d0668d04609174f54c558058f49ac7` |
| v1.0.5 | [Miry-Setup-v1.0.5.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.5/Miry-Setup-v1.0.5.exe) | 57,680,893 | `73048dc30fe56d48a0c3a27d4593df6e23c071169bc033628ad9cfa0c022601f` |
| v1.0.6 | [Miry-Setup-v1.0.6.exe](https://github.com/Lomiry/Miry/releases/download/v1.0.6/Miry-Setup-v1.0.6.exe) | 68,620,227 | `9061a7ce6a8c7304b57b27b8ba517b5ed890da7ed9ee9ac42380095d41e15c77` |

## 每个版本的第三方资料

| 版本 | 对应源码、许可证与构建说明 | 完整索引 | 校验材料 |
| --- | --- | --- | --- |
| v1.0.0 | **历史供应缺口：该版本完整第三方对应源码尚待补齐**，不能用 v1.0.1 或后续分册替代 | 尚未提供 | 安装程序哈希见上表 |
| v1.0.1 | [说明](https://github.com/Lomiry/Miry/releases/download/v1.0.1/THIRD-PARTY-SOURCES.md) | [JSON](https://github.com/Lomiry/Miry/releases/download/v1.0.1/THIRD-PARTY-SOURCES.json) | [SHA256](https://github.com/Lomiry/Miry/releases/download/v1.0.1/SHA256.txt) |
| v1.0.2 | [说明](https://github.com/Lomiry/Miry/releases/download/v1.0.2/THIRD-PARTY-SOURCES.md) | [JSON](https://github.com/Lomiry/Miry/releases/download/v1.0.2/THIRD-PARTY-SOURCES.json) | [SHA256](https://github.com/Lomiry/Miry/releases/download/v1.0.2/SHA256.txt) |
| v1.0.3 | [说明](../third-party/v1.0.3/THIRD-PARTY-SOURCES.md) | [JSON](../third-party/v1.0.3/THIRD-PARTY-SOURCES.json) | [SHA256](../third-party/v1.0.3/SHA256.txt) |
| v1.0.4 | [说明](../third-party/v1.0.4/THIRD-PARTY-SOURCES.md) | [JSON](../third-party/v1.0.4/THIRD-PARTY-SOURCES.json) | [SHA256](../third-party/v1.0.4/SHA256.txt) |
| v1.0.5 | [说明](../third-party/v1.0.5/THIRD-PARTY-SOURCES.md) | [JSON](../third-party/v1.0.5/THIRD-PARTY-SOURCES.json) | [SHA256](../third-party/v1.0.5/SHA256.txt) |
| v1.0.6 | [说明](../third-party/v1.0.6/THIRD-PARTY-SOURCES.md) | [JSON](../third-party/v1.0.6/THIRD-PARTY-SOURCES.json) | [SHA256](../third-party/v1.0.6/SHA256.txt) |

v1.0.1–v1.0.5 使用同一套第三方组件和对应源码分册；需要完整材料时保存以下三册和相应版本索引。每册可独立解压。普通用户无需下载源码分册。

| Source part | Bytes | SHA256 |
| --- | ---: | --- |
| [Miry-v1.0.1-third-party-sources-1.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-1.zip) | 1,791,428,285 | `91f3ca312a10a724aa8c52a2af46bb542378b9fd16b2b764ab8a6bbbe19aa1a3` |
| [Miry-v1.0.1-third-party-sources-2.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-2.zip) | 1,790,458,555 | `ab6a9010e6bbe2088b7f6dad254c31e56d538c60d3005de90fc44b6c52db1fc8` |
| [Miry-v1.0.1-third-party-sources-3.zip](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-3.zip) | 490,257,003 | `727f0fedde3475ce82bc0fc1463b816461bf3783d7e3cb5fa994f7f978c0c51e` |

mpv 是独立进程；mpv/FFmpeg 组合按适用的 GPLv3-or-later 条款提供完整对应源码。各运行库、Rust 与 npm 组件保留各自许可证，不能以一份 GPL 文本代替全部许可。完整技术、构建和许可说明在上表列出的文件中，安装目录也保留 notices/licenses。排版精简不改变上述供应义务；v1.0.0 缺口继续公开记录。

## 版本兼容性与历史维护告知

- v1.0.0–v1.0.1：在线弹幕需要配置服务接入；当时正式服务验证尚未完成，不保证全部作品覆盖。
- v1.0.1 起：脚本、include/profile、外部录制、网络及改变播放窗口归属的自定义 mpv 配置不受支持，旧配置可能需要移除不支持项；普通画质、音频、字幕、滤镜和 Shader 调节保留。
- v1.0.2 起：发布版内置弹弹play接入，仍受作品数据覆盖及服务限流影响。请求受限时稍后再试，不影响视频播放。
- v1.0.4–v1.0.5：文本搜索排序取决于 Emby 服务器支持；当前已测试服务器的搜索评分升降序不生效，可改在媒体库筛选并排序。演示模式未完整覆盖新增排序字段，返回历史页会恢复并保存当时每页数量。
- v1.0.5：正式安装、覆盖升级、配置保留、卸载、完整 Windows 界面、内置在线弹幕首启/重启、真实 Emby 服务器以及完整 DPI、多屏和系统主题矩阵仍为 Not Verified。官方只读签名验证不等于安装包内置服务实机验收。
- 各版本：真实远程 Emby、长时间播放和部分 HDR / Dolby Vision / AVR / DPI 环境需实机验证。Miry 不修改 Windows 刷新率，也不自动切换系统 HDR。

本页由 v1.0.0–v1.0.5 Release 的维护说明及已有公开资料整理；历史验收范围不因更新排版而扩大。功能变更见 [CHANGELOG](../../CHANGELOG.md)。

本次 v1.0.6 的冻结安装包、源码映射及验证限制见[正式说明](v1.0.6.md)。
