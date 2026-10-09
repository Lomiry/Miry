# Miry v1.0.3

本次更新主要改进搜索、在线弹幕匹配及媒体库分页体验。

## 更新内容

- 修复并增强影视搜索输入、提交和清空恢复。
- 改进在线弹幕搜索输入与焦点处理，并加宽手动搜索区域。
- 弹幕默认速度重新标定为 1×；新的 1× 保持此前 0.5× 的实际移动速度。
- 优化电影、剧集及季/集匹配，并新增“推荐”候选与简短匹配理由。
- 改进弹弹play请求去重、缓存与错误分类，并正确处理服务请求受限状态。
- 媒体库分页新增页码输入和直接跳转，支持 Enter。

## 验证

- 前端测试 649/649。
- Rust 58 passed / 14 ignored。
- 本地 mpv 13/13。
- TypeScript、Vite、格式检查、cargo check及正式NSIS构建通过。
- 已完成真实弹弹play搜索 → TMDb推荐 → comments → 弹幕显示链路验证。
- 实测加载 5,993 条在线弹幕。
- 已验证旧配置在普通重启及 v1.0.3 覆盖安装后保持。

## 说明

- 安装程序未签名，Windows SmartScreen可能提示警告。
- 在线弹幕覆盖取决于弹弹play数据。
- Miry不修改Windows刷新率，也不自动切换系统HDR。
- Miry为个人维护、非商业闭源项目。

---

# Miry v1.0.2 · 2026-10-07

本次更新将在线弹幕服务内置到发布版，并修复“关于”页按钮尺寸不一致的问题。

## 更新内容

- 内置弹弹play开放弹幕网络接入，安装后无需导入服务配置；隐藏导入、替换和清除服务配置控件。
- 保留作品搜索、自动/手动匹配和只读弹幕展示。首次启动及退出重启后均可直接使用。
- “检查新版本”“GitHub 发布记录”“导出匿名诊断”按钮统一宽高，窄空间自动换行。
- 保留年份 · 类型 · 评分、字幕、收藏、Smart Route 及 1.0.1 的播放器修复。

## 验证

前端 534/534、Rust 54/54、本地 mpv 13/13；TypeScript、Vite、格式检查、cargo check 和 production 安装包构建通过。

最终安装包中的原生程序在无外部服务配置的情况下，首次启动及重启均通过正式作品搜索；电影样本加载 5,993 条真实服务弹幕，单 Canvas 绘制、暂停、跳转和倍速同步通过。

## 下载与说明

