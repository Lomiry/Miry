# Miry

![Miry — Windows · Emby · mpv](docs/images/miry-banner.svg)

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D4?style=flat-square" alt="Windows" />
  <img src="https://img.shields.io/badge/Version-0.16.0-6554C0?style=flat-square" alt="Version 0.16.0" />
  <img src="https://img.shields.io/badge/Player-mpv-343434?style=flat-square" alt="mpv" />
  <img src="https://img.shields.io/badge/Project-Closed--source-52525B?style=flat-square" alt="Closed-source" />
</p>

<p align="center"><strong>Windows 上的 Emby 桌面观看体验</strong><br />个人维护 · 非商业 · 开发测试中</p>

<p align="center">
  <a href="#功能特性">功能特性</a> ·
  <a href="#下载与版本">下载与版本</a> ·
  <a href="#在线弹幕">在线弹幕</a> ·
  <a href="#反馈与建议">反馈与建议</a> ·
  <a href="#隐私与使用说明">隐私与使用说明</a>
</p>

---

Miry 是一款面向 Windows 的第三方 Emby 桌面客户端，使用原生 mpv 作为播放核心，专注于电影、电视剧和动画的桌面观看体验。

连接自己的 Emby 服务器，浏览媒体库、选择媒体版本、调节字幕与弹幕，并同步播放进度。Miry 本身不提供影视资源或服务器账号。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 服务器管理 | Emby 服务器连接、多服务器管理与切换 |
| 原生播放 | Windows 原生 mpv 播放，支持 Direct Play / Direct Stream / Transcode / HLS |
| 媒体版本 | 在同一作品的多个媒体版本之间选择 |
| 字幕 | 主字幕 / 次字幕，字幕大小与位置实时调节 |
| 本地弹幕 | 加载本地 Bilibili XML / ASS 弹幕 |
| 在线弹幕 | 作品搜索、自动 / 手动匹配与只读弹幕展示 |
| 观看管理 | 播放进度同步、收藏、待看清单与观看记录 |
| 多线路 | Smart Route 多线路切换 |
| 界面 | Dark / Light / System 主题、UI 字号与可折叠侧栏 |

## 下载与版本

| 项目 | 当前状态 |
| --- | --- |
| 平台 | Windows |
| 当前版本 | 0.16.0 |
| 开发状态 | 开发测试阶段 |
| 项目性质 | 个人维护、非商业、Closed-source（闭源） |

当前尚未在本仓库公开发布安装包。版本状态与开发进度通过本项目主页更新。

本仓库用于项目介绍、开发进度展示和第三方服务接入审核。

## 在线弹幕

Miry 正在接入弹弹play开放弹幕网络，用于作品搜索、自动/手动匹配以及只读弹幕展示。

在线弹幕通过弹弹play官方开放 API 接入，不使用网页抓取、Cookie 模拟或非公开接口。

Miry 不提供弹幕发送、弹弹play用户登录、批量弹幕下载或社区功能。

## 反馈与建议

使用问题与功能建议可以通过 [GitHub Issues](https://github.com/Lomiry/Miry/issues) 提交。

请说明遇到问题时的操作步骤、Miry 版本和预期行为，以便定位问题。

## 隐私与使用说明

### 隐私

Miry 不会向弹幕服务发送 Emby Token、服务器地址、用户账号、媒体服务器凭据或播放历史。

在线匹配仅使用作品标题、年份、季集信息及服务支持的作品 ID。

### 媒体来源

Miry 展示和播放的媒体来自用户自行配置的 Emby 服务器。本应用不托管或分发影视内容；请使用自己有权访问的媒体服务和内容。

## License

Miry 当前为闭源项目。

本仓库仅用于项目介绍、开发进度展示和第三方服务接入审核，不代表 Miry 源代码以开源许可证发布。
