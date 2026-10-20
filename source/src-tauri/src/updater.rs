//! Main-window-only updater. No URL, key, path or installer arguments come from IPC.
use crate::{player, release, window_state};
use serde::Serialize;
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
    on_progress: Channel<Progress>,
) -> Result<(), String> {
    main_only(&window)?;
    let app = window.app_handle();
    let service = app.state::<Service>();
    let mut ready = service.ready.try_lock().map_err(|_| "更新任务正在进行")?;
    if service.preparing.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("正在准备安装".into());
    }
    *ready = None;
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
    *ready = Some((update, bytes));
    Ok(())
}

#[tauri::command]
pub async fn prepare_update_install(window: tauri::WebviewWindow) -> Result<(), String> {
    main_only(&window)?;
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
    }
    Ok(())
}

#[cfg(test)]
#[path = "updater_tests.rs"]
mod tests;
#[tauri::command]
pub async fn install_update(window: tauri::WebviewWindow, restart: bool) -> Result<(), String> {
    main_only(&window)?;
    let service = window.state::<Service>();
    let mut ready = service.ready.try_lock().map_err(|_| "更新任务正在进行")?;
    if !service.preparing.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("尚未安全停止播放".into());
    }
    let (update, bytes) = ready.take().ok_or("更新包尚未通过验证")?;
    // The frontend already awaited queue.stop(), including local final-position persistence.
    // Native stop is a final barrier against delayed starts and orphaned mpv.
    crate::player_ui::dispose(window.app_handle())?;
    player::stop(&window.state::<player::Player>(), |_| {}).await?;
    window_state::remember(&window.as_ref().window());
    if let Ok(path) = crate::recovery::path(window.app_handle()) {
        crate::recovery::clear(&path);
    }
    tauri::async_runtime::spawn_blocking(move || {
        update.restart_after_install(restart).install(bytes)
    })
    .await
    .map_err(|_| "安装交接失败，请重新下载后重试")?
    .map_err(|_| "安装交接失败，请重新下载后重试".into())
}
