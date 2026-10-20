# 本地 mpv runtime 与 Git 边界

`tools/mpv/` 保存第三方预编译 mpv、DLL 与运行依赖。本地目录约 202 MB；它不是 Miry 业务源码，也不是由当前 Cargo 构建自动生成的播放器。

## 查找与打包

Tauri 配置将 `../tools/mpv/` 映射为发行程序目录中的 `tools/mpv/`。正式播放器只读取当前 Miry EXE 旁的 `tools/mpv/mpv.exe`；debug 构建可回退到本源码根的 `tools/mpv/mpv.exe`。

因此完整 runtime 是现有本地播放及 production 打包的必要文件依赖。Git ignore 只改变跟踪范围，不删除文件，也不改变资源配置或运行时查找逻辑。本阶段没有下载、替换、移动或重建 runtime。

## 版本控制范围

`.gitignore` 排除播放器、DLL、可执行程序和其他运行数据，保留以下现有非敏感资料：

- `tools/mpv/source-manifest.json`：现有来源、依赖与校验记录。
- `tools/mpv/THIRD-PARTY-NOTICES.md`、Copyright、LICENSE.GPL、LICENSE.LGPL。
- `tools/mpv/licenses/`：第三方原始许可资料。

没有使用 Git LFS，也没有创建第二套 runtime 管理工具。继续使用已有来源清单与固定交付资料。

## 新 checkout 或恢复

仅有 Git checkout 不包含完整 runtime，不能据此保证本地播放或 production bundle 可用。新机器或删除本地依赖后，需要从所有者已有的可信私有备份/交付材料恢复完整 `tools/mpv/`，并按现有 source-manifest 核对来源、版本和哈希；必要时依据原有第三方构建材料恢复相同运行时。

不要从任意来源拼凑 DLL，也不要为了让 Git 状态变干净删除本地 runtime。自动下载、升级、替换运行时或改变打包配置属于独立任务。本记录不声称本次执行了完整 runtime 重验或生产构建。

## 2026-10-09 可验证远端恢复

上文记录本地Git初始化时的边界。当前已增加 [RESTORE](RESTORE.md)、固定版本逐文件 [runtime manifest](runtime-manifest-1.0.3.json) 和 `scripts/bootstrap-runtime.ps1`。从公开v1.0.3正式Setup按SHA256校验并仅解包tools/mpv，不执行安装、不改变资源路径、不上传二进制，不删除本地文件。新机器验证结果见 [备份清单](BACKUP-MANIFEST-1.0.3.md)。
