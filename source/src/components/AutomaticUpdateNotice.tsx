import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import useDialogFocus from "./useDialogFocus";
import { automaticUpdate, dismissUpdate } from "../stores/automaticUpdates";
import {
  clearUpdate,
  downloadUpdate,
  installUpdate,
  minimizeUpdate,
  offerUpdate,
  subscribeUpdate,
  updateSnapshot,
} from "../stores/inAppUpdate";

const labels = {
  available: "发现 Miry 新版本",
  downloading: "正在下载",
  verifying: "下载验证中",
  ready: "准备安装",
  installing: "安装交接中",
  error: "下载或验证失败",
};
const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export default function AutomaticUpdateNotice({
  blocked,
  onPrepareInstall = async () => {},
}: {
  blocked: boolean;
  onPrepareInstall?: () => Promise<void>;
}) {
  const state = useSyncExternalStore(subscribeUpdate, updateSnapshot);
  const [restart, setRestart] = useState(true);
  const { release, phase, minimized } = state;
  const panel = useRef<HTMLElement>(null);
  const active =
    phase === "downloading" || phase === "verifying" || phase === "installing";
  const visible = !!release && (!blocked || phase === "installing");
  const dismiss = () => {
    if (release) dismissUpdate(release.version);
    clearUpdate();
  };
  const close = useDialogFocus(
    panel,
    active || phase === "ready" ? () => minimizeUpdate(true) : dismiss,
    phase === "installing",
    visible && !minimized,
  );
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    void automaticUpdate().then((value) => {
      if (alive && value && !updateSnapshot().release) offerUpdate(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!visible || !release) return null;
  if (minimized)
    return (
      <button
        className="update-background secondary"
        onClick={() => minimizeUpdate(false)}
      >
        Miry 更新 · {labels[phase]}
      </button>
    );
  const percent =
    state.total && state.total > 0
      ? Math.min(100, Math.floor((state.downloaded / state.total) * 100))
      : undefined;
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        className="settings-panel recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
      >
        <header>
          <h2 id="update-title">{labels[phase]}</h2>
        </header>
        <div className="settings-body">
          <p>Miry v{release.version}</p>
          {phase === "available" && (
            <pre className="release-notes">
              {release.notes || "新版本已发布。"}
            </pre>
          )}
          {(phase === "downloading" || phase === "verifying") && (
            <>
              <progress
                className="update-progress"
                aria-label="更新下载进度"
                max={100}
                value={percent}
              />
              <p role="status">
                {phase === "verifying"
                  ? "正在验证更新包签名…"
                  : `${percent === undefined ? "大小未知" : `${percent}%`} · ${size(state.downloaded)} / ${state.total ? size(state.total) : "未知"} · ${size(state.bytesPerSecond)}/s`}
              </p>
            </>
          )}
          {phase === "ready" && (
            <>
              <p role="status">
                更新包签名验证成功。安装将安全停止播放并退出
                Miry，保留用户配置。
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={restart}
                  onChange={(e) => setRestart(e.target.checked)}
                />{" "}
                安装后重新启动 Miry
              </label>
            </>
          )}
          {phase === "installing" && (
            <p role="status">
              正在保存播放状态并关闭播放器，随后由 Windows 安装程序接管。
            </p>
          )}
          {phase === "error" && <p role="alert">{state.error}</p>}
          <div className="update-notice-actions">
            {(phase === "available" || phase === "error") && (
              <button className="primary" onClick={() => void downloadUpdate()}>
                {phase === "error" ? "重试" : "立即更新"}
              </button>
            )}
            {phase === "ready" && (
              <button
                className="primary"
                onClick={() => void installUpdate(onPrepareInstall, restart)}
              >
                确认安装
              </button>
            )}
            <button
              className="secondary"
              disabled={phase === "installing"}
              onClick={close}
            >
              {active
                ? "后台下载"
                : phase === "ready"
                  ? "稍后安装"
                  : "暂不更新"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
