//! Main-window-only updater. No URL, key, path or installer arguments come from IPC.
use crate::{player, release, window_state};
use serde::{Deserialize, Serialize};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct Service {
    pub release: Mutex<Option<release::ReleaseInfo>>,
    ready: tokio::sync::Mutex<Option<(Update, Vec<u8>)>>,
    preparing: std::sync::atomic::AtomicBool,
    transfer: Mutex<Transfer>,
}
#[derive(Default)]
struct Transfer {
    active: Option<(String, tokio::sync::watch::Sender<bool>)>,
    cancelled: Option<String>,
    completed: Option<String>,
}
impl Transfer {
    fn begin(&mut self, id: &str) -> Result<tokio::sync::watch::Receiver<bool>, String> {
        if self.cancelled.as_deref() == Some(id) {
            return Err("更新下载已取消".into());
        }
        let (tx, rx) = tokio::sync::watch::channel(false);
        self.completed = None;
        self.active = Some((id.into(), tx));
        Ok(rx)
    }
    fn cancel(&mut self, id: &str) {
        self.cancelled = Some(id.into());
        if let Some((active, tx)) = &self.active {
            if active == id {
                let _ = tx.send(true);
            }
        }
    }
}

pub(crate) fn signing_ready(config: &tauri::Config) -> bool {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Policy {
        signing_ready: bool,
    }
    signing_config_ready(
        config,
        serde_json::from_str::<Policy>(include_str!("../updater-policy.json"))
            .is_ok_and(|policy| policy.signing_ready),
    )
}
fn signing_config_ready(config: &tauri::Config, approved: bool) -> bool {
    approved
        && config.plugins.0.get("updater").is_some_and(|value| {
            value["pubkey"]
                .as_str()
                .is_some_and(|key| !key.trim().is_empty())
                && value["requireSignedVersion"] == true
        })
}
async fn transfer_result<T>(
    cancelled: &mut tokio::sync::watch::Receiver<bool>,
    budget: Duration,
    download: impl std::future::Future<Output = Result<T, String>>,
) -> Result<T, String> {
    if *cancelled.borrow() {
        return Err("更新下载已取消".into());
    }
    tokio::select! {
        biased;
        _ = cancelled.changed() => Err("更新下载已取消".into()),
        result = tokio::time::timeout(budget, download) => {
            result.map_err(|_| "更新下载超时，请稍后重试".to_string()).and_then(|value| value)
        }
    }
}
fn require_signing(config: &tauri::Config) -> Result<(), String> {
    if signing_ready(config) {
        Ok(())
    } else {
        Err("更新暂不可用：正式更新签名尚未确认".into())
    }
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    phase: &'static str,
    downloaded: u64,
    total: Option<u64>,
    bytes_per_second: f64,
}
fn main_only(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("更新由主窗口管理".into());
    }
    Ok(())
}
fn available() -> String {
    "更新暂不可用：更新包、签名或发布元数据不匹配".into()
}
fn official_client(client: reqwest::ClientBuilder) -> reqwest::ClientBuilder {
    // Updater's reqwest uses rustls-no-provider; reuse the already locked ring provider.
    let _ = rustls::crypto::ring::default_provider().install_default();
    client.redirect(reqwest::redirect::Policy::custom(|attempt| {
        let url = attempt.url();
        if attempt.previous().len() < 5
            && url.scheme() == "https"
            && matches!(
                url.host_str(),
                Some(
                    "github.com"
                        | "release-assets.githubusercontent.com"
                        | "objects.githubusercontent.com"
                )
            )
        {
            attempt.follow()
        } else {
            attempt.stop()
        }
    }))
}
async fn fetch_signature(url: &str) -> Result<String, String> {
    let client = official_client(reqwest::Client::builder())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| available())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| available())?
        .error_for_status()
        .map_err(|_| available())?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| available())? {
        if bytes.len() + chunk.len() > 16384 {
            return Err(available());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| available())
}

