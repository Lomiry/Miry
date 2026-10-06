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
