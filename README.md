# Miry

![Miry — Windows · Emby · mpv](docs/images/miry-banner.svg)

<p align="center">
  <strong>Windows 上现代化的 Emby 桌面客户端，注重播放体验、字幕与弹幕支持。</strong>
</p>

<p align="center">
  <a href="https://github.com/Lomiry/Miry/releases/latest">下载最新版本</a> ·
  <a href="CHANGELOG.md">更新日志</a> ·
  <a href="BUILDING.md">构建说明</a> ·
  <a href="LICENSE-SCOPE.md">许可证说明</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square" alt="Windows x64" />
  <img src="https://img.shields.io/badge/Version-1.0.7-287C63?style=flat-square" alt="Miry v1.0.7" />
  <img src="https://img.shields.io/badge/Player-mpv-343434?style=flat-square" alt="mpv" />
</p>

连接自己的 Emby 服务器，浏览媒体库、选择媒体版本，在桌面上观看电影、电视剧和动画。Miry 使用独立原生 mpv 播放，并同步观看进度。

## 项目亮点

| 特性 | 使用体验 |
| --- | --- |
| 原生 mpv 播放 | 支持 Direct Play、Direct Stream、Transcode 与 HLS，按需选择媒体版本 |
| 在线与本地弹幕 | 在线搜索作品、自动或手动匹配弹幕，也可加载本地 Bilibili XML / ASS |
| 主字幕 / 次字幕 | 同时显示两路字幕，播放时调节字幕大小与位置 |
| 三种画面模式 | 自动适应（默认）、填充屏幕、拉伸铺满，播放过程中切换 |
| Windows 桌面体验 | 原生视频窗口、系统媒体控制，支持多服务器与 Smart Route 多线路管理 |
| 现代化界面 | 浅色、深色与跟随系统主题，支持 UI 字号调整和可折叠侧栏 |

搜索、媒体库排序、筛选和分页帮助你找到想看的作品，收藏、待看清单与观看记录方便下次继续观看。功能迭代见[更新日志](CHANGELOG.md)。

## 界面预览

截图待补充：媒体库浏览、播放界面、主字幕 / 次字幕与弹幕，以及浅色 / 深色主题。

## 下载与安装

[**下载 Miry v1.0.7（Windows x64）**](https://github.com/Lomiry/Miry/releases/download/v1.0.7/Miry_1.0.7_x64-setup.exe)

安装包：`Miry_1.0.7_x64-setup.exe`。退出 Miry 后运行安装程序，按提示完成安装。安装包包含 mpv；缺少 WebView2 时，官方引导程序可能需要联网。

[全部版本](https://github.com/Lomiry/Miry/releases) · [安装、升级与校验说明](docs/releases/README.md)

## 快速开始

1. 打开 Miry，添加自己的 Emby 服务器并登录账号。
2. 在首页或媒体库选择作品，按需选择媒体版本后播放。
3. 在播放器中选择主字幕 / 次字幕，使用在线匹配或加载本地弹幕，并切换合适的画面模式。

[查看使用说明](docs/getting-started.md)，了解媒体库操作、弹幕与隐私相关说明。

## 从源码构建

完整应用源码位于 [source/](source/)。[构建说明](BUILDING.md)提供依赖安装、运行时恢复及 PUBLIC 无凭据构建入口。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [使用说明](docs/getting-started.md) | 连接服务器、媒体库、字幕、弹幕与隐私 |
| [构建说明](BUILDING.md) | 开发环境与源码构建 |
| [许可说明](LICENSE-SCOPE.md) | MIT 适用范围与文件级例外 |
| [已知问题](docs/known-issues.md) | 搜索排序、演示模式与问题反馈 |
| [兼容性说明](docs/compatibility.md) | Windows 安装、播放环境与设备适配 |
| [更新日志](CHANGELOG.md) | 各版本功能变化 |
| [文档目录](docs/README.md) | 安装校验、第三方源码与更多资料 |

## 补充说明

Miry 是个人维护的非商业第三方客户端，媒体来自你有权访问的 Emby 服务器。兼容性、已知问题及许可范围请参阅对应文档；MIT 仅适用于有权许可的自有材料，第三方及文件级例外保留原许可。