pub(crate) fn validate_metadata(
    release: &release::ReleaseInfo,
    raw: &serde_json::Value,
    target: &str,
) -> Result<(), String> {
    let version = semver::Version::parse(&release.version).map_err(|_| available())?;
    if !release.newer
        || !version.pre.is_empty()
        || !version.build.is_empty()
        || !version
            .cmp_precedence(&semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap())
            .is_gt()
        || raw["version"].as_str() != Some(release.version.as_str())
        || target != "windows-x86_64"
    {
        return Err(available());
    }
    let name = format!("Miry_{}_x64-setup.exe", release.version);
    let url = release::asset_url(&release.tag_name, &name);
    let platform = &raw["platforms"][target];
    if platform["url"].as_str() != Some(url.as_str())
        || platform["signature"]
            .as_str()
            .is_none_or(|s| s.is_empty() || s.len() > 16384)
    {
        return Err(available());
    }
    for name in [&name, &format!("{name}.sig"), &"latest.json".into()] {
        if release
            .assets
            .iter()
            .filter(|a| {
                a.name == *name
                    && a.browser_download_url == release::asset_url(&release.tag_name, name)
                    && a.size > 0
            })
            .count()
            != 1
        {
            return Err(available());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn download_update(
    window: tauri::WebviewWindow,
    version: String,
    request_id: String,
    on_progress: Channel<Progress>,
) -> Result<(), String> {
    main_only(&window)?;
    let app = window.app_handle();
    let service = app.state::<Service>();
    require_signing(app.config())?;
    if request_id.len() > 64 || request_id.is_empty() {
        return Err(available());
    }
    let mut ready = service.ready.try_lock().map_err(|_| "更新任务正在进行")?;
    if service.preparing.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("正在准备安装".into());
    }
    *ready = None;
    let mut cancelled = service.transfer.lock().unwrap().begin(&request_id)?;
    let result = transfer_result(
        &mut cancelled,
        Duration::from_secs(600),
        download(app, version, &on_progress),
    )
    .await;
    let mut transfer = service.transfer.lock().unwrap();
    // Cancellation may arrive just as the last chunk/signature finishes.
    if *cancelled.borrow() {
        transfer.active = None;
        return Err("更新下载已取消".into());
    }
    transfer.active = None;
    match result {
        Ok(update) => {
            *ready = Some(update);
            transfer.completed = Some(request_id);
        }
        Err(error) => return Err(error),
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_update_download(
    window: tauri::WebviewWindow,
    request_id: String,
) -> Result<(), String> {
    main_only(&window)?;
    if request_id.is_empty() || request_id.len() > 64 {
        return Err(available());
    }
    let service = window.state::<Service>();
    let mut transfer = service.transfer.lock().unwrap();
    transfer.cancel(&request_id);
    if transfer.completed.as_deref() == Some(request_id.as_str()) {
        // A late cancel must also discard already verified bytes for that request.
        if let Ok(mut ready) = service.ready.try_lock() {
            *ready = None;
        }
    }
    Ok(())
}

async fn download(
    app: &tauri::AppHandle,
    version: String,
    on_progress: &Channel<Progress>,
) -> Result<(Update, Vec<u8>), String> {
    let service = app.state::<Service>();
    let release = service
        .release
        .lock()
        .unwrap()
        .clone()
        .filter(|r| r.version == version)
        .ok_or_else(available)?;
    let config = app.config();
    if config
        .plugins
        .0
        .get("updater")
        .and_then(|c| c["pubkey"].as_str())
        .is_none_or(str::is_empty)
    {
        return Err("更新暂不可用：尚未配置正式更新签名公钥".into());
    }
    // Pin metadata to the Release already checked, avoiding a latest/tag race.
    let updater = app
        .updater_builder()
        .endpoints(vec![release::asset_url(&release.tag_name, "latest.json")
            .parse()
            .map_err(|_| available())?])
        .map_err(|_| available())?
        .timeout(Duration::from_secs(600))
        .configure_client(official_client)
        .build()
        .map_err(|_| available())?;
    let update = tokio::time::timeout(Duration::from_secs(15), updater.check())
        .await
        .map_err(|_| "更新暂不可用：元数据请求超时")?
        .map_err(|_| available())?
        .ok_or_else(available)?;
    let target = format!("windows-{}", std::env::consts::ARCH);
    validate_metadata(&release, &update.raw_json, &target)?;
    let platform = &update.raw_json["platforms"][&target];
    if update.version != release.version
        || update.download_url.as_str() != platform["url"].as_str().unwrap_or_default()
        || Some(update.signature.as_str()) != platform["signature"].as_str()
    {
        return Err(available());
    }
    let signature = fetch_signature(&release::asset_url(
        &release.tag_name,
        &format!("Miry_{}_x64-setup.exe.sig", release.version),
    ))
    .await?;
    if signature.trim() != update.signature.trim() {
        return Err(available());
    }
    let started = Instant::now();
    let counters = Mutex::new((0u64, None));
    let mut last_emit = started;
    let mut verifying = false;
    let bytes = update
        .download(
            |chunk, length| {
                let mut counters = counters.lock().unwrap();
                counters.0 += chunk as u64;
                counters.1 = length.filter(|n| *n > 0);
                let (downloaded, total) = *counters;
                if last_emit == started || last_emit.elapsed() >= Duration::from_millis(100) {
                    let _ = on_progress.send(Progress {
                        phase: "downloading",
                        downloaded,
                        total,
                        bytes_per_second: downloaded as f64
                            / started.elapsed().as_secs_f64().max(0.001),
                    });
                    last_emit = Instant::now();
                }
            },
            || {
                verifying = true;
                let (downloaded, total) = *counters.lock().unwrap();
                let _ = on_progress.send(Progress {
                    phase: "verifying",
                    downloaded,
                    total,
                    bytes_per_second: 0.0,
                });
            },
        )
        .await;
    let bytes = bytes.map_err(|_| {
        if verifying {
            "验证失败，签名无效或版本不匹配，已停止安装"
        } else {
            "下载失败，重试"
        }
    })?;
    let expected = release
        .assets
        .iter()
        .find(|a| a.name == format!("Miry_{}_x64-setup.exe", release.version))
        .ok_or_else(available)?
        .size;
    let (downloaded, total) = *counters.lock().unwrap();
    if bytes.len() as u64 != expected || total.is_some_and(|n| n != downloaded) {
        return Err("验证失败：更新包大小不匹配".into());
    }
    Ok((update, bytes))
}

#[tauri::command]
pub async fn prepare_update_install(window: tauri::WebviewWindow) -> Result<(), String> {
    main_only(&window)?;
    require_signing(window.app_handle().config())?;
    let service = window.state::<Service>();
    let ready = service.ready.try_lock().map_err(|_| "更新任务正在进行")?;
    if ready.is_none() {
        return Err("更新包尚未通过验证".into());
    }
    if !player::begin_shutdown(&window.state::<player::Player>()) {
        return Err("应用正在退出".into());
    }
    service
        .preparing
        .store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
#[tauri::command]
pub fn cancel_update_install(window: tauri::WebviewWindow) -> Result<(), String> {
    main_only(&window)?;
    let service = window.state::<Service>();
    let _ready = service.ready.try_lock().map_err(|_| "安装交接正在进行")?;
    if service
        .preparing
        .swap(false, std::sync::atomic::Ordering::SeqCst)
    {
        player::cancel_shutdown(&window.state::<player::Player>());
        // A real close may have arrived while the updater owned the shutdown gate.
        // Re-enter the existing close handler after releasing our gate.
        if window.state::<crate::tray::TrayState>().is_exiting() {
            window.close().map_err(|_| "无法继续安全退出")?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "updater_tests.rs"]
mod tests;
#[tauri::command]
pub async fn install_update(window: tauri::WebviewWindow, restart: bool) -> Result<(), String> {
    main_only(&window)?;
    require_signing(window.app_handle().config())?;
    let service = window.state::<Service>();
    let mut ready = service.ready.try_lock().map_err(|_| "更新任务正在进行")?;
    if !service.preparing.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("尚未安全停止播放".into());
    }
    if window.state::<crate::tray::TrayState>().is_exiting() {
        return Err("应用正在退出，已停止安装".into());
    }
    if ready.is_none() {
        return Err("更新包尚未通过验证".into());
    }
    // The frontend already awaited queue.stop(), including local final-position persistence.
    // Native stop is a final barrier against delayed starts and orphaned mpv.
    crate::player_ui::dispose(window.app_handle())?;
    let snapshot = player::stop(&window.state::<player::Player>(), |_| {}).await?;
    crate::final_save::persist(&window.as_ref().window(), &snapshot)
        .await
        .map_err(|_| "最终播放进度未能保存，已停止安装")?;
    if window
        .is_fullscreen()
        .map_err(|_| "无法确认窗口状态，已停止安装")?
    {
        player::set_fullscreen(&window, false)?;
    }
    window_state::remember(&window.as_ref().window());
    if let Ok(path) = crate::recovery::path(window.app_handle()) {
        crate::recovery::clear(&path);
    }
    if window.state::<crate::tray::TrayState>().is_exiting() {
        return Err("应用正在退出，已停止安装".into());
    }
    let (update, bytes) = ready.take().ok_or("更新包尚未通过验证")?;
    tauri::async_runtime::spawn_blocking(move || {
        update.restart_after_install(restart).install(bytes)
    })
    .await
    .map_err(|_| "安装交接失败，请重新下载后重试")?
    .map_err(|_| "安装交接失败，请重新下载后重试".into())
}