[下载 Windows 安装程序](https://github.com/Lomiry/Miry/releases/download/v1.0.2/Miry-Setup-v1.0.2.exe)。普通用户只需安装程序；不包含个人 Emby 服务器、账号或访问令牌。

安装程序未签名，SmartScreen 可能提示警告。不同作品弹幕覆盖、真实远程 Emby、长时间播放和部分 HDR / Dolby Vision / AVR / DPI 环境仍需实机验证。Miry 不改变 Windows 刷新率，不自动切换 HDR。

Miry 为个人维护、非商业闭源项目。mpv 运行时和第三方依赖与 1.0.1 相同，完整第三方对应源码继续免费提供；本版本的 [源码说明](https://github.com/Lomiry/Miry/releases/download/v1.0.2/THIRD-PARTY-SOURCES.md) 列出全部分册的精确下载地址及 SHA256，[第三方索引](https://github.com/Lomiry/Miry/releases/download/v1.0.2/THIRD-PARTY-SOURCES.json) 和 [校验文件](https://github.com/Lomiry/Miry/releases/download/v1.0.2/SHA256.txt) 同时提供。第三方源码不含 Miry 应用源码。


---

# Miry v1.0.1

本次为 1.0.0 的修复更新，保留现有媒体卡片、收藏、字幕、弹幕和播放功能。

## 更新日志

- **修复本地 mpv 配置检查**：额外参数、mpv.conf 和 input.conf 使用一致的安全规则，修复 Tab 分隔和分号串联命令等检查绕过；保留普通画质、声音、字幕、倍速、Shader 和快捷键设置。
- **重建 mpv 播放器**：从原有精确上游提交的未修改源码构建，启用 libcurl，保留 HTTP 错误识别及跨地址重定向认证隔离。更新配套 FFmpeg 9.0.2 / libplacebo 7.360.1 运行库。
- **补齐第三方材料**：提供完整第三方对应源码、原始许可证、构建配方、补丁、精确依赖和校验索引。
- **移除个人构建路径**：生产程序中的源码、Cargo/Rustup 和工具链路径经过匿名化处理。安装包不包含开发者的 Emby 账号、服务器配置、Token 或弹幕应用凭据。
- **保持既有功能**：年份 · 类型 · 评分、收藏同步、DP/DS/HLS、双字幕、弹幕、Smart Route 和 Player/Overlay 生命周期保留。没有恢复自动刷新率匹配。

## 下载与安装

普通用户下载 **Miry-Setup-v1.0.1.exe** 即可，无需下载第三方源码分册或自行安装 mpv。采用 Windows 当前用户安装，用户数据保存在独立 AppData 中；缺少 WebView2 时，官方引导程序需要联网安装。

安装包大小：**57,652,107 bytes**。

SHA256：`d59a1c51fe154d0b342de614c8b97e2ecdfdc89f4995a7370f0616edb27a8ef6`

部分旧的自定义 mpv 配置若使用脚本、include/profile、外部程序、录制、网络或窗口覆盖选项，会在播放启动时被拒绝；请移除不支持的设置。普通播放与画质调节继续支持。

## 验证

Frontend **533/533**、Rust **53/53**、真实本地 mpv **13/13**；TypeScript、Vite、格式检查和正式 Windows NSIS 生产构建通过。

最终安装包解出的原生程序已通过空账号隔离启动、模拟 Emby 服务下的 DP/DS/HLS、卡片元数据、收藏增删、在线弹幕模拟、返回和 Alt+F4 关闭验证；3 次播放各上报一次停止，无 Miry/mpv 进程残留。本轮未重新执行安装/重装/卸载验收。

## 第三方对应源码

本 Release 同时免费提供 **3 个第三方源码 ZIP**，共约 **4.07GB**。每册可独立解压；完整材料需要保存三册、`THIRD-PARTY-SOURCES.json`、`THIRD-PARTY-SOURCES.md` 和 `SHA256.txt`。其中包含上游源码、原始构建配方、补丁、锁文件、精确依赖、许可证和构建说明。

mpv 的精确源码提交为 `a1f50f2c38206dc943f331cf5a5b02f97a0ce219`。源码归档不含 Git 元数据，因此上游版本标签显示 `v0.41.0-UNKNOWN`；对应提交、来源及哈希均在索引中明确记录。

**第三方源码归档不包含 Miry 应用源码。** Miry 仍为个人维护、非商业、Closed-source（闭源）项目；GitHub 自动生成的 “Source code” 归档也仅包含项目介绍和更新日志。

## 已知限制

- 安装程序未签名，Windows SmartScreen 可能提示警告。
- **Online Danmaku implementation complete. Live provider verification pending.** 正式弹弹play搜索和弹幕请求尚未完成真实服务验证，不保证所有作品的弹幕覆盖。
- 真实远程 Emby、长时间播放及部分 HDR / Dolby Vision / AVR / DPI 环境仍需实机验证。
- Miry 不修改 Windows 显示器刷新率，也不自动切换 Windows HDR。

本次不会上传 Miry 应用源码或用户数据；既有 v1.0.0 Release 保持不变。


---

## v1.0.0 · 2026-10-05

首个稳定版本：统一播放器品牌图标、正式 Windows NSIS 安装程序和 About 手动版本检查；保留多服务器、原生 mpv、字幕、弹幕、收藏、媒体卡片元数据与 Smart Route。安装包未签名；正式弹幕服务验证仍待完成。
