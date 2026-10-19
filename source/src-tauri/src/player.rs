use crate::video_fit::VideoFit;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};
use tauri_plugin_http::reqwest;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::{mpsc, oneshot, watch, Mutex},
    time::{timeout, Instant},
};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Launch {
    #[serde(default)]
    server_id: String,
    #[serde(skip)]
    recovery_path: Option<PathBuf>,
    server: String,
    user_id: String,
    token: String,
    device_id: String,
    item_id: String,
    title: String,
    source_id: String,
    play_session_id: String,
    url: String,
    start_seconds: f64,
    audio_index: Option<i64>,
    subtitle_index: Option<i64>,
    #[serde(default = "default_subtitle_position")]
    subtitle_position: f64,
    #[serde(default = "default_subtitle_scale")]
    subtitle_scale: f64,
    #[serde(default, deserialize_with = "crate::video_fit::deserialize_preference")]
    video_fit: VideoFit,
    subtitles: Vec<Subtitle>,
    play_method: String,
    #[serde(default)]
    volume: Option<f64>,
    #[serde(default)]
    fullscreen: bool,
    #[serde(default = "default_hardware_decode")]
    hardware_decode: bool,
    #[serde(default)]
    embedded: bool,
    #[serde(default)]
    quality: Option<crate::quality::Quality>,
    #[serde(default)]
    media_quality: Value,
    #[serde(default = "crate::shortcuts::defaults")]
    shortcuts: HashMap<String, String>,
    #[serde(skip)]
    requested_output: String,
    #[serde(skip)]
    window_id: Option<u32>,
    #[serde(skip)]
    ui_events: Option<mpsc::Sender<UiEvent>>,
}
fn default_hardware_decode() -> bool {
    true
}
#[derive(Clone, Deserialize)]
struct Subtitle {
    url: String,
    index: i64,
    title: String,
    language: String,
}
fn default_subtitle_position() -> f64 {
    100.0
}
fn default_subtitle_scale() -> f64 {
    1.0
}
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    video_fit: VideoFit,
    #[serde(skip)]
    clock_epoch: u64,
    sync_timeouts: u32,
    play_method: String,
    input_rate_bps: Option<f64>,
    double_click_ms: u32,
    pub active: bool,
    pub loaded: bool,
    title: String,
    position: f64,
    duration: f64,
    paused: bool,
    volume: f64,
    muted: bool,
    tracks: Vec<Value>,
    error: String,
    sync_error: String,
    finished: bool,
    sync_complete: bool,
    item_id: String,
    play_session_id: String,
    speed: f64,
    subtitle_delay: f64,
    subtitle_position: f64,
    ontop: bool,
    fullscreen: bool,
    secondary_subtitle: Option<i64>,
    subtitle_scale: f64,
    embedded: bool,
    buffer_seconds: f64,
    buffering: bool,
    audio_delay: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    loop_a: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    loop_b: Option<f64>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    network_details: Vec<String>,
    load_elapsed_ms: u64,
    media_quality: Value,
    video_params: Value,
    video_output: Value,
    windows_hdr: crate::display::DisplayColor,
    output_policy: String,
    requested_output_policy: String,
    audio_device: String,
    audio_output: Value,
    audio_fallback: bool,
    renderer: String,
    hardware_decoder: String,
    shortcuts: HashMap<String, String>,
}
type Reply = oneshot::Sender<Result<Value, String>>;
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Clock {
    position: f64,
    sampled_at: u64,
    paused: bool,
    speed: f64,
    active: bool,
    loaded: bool,
    buffering: bool,
    session: String,
}
#[tauri::command]
pub async fn player_clock(player: tauri::State<'_, Player>) -> Result<Clock, String> {
    let guard = player.0.lock().await;
    let Some(handle) = guard.as_ref() else {
        return Ok(Clock::default());
    };
    let tx = handle.tx.clone();
    let snapshot = handle.snapshot.clone();
    drop(guard);
    let position = if snapshot.borrow().active && snapshot.borrow().loaded {
        rpc(&tx, json!(["get_property", "time-pos"]))
            .await?
            .as_f64()
    } else {
        None
    };
    let s = snapshot.borrow();
    Ok(Clock {
        position: position.unwrap_or(s.position),
        sampled_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        paused: s.paused,
        speed: s.speed,
        active: s.active,
        loaded: s.loaded,
        buffering: s.buffering,
        session: format!("{}:{}", s.play_session_id, s.clock_epoch),
    })
}
struct Rpc {
    command: Value,
    reply: Reply,
}
struct Handle {
    #[cfg(windows)]
    _job: crate::child_job::Job,
    tx: mpsc::Sender<Rpc>,
    snapshot: watch::Receiver<Snapshot>,
    done: watch::Receiver<bool>,
    shutdown: watch::Sender<bool>,
    process_done: watch::Receiver<bool>,
    snapshots: Arc<watch::Sender<Snapshot>>,
    requested_output: String,
}
#[derive(Default)]
pub struct Player(
    Mutex<Option<Handle>>,
    pub std::sync::Mutex<Option<mpsc::Sender<UiEvent>>>,
    Mutex<()>,
    AtomicBool,
);
pub fn begin_shutdown(player: &Player) -> bool {
    !player.3.swap(true, Ordering::SeqCst)
}
pub enum UiEvent {
    Key(String),
    ToggleFullscreen,
    ExitFullscreen,
    ToggleControls,
    RevealControls,
}
pub fn set_fullscreen(window: &tauri::WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|e| e.to_string())?;
    window
        .emit("player-fullscreen", fullscreen)
        .map_err(|e| e.to_string())
}

pub(crate) fn mpv_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|_| "无法确定程序目录")?;
    let bundled = exe
        .parent()
        .ok_or("无法确定程序目录")?
        .join("tools/mpv/mpv.exe");
    if bundled.is_file() {
        return Ok(bundled);
    }
    #[cfg(debug_assertions)]
    {
        let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("tools/mpv/mpv.exe");
        if development.is_file() {
            return Ok(development);
        }
    }
    Err("找不到随 Miry 安装的 mpv，请重新安装 Miry。".into())
}
fn validate(launch: &Launch) -> Result<(), String> {
    crate::shortcuts::validate(&launch.shortcuts)?;
    if let Some(quality) = &launch.quality {
        quality.validate()?;
    }
    let server = reqwest::Url::parse(&launch.server).map_err(|_| "服务器地址无效")?;
    let valid = |url: &str| -> bool {
        reqwest::Url::parse(url)
            .map(|u| {
                ["http", "https"].contains(&u.scheme())
                    && u.origin() == server.origin()
                    && u.username().is_empty()
                    && u.password().is_none()
            })
            .unwrap_or(false)
    };
    if !valid(&launch.server)
        || !valid(&launch.url)
        || launch.subtitles.iter().any(|s| !valid(&s.url))
    {
        return Err("播放地址必须来自当前 Emby 服务器。".into());
    }
    if launch.token.contains(['\r', '\n', ',', '"'])
        || launch.device_id.contains(['\r', '\n', '"'])
        || !launch.start_seconds.is_finite()
        || launch.start_seconds < 0.0
        || !launch.subtitle_position.is_finite()
        || !(0.0..=100.0).contains(&launch.subtitle_position)
        || !launch.subtitle_scale.is_finite()
        || !(0.6..=1.8).contains(&launch.subtitle_scale)
        || launch
            .volume
            .is_some_and(|n| !n.is_finite() || !(0.0..=100.0).contains(&n))
        || !["DirectPlay", "DirectStream", "Transcode"].contains(&launch.play_method.as_str())
    {
        return Err("播放参数无效。".into());
    }
    Ok(())
}
async fn rpc(tx: &mpsc::Sender<Rpc>, command: Value) -> Result<Value, String> {
    let (reply, receive) = oneshot::channel();
    timeout(Duration::from_secs(4), async {
        tx.send(Rpc { command, reply })
            .await
            .map_err(|_| "播放器已停止".to_string())?;
        receive.await.map_err(|_| "播放器连接已关闭".to_string())?
    })
    .await
    .map_err(|_| "播放器响应超时".to_string())?
}

#[tauri::command]
pub async fn player_status(
    player: tauri::State<'_, Player>,
    window: tauri::WebviewWindow,
) -> Result<Snapshot, String> {
    let guard = player.0.lock().await;
    let Some(h) = guard.as_ref() else {
        return Ok(Snapshot::default());
    };
    let mut s = h.snapshot.borrow().clone();
    s.sync_complete = *h.done.borrow();
    if s.embedded {
        s.windows_hdr = crate::display::window_color(&window);
        s.ontop = window.is_always_on_top().unwrap_or(false);
        s.fullscreen = window.is_fullscreen().unwrap_or(false);
    }
    let policy = crate::quality::managed_hdr(&h.requested_output, s.windows_hdr.hdr);
    if h.requested_output == "source" && s.active && s.loaded && s.output_policy != policy {
        if rpc(
            &h.tx,
            json!([
                "set_property",
                "target-colorspace-hint-mode",
                if policy == "source" {
                    "source"
                } else {
                    "target"
                }
            ]),
        )
        .await
        .is_ok()
        {
            h.snapshots.send_modify(|v| v.output_policy = policy.into());
            s.output_policy = policy.into();
        }
    }
    Ok(s)
}
#[tauri::command]
pub async fn player_start(
    player: tauri::State<'_, Player>,
    window: tauri::WebviewWindow,
    mut launch: Launch,
) -> Result<(), String> {
    validate(&launch)?;
    if let Some(quality) = launch.quality.as_mut() {
        quality.directory = Some(crate::quality::directory(window.app_handle())?);
        launch.requested_output = quality.hdr.clone();
        let hdr = if launch.embedded {
            crate::display::window_color(&window).hdr
        } else {
            None
        };
        quality.hdr = crate::quality::managed_hdr(&quality.hdr, hdr).into();
    }
    let _operation = player.2.lock().await;
    if player.3.load(Ordering::SeqCst) {
        return Err("应用正在退出，无法开始播放。".into());
    }
    stop_inner(&player).await?;
    let mut guard = player.0.lock().await;
    let path = mpv_path()?;
    launch.ui_events = player.1.lock().map_err(|_| "窗口事件通道不可用")?.clone();
    launch.recovery_path = Some(crate::recovery::path(window.app_handle())?);
    if launch.embedded {
        if launch.fullscreen {
            set_fullscreen(&window, true)?;
        }
        launch.window_id = Some(crate::surface::ensure(window.clone()).await?);
    }
    match start(path, launch, false).await {
        Ok(handle) => *guard = Some(handle),
        Err(error) => {
            let _ = set_fullscreen(&window, false);
            return Err(error);
        }
    }
    Ok(())
}
#[tauri::command]
pub async fn player_control(
    player: tauri::State<'_, Player>,
    window: tauri::WebviewWindow,
    action: String,
    value: Option<f64>,
) -> Result<(), String> {
    let snapshot = player
        .0
        .lock()
        .await
        .as_ref()
        .map(|h| h.snapshot.borrow().clone())
        .unwrap_or_default();
    if snapshot.embedded {
        match action.as_str() {
            "fullscreen" => {
                let fullscreen = match value {
                    Some(0.0) => false,
                    Some(1.0) => true,
                    _ => !window.is_fullscreen().map_err(|e| e.to_string())?,
                };
                return set_fullscreen(&window, fullscreen);
            }
            "show" => {
                window.show().map_err(|e| e.to_string())?;
                window.unminimize().map_err(|e| e.to_string())?;
                return window.set_focus().map_err(|e| e.to_string());
            }
            "ontop" => {
                return window
                    .set_always_on_top(!window.is_always_on_top().map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())
            }
            _ => {}
        }
    }
    let tx = player
        .0
        .lock()
        .await
        .as_ref()
        .map(|h| h.tx.clone())
        .ok_or("播放器尚未启动")?;
    let n = value.unwrap_or(0.0);
    if !n.is_finite() {
        return Err("控制参数无效".into());
    }
    if action == "clearLoop" {
        rpc(&tx, json!(["set_property", "ab-loop-a", "no"])).await?;
        rpc(&tx, json!(["set_property", "ab-loop-b", "no"])).await?;
        return Ok(());
    }
    if action == "subtitle" && n >= -1.0 && n.fract() == 0.0 {
        return select_primary_subtitle(&tx, n as i64).await;
    }
    if action == "secondarySubtitle" && n >= 0.0 {
        let primary = rpc(&tx, json!(["get_property", "sid"])).await?;
        if primary.as_i64() == Some(n as i64) {
            return Err("主字幕和次字幕不能使用同一轨道".into());
        }
    }
    let command = match action.as_str() {
        "pause" => json!(["cycle", "pause"]),
        "setPaused" if [0.0, 1.0].contains(&n) => json!(["set_property", "pause", n == 1.0]),
        "mute" => json!(["cycle", "mute"]),
        "seek" if n >= 0.0 => json!(["seek", n, "absolute+exact"]),
        "volume" if (0.0..=100.0).contains(&n) => json!(["set_property", "volume", n]),
        "speed" if (0.5..=3.0).contains(&n) => json!(["set_property", "speed", n]),
        "subtitleDelay" if (-30.0..=30.0).contains(&n) => json!(["set_property", "sub-delay", n]),
        "subtitlePosition" if (0.0..=100.0).contains(&n) => json!(["set_property", "sub-pos", n]),
        "audioDelay" if (-10.0..=10.0).contains(&n) => json!(["set_property", "audio-delay", n]),
        "loopA" if n >= 0.0 => json!(["set_property", "ab-loop-a", n]),
        "loopB" if snapshot.loop_a.is_some_and(|a| n > a) => {
            json!(["set_property", "ab-loop-b", n])
        }
        "fullscreen" => json!(["cycle", "fullscreen"]),
        "show" => json!(["set_property", "window-minimized", false]),
        "ontop" => json!(["cycle", "ontop"]),
        "subtitleScale" if (0.6..=1.8).contains(&n) => json!(["set_property", "sub-scale", n]),
        "secondarySubtitle" if n >= -1.0 && n.fract() == 0.0 => json!([
            "set_property",
            "secondary-sid",
            if n < 0.0 {
                json!("no")
            } else {
                json!(n as i64)
            }
        ]),
        "audio" | "subtitle" if n >= -1.0 && n.fract() == 0.0 => json!([
            "set_property",
            if action == "audio" { "aid" } else { "sid" },
            if n < 0.0 {
                json!("no")
            } else {
                json!(n as i64)
            }
        ]),
        _ => return Err("不支持此播放器操作".into()),
    };
    rpc(&tx, command).await?;
    Ok(())
}
#[tauri::command]
pub async fn player_video_fit(
    player: tauri::State<'_, Player>,
    mode: VideoFit,
    play_session_id: String,
) -> Result<VideoFit, String> {
    set_video_fit(&player, mode, &play_session_id).await
}

async fn set_video_fit(player: &Player, mode: VideoFit, session: &str) -> Result<VideoFit, String> {
    // Share start/stop serialization, and bind all property writes to this handle.
    let _operation = player.2.lock().await;
    let guard = player.0.lock().await;
    let handle = guard.as_ref().ok_or("播放器尚未启动")?;
    let snapshot = handle.snapshot.borrow().clone();
    if player.3.load(Ordering::SeqCst)
        || !snapshot.active
        || !snapshot.loaded
        || session.is_empty()
        || snapshot.play_session_id != session
    {
        return Err("播放会话已改变，请重试。".into());
    }
    apply_video_fit(&handle.tx, mode).await?;
    if player.3.load(Ordering::SeqCst) || !handle.snapshot.borrow().active {
        return Err("播放会话已结束。".into());
    }
    handle.snapshots.send_modify(|s| s.video_fit = mode);
    Ok(mode)
}

async fn apply_video_fit(tx: &mpsc::Sender<Rpc>, mode: VideoFit) -> Result<(), String> {
    let mut previous = Vec::new();
    // Bound the whole transaction so a slow IPC cannot hold start/stop ownership
    // for one timeout per property. Rollback has its own finite budget below.
    let result = timeout(Duration::from_secs(4), async {
        for (name, _) in mode.properties() {
            previous.push((name, rpc(tx, json!(["get_property", name])).await?));
        }
        for (name, value) in mode.properties() {
            rpc(tx, json!(["set_property", name, value])).await?;
        }
        for (name, value) in mode.properties() {
            let actual = rpc(tx, json!(["get_property", name])).await?;
            if actual != value && !(actual.as_f64().is_some() && actual.as_f64() == value.as_f64())
            {
                return Err("画面模式未生效，请重试。".into());
            }
        }
        Ok(())
    })
    .await
    .unwrap_or_else(|_| Err("画面模式切换超时，请重试。".into()));
    if result.is_err() {
        // Best effort rollback only on the captured session, never a new player.
        let _ = timeout(Duration::from_secs(4), async {
            for (name, value) in previous {
                if rpc(tx, json!(["set_property", name, value])).await.is_err() {
                    break;
                }
            }
        })
        .await;
    }
    result
}

async fn select_primary_subtitle(tx: &mpsc::Sender<Rpc>, id: i64) -> Result<(), String> {
    let secondary = rpc(tx, json!(["get_property", "secondary-sid"])).await?;
    if id >= 0 && secondary.as_i64() == Some(id) {
        rpc(tx, json!(["set_property", "secondary-sid", "no"])).await?;
    }
    rpc(
        tx,
        json!([
            "set_property",
            "sid",
            if id < 0 { json!("no") } else { json!(id) }
        ]),
    )
    .await?;
    Ok(())
}
#[tauri::command]
pub async fn player_key(
    player: tauri::State<'_, Player>,
    window: tauri::WebviewWindow,
    code: String,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("快捷键由主窗口管理。".into());
    }
    let key = crate::shortcuts::mpv_key(&code).ok_or("按键无效")?;
    let tx = player
        .0
        .lock()
        .await
        .as_ref()
        .map(|h| h.tx.clone())
        .ok_or("播放器尚未启动")?;
    rpc(&tx, json!(["keypress", key])).await?;
    Ok(())
}
#[tauri::command]
pub async fn player_stop(
    player: tauri::State<'_, Player>,
    window: tauri::WebviewWindow,
) -> Result<Snapshot, String> {
    crate::player_ui::dispose(window.app_handle())?;
    let state = stop(&player, |sample| {
        let _ = window.emit("player-final-snapshot", sample);
    })
    .await?;
    let _ = window.emit("player-final-snapshot", &state);
    if !state.play_session_id.is_empty() {
        if let Ok(path) = crate::recovery::path(window.app_handle()) {
            crate::recovery::clear(&path);
        }
    }
    if window.is_fullscreen().unwrap_or(false) {
        set_fullscreen(&window, false)?;
    }
    Ok(state)
}
pub async fn stop(player: &Player, on_sample: impl FnOnce(&Snapshot)) -> Result<Snapshot, String> {
    let _operation = player.2.lock().await;
    stop_inner_with_sample(player, on_sample).await
}
async fn wait_done(done: &mut watch::Receiver<bool>) {
    while !*done.borrow_and_update() {
        if done.changed().await.is_err() {
            break;
        }
    }
}
async fn stop_handle(handle: &mut Handle) -> Result<Snapshot, String> {
    stop_handle_with_sample(handle, |_| {}).await
}
async fn stop_handle_with_sample(
    handle: &mut Handle,
    on_sample: impl FnOnce(&Snapshot),
) -> Result<Snapshot, String> {
    if handle.snapshot.borrow().active {
        // Freeze and sample locally. Network reporting never keeps the child alive.
        let _ = timeout(
            Duration::from_millis(250),
            rpc(&handle.tx, json!(["set_property", "pause", true])),
        )
        .await;
        if let Ok(Ok(value)) = timeout(
            Duration::from_millis(250),
            rpc(&handle.tx, json!(["get_property", "time-pos"])),
        )
        .await
        {
            if let Some(position) = value.as_f64().filter(|n| n.is_finite() && *n >= 0.0) {
                handle.snapshots.send_modify(|s| s.position = position);
            }
        }
        let _ = handle.shutdown.send(true);
    }
    timeout(Duration::from_secs(2), wait_done(&mut handle.process_done))
        .await
        .map_err(|_| "播放器进程未能结束，请重试退出。".to_string())?;
    let mut sampled = handle.snapshot.borrow().clone();
    sampled.sync_complete = *handle.done.borrow();
    // Persist the frozen final sample before waiting on any remaining HTTP reports.
    on_sample(&sampled);
    // Final reports have their own bounded deadline and always signal completion.
    timeout(Duration::from_secs(14), wait_done(&mut handle.done))
        .await
        .map_err(|_| "最终进度同步未完成，播放器已停止。".to_string())?;
    let mut state = handle.snapshot.borrow().clone();
    state.sync_complete = *handle.done.borrow();
    Ok(state)
}
async fn stop_inner(player: &Player) -> Result<Snapshot, String> {
    stop_inner_with_sample(player, |_| {}).await
}
async fn stop_inner_with_sample(
    player: &Player,
    on_sample: impl FnOnce(&Snapshot),
) -> Result<Snapshot, String> {
    let mut guard = player.0.lock().await;
    match guard.as_mut() {
        Some(handle) => stop_handle_with_sample(handle, on_sample).await,
        None => Ok(Snapshot::default()),
    }
}

#[cfg(windows)]
async fn start(path: PathBuf, launch: Launch, headless: bool) -> Result<Handle, String> {
    use tokio::net::windows::named_pipe::ClientOptions;
    let pipe = format!(r"\\.\pipe\miry-{}", uuid::Uuid::new_v4());
    let mut command = Command::new(path);
    let quality = launch
        .quality
        .clone()
        .unwrap_or_else(|| crate::quality::Quality {
            hwdec: if launch.hardware_decode {
                "auto-safe".into()
            } else {
                "no".into()
            },
            ..Default::default()
        });
    command.arg("--no-config").args(quality.arguments()?);
    if launch.ui_events.is_some() {
        command.arg("--input-default-bindings=no");
    }
    command
        .args([
            "--idle=yes",
            "--keep-open=no",
            "--force-window=no",
            "--demuxer=lavf",
            "--ytdl=no",
            "--load-scripts=no",
            "--sub-ass-override=no",
            "--network-timeout=15",
            "--force-media-title=Miry",
        ])
        .arg(if launch.fullscreen {
            "--fullscreen=yes"
        } else {
            "--fullscreen=no"
        })
        .arg(format!("--volume={}", launch.volume.unwrap_or(75.0)))
        .arg(format!("--input-ipc-server={pipe}"))
        .arg("--title=Miry · Player")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    // Suppress the console window; mpv creates its own video window when media loads.
    command.creation_flags(0x08000000);
    if headless {
        command.arg("--ao=null");
        if launch.window_id.is_none() {
            command.arg("--vo=null");
        }
    }
    if let Some(id) = launch.window_id {
        command.arg(format!("--wid={id}")).args([
            "--osc=no",
            "--input-cursor=yes",
            "--cursor-autohide=1000",
            "--fullscreen=no",
        ]);
    }
    command.args([
        "--cache=yes",
        "--demuxer-max-bytes=64MiB",
        "--demuxer-max-back-bytes=16MiB",
    ]);
    let mut child = command
        .spawn()
        .map_err(|_| "无法启动 mpv 播放器".to_string())?;
    let job = crate::child_job::attach(&child)?;
    let connected = timeout(Duration::from_secs(8), async {
        loop {
            if child
                .try_wait()
                .map_err(|_| "无法检查播放器进程")?
                .is_some()
            {
                return Err("mpv 启动后退出".to_string());
            }
            if let Ok(client) = ClientOptions::new().open(&pipe) {
                return Ok(client);
            }
            tokio::time::sleep(Duration::from_millis(80)).await;
        }
    })
    .await
    .map_err(|_| "连接 mpv 超时".to_string())??;
    let (reader, writer) = tokio::io::split(connected);
    let (tx, rx) = mpsc::channel(24);
    let (snap_tx, snapshot) = watch::channel(Snapshot {
        play_method: launch.play_method.clone(),
        double_click_ms: unsafe {
            windows_sys::Win32::UI::Input::KeyboardAndMouse::GetDoubleClickTime()
        },
        active: true,
        title: launch.title.clone(),
        item_id: launch.item_id.clone(),
        play_session_id: launch.play_session_id.clone(),
        position: launch.start_seconds,
        volume: launch.volume.unwrap_or(75.0),
        speed: 1.0,
        embedded: launch.window_id.is_some(),
        media_quality: launch.media_quality.clone(),
        output_policy: quality.hdr.clone(),
        requested_output_policy: if launch.requested_output.is_empty() {
            quality.hdr.clone()
        } else {
            launch.requested_output.clone()
        },
        ..Default::default()
    });
    let (done_tx, done) = watch::channel(false);
    let (shutdown, stopping) = watch::channel(false);
    let (process_tx, process_done) = watch::channel(false);
    let snap_tx = Arc::new(snap_tx);
    tokio::spawn(report_loop(
        launch.clone(),
        snapshot.clone(),
        snap_tx.clone(),
        done_tx,
    ));
    tokio::spawn(run_ipc(
        child,
        reader,
        writer,
        rx,
        snap_tx.clone(),
        launch.clone(),
        stopping,
        process_tx,
    ));
    let mut handle = Handle {
        _job: job,
        tx,
        snapshot,
        done,
        shutdown,
        process_done,
        snapshots: snap_tx,
        requested_output: if launch.requested_output.is_empty() {
            quality.hdr.clone()
        } else {
            launch.requested_output.clone()
        },
    };
    let result = async {
        apply_video_fit(&handle.tx, launch.video_fit).await?;
        handle.snapshots.send_modify(|s| s.video_fit = launch.video_fit);
        rpc(&handle.tx, json!(["request_log_messages", "warn"])).await?;
        handle.snapshots.send_modify(|s|s.shortcuts=launch.shortcuts.clone());
        if launch.ui_events.is_some() {
            for key in ["PLAY","PAUSE","PLAYPAUSE","STOP","NEXT","PREV"] {
                rpc(&handle.tx,json!(["keybind",key,"ignore"])).await?;
            }
            // Configured Miry keys have one UI owner. Other input.conf keys survive.
            for code in launch.shortcuts.values().filter(|c|!c.is_empty()) {
                if let Some(key)=crate::shortcuts::mpv_key(code){rpc(&handle.tx,json!(["keybind",key,format!("script-message miry-key {code}")])).await?;}
            }
        }else{
        for (key, binding) in [
            ("SPACE", "cycle pause"),
            ("LEFT", "seek -10"),
            ("RIGHT", "seek 10"),
        ] {
            rpc(&handle.tx, json!(["keybind", key, binding])).await?;
        }
        }
        if launch.window_id.is_some() {
            for (key, binding) in [
                ("h", "script-message miry-toggle-controls"),
                ("TAB", "script-message miry-show-controls"),
            ] {
                rpc(&handle.tx, json!(["keybind", key, binding])).await?;
            }
            rpc(
                &handle.tx,
                json!(["keybind", "ESC", "script-message miry-exit-fullscreen"]),
            )
            .await?;
        }
        rpc(
            &handle.tx,
            json!([
                "set_property",
                "http-header-fields",
                [format!("Authorization: Emby Client=\"Miry\", Device=\"Windows\", DeviceId=\"{}\", Version=\"{}\", Token=\"{}\"", launch.device_id, env!("CARGO_PKG_VERSION"), launch.token)]
            ]),
        )
        .await?;
        for (i, property) in [
            "time-pos",
            "duration",
            "pause",
            "volume",
            "mute",
            "track-list",
            "speed",
            "sub-delay",
            "sub-pos",
            "ontop",
            "fullscreen",
            "secondary-sid",
            "sub-scale",
            "demuxer-cache-duration",
            "cache-speed",
            "paused-for-cache",
            "audio-delay",
            "ab-loop-a",
            "ab-loop-b",
            "video-params",
            "video-target-params",
            "audio-out-params",
            "audio-device",
            "audio-device-list",
            "current-ao",
            "current-vo",
            "hwdec-current",
        ]
        .iter()
        .enumerate()
        {
            rpc(&handle.tx, json!(["observe_property", i + 1, property])).await?;
        }
        rpc(
            &handle.tx,
            json!(["loadfile",launch.url,"replace",-1,{"start":launch.start_seconds.to_string()}]),
        )
        .await?;
        Ok::<(), String>(())
    }
    .await;
    if let Err(e) = result {
        let _ = stop_handle(&mut handle).await;
        return Err(e);
    }
    Ok(handle)
}
#[cfg(not(windows))]
async fn start(_path: PathBuf, _launch: Launch, _headless: bool) -> Result<Handle, String> {
    Err("当前播放器仅支持 Windows".into())
}

async fn write_command<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    command: Value,
    id: u64,
) -> Result<(), String> {
    let data = json!({"command":command,"request_id":id}).to_string() + "\n";
    writer
        .write_all(data.as_bytes())
        .await
        .map_err(|_| "写入播放器命令失败".to_string())
}
async fn recover_pcm<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    serial: &mut u64,
    snapshots: &watch::Sender<Snapshot>,
) {
    let selected = snapshots
        .borrow()
        .tracks
        .iter()
        .find(|t| t["type"] == "audio" && t["selected"] == true)
        .map(|t| t["id"].clone());
    snapshots.send_modify(|s| s.audio_fallback = true);
    for (property, value) in [("audio-spdif", json!("")), ("audio-device", json!("auto"))] {
        *serial += 1;
        let _ = write_command(writer, json!(["set_property", property, value]), *serial).await;
    }
    if let Some(id) = selected {
        for value in [json!("no"), id] {
            *serial += 1;
            let _ = write_command(writer, json!(["set_property", "aid", value]), *serial).await;
        }
    }
}
#[derive(Default)]
struct PlaybackFailure {
    primary: Option<(u8, String)>,
    details: Vec<String>,
}
impl PlaybackFailure {
    fn capture(&mut self, prefix: &str, level: &str, text: &str, launch: &Launch) {
        let lower = text.to_lowercase();
        if prefix.contains("ytdl") || lower.contains("youtube-dl") || text.trim().is_empty() {
            return;
        }
        let safe = crate::network::redact_detail(text.trim(), &launch.server, &launch.token);
        let detail = format!("[{prefix}] {}", safe.chars().take(700).collect::<String>());
        if self.details.last() != Some(&detail) {
            self.details.push(detail.clone());
            if self.details.len() > 8 {
                self.details.remove(0);
            }
        }
        if !["error", "fatal"].contains(&level) {
            return;
        }
        let priority = if [
            "http",
            "tls",
            "ssl",
            "certificate",
            "resolve",
            "timed out",
            "refused",
        ]
        .iter()
        .any(|word| lower.contains(word))
        {
            3
        } else if prefix.contains("ffmpeg") || prefix.contains("lavf") {
            2
        } else {
            1
        };
        if self
            .primary
            .as_ref()
            .is_none_or(|(current, _)| priority > *current)
        {
            self.primary = Some((priority, detail));
        }
    }
    fn message(&self) -> Option<String> {
        self.primary.as_ref().map(|(_, text)| {
            let lower = text.to_lowercase();
            let http = regex::Regex::new(
                r"(?i)(?:http(?: error)?(?: status)?[ :/]*|server returned\s+)([45][0-9]{2})\b",
            )
            .unwrap();
            if let Some(status) = http
                .captures(text)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str())
            {
                let reason = match status {
                    "401" => "登录已失效，请重新登录",
                    "403" => "服务器拒绝播放，请检查权限",
                    "404" => "媒体入口不存在，请刷新媒体信息",
                    _ if status.starts_with('5') => "服务器暂时无法提供视频",
                    _ => "媒体请求失败",
                };
                return format!("{reason}（HTTP {status}）。");
            }
            if lower.contains("protocol")
                && (lower.contains("unsupported") || lower.contains("not found"))
            {
                return "播放器不支持此播放协议。".into();
            }
            "视频加载失败，请检查媒体、网络和账号权限。".into()
        })
    }
}
fn smooth_input_rate(previous: Option<f64>, rate: Option<f64>) -> Option<f64> {
    rate.filter(|n| n.is_finite() && *n > 0.)
        .map(|n| previous.map_or(n, |old| old * 0.65 + n * 0.35))
}

async fn run_ipc<R, W>(
    mut child: Child,
    reader: R,
    mut writer: W,
    mut requests: mpsc::Receiver<Rpc>,
    snapshots: Arc<watch::Sender<Snapshot>>,
    launch: Launch,
    mut stopping: watch::Receiver<bool>,
    process_done: watch::Sender<bool>,
) where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
    W: tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let mut lines = BufReader::new(reader).lines();
    let mut pending: HashMap<u64, Reply> = HashMap::new();
    let mut serial = 100u64;
    let began = Instant::now();
    let mut check = tokio::time::interval(Duration::from_millis(250));
    let mut terminal_error = String::new();
    let mut failure = PlaybackFailure::default();
    let mut expected_end = false;
    let network_media = launch.url.starts_with("http://") || launch.url.starts_with("https://");
    let mut last_rate_sample: Option<Instant> = None;
    loop {
        tokio::select! {
            biased;
            _ = stopping.changed() => { expected_end = true; break; }
            request = requests.recv() => {
                let Some(request) = request else { break };
                serial+=1;
                if request.command[0] == "quit" { expected_end = true; }
                match timeout(Duration::from_millis(500), write_command(&mut writer,request.command,serial)).await {
                    Ok(Ok(())) => {},
                    _ => { let _=request.reply.send(Err("播放器连接已关闭".into())); break; }
                }
                pending.insert(serial,request.reply);
            }
            line = lines.next_line() => {
                let Ok(Some(line)) = line else { break };
                let Ok(message) = serde_json::from_str::<Value>(&line) else { continue };
                if let Some(id)=message["request_id"].as_u64() {
                    if let Some(reply)=pending.remove(&id) { let result=if message["error"]=="success" {Ok(message["data"].clone())} else {Err(format!("播放器拒绝操作：{}",message["error"].as_str().unwrap_or("unknown")))}; let _=reply.send(result); }
                }
                if message["event"] == "property-change" && message["name"] == "cache-speed" {
                    let rate = message["data"].as_f64().filter(|n| n.is_finite() && *n > 0.);
                    if !network_media || rate.is_none() {
                        last_rate_sample = None;
                        snapshots.send_if_modified(|s| s.input_rate_bps.take().is_some());
                    } else if last_rate_sample.is_none_or(|last| last.elapsed() >= Duration::from_secs(1)) {
                        last_rate_sample = Some(Instant::now());
                        snapshots.send_modify(|s| s.input_rate_bps = smooth_input_rate(s.input_rate_bps, rate));
                    }
                    continue;
                }
                if message["event"]=="property-change" && !snapshots.borrow().audio_fallback {
                    let quality=launch.quality.clone().unwrap_or_default();
                    let requested=quality.audio_device!="auto" || quality.passthrough=="on";
                    let missing=message["name"]=="audio-device-list" && quality.audio_device!="auto" && message["data"].as_array().is_some_and(|a|!a.iter().any(|d|d["name"]==quality.audio_device));
                    let unavailable=message["name"]=="current-ao" && (message["data"]=="null" || (message["data"].is_null() && snapshots.borrow().loaded));
                    if requested && (missing || unavailable) {
                        recover_pcm(&mut writer, &mut serial, &snapshots).await;
                    }
                }
                match message["event"].as_str().unwrap_or("") {
                    "seek" => { snapshots.send_modify(|s|s.clock_epoch=s.clock_epoch.wrapping_add(1)); }
                    "client-message" if message["args"][0]=="miry-key" => {
                        if let Some(code)=message["args"][1].as_str(){if launch.shortcuts.values().any(|k|k==code){if let Some(events)=&launch.ui_events{let _=events.try_send(UiEvent::Key(code.into()));}}}
                    }
                    "property-change" => { snapshots.send_modify(|s| { match message["name"].as_str().unwrap_or("") {
                        "time-pos" => if let Some(n)=message["data"].as_f64() {s.position=n},
                        "duration" => if let Some(n)=message["data"].as_f64() {s.duration=n},
                        "pause" => if let Some(n)=message["data"].as_bool() {s.paused=n},
                        "volume" => if let Some(n)=message["data"].as_f64() {s.volume=n},
                        "mute" => if let Some(n)=message["data"].as_bool() {s.muted=n},
                        "speed" => if let Some(n)=message["data"].as_f64() {s.speed=n},
                        "sub-delay" => if let Some(n)=message["data"].as_f64() {s.subtitle_delay=n},
                        "sub-pos" => if let Some(n)=message["data"].as_f64() {s.subtitle_position=n},
                        "ontop" => if let Some(n)=message["data"].as_bool() {s.ontop=n},
                        "fullscreen" => if let Some(n)=message["data"].as_bool() {s.fullscreen=n},
                        "secondary-sid" => s.secondary_subtitle=message["data"].as_i64(),
                        "sub-scale" => if let Some(n)=message["data"].as_f64() {s.subtitle_scale=n},
                        "demuxer-cache-duration" => if let Some(n)=message["data"].as_f64() {s.buffer_seconds=n},
                        "paused-for-cache" => if let Some(n)=message["data"].as_bool() {s.buffering=n},
                        "audio-delay" => if let Some(n)=message["data"].as_f64() {s.audio_delay=n},
                        "ab-loop-a" => s.loop_a=message["data"].as_f64(),
                        "ab-loop-b" => s.loop_b=message["data"].as_f64(),
                        "track-list" => {if let Some(a)=message["data"].as_array() {s.tracks=a.clone()}},
                        "video-params" => s.video_params=message["data"].clone(),
                        "video-target-params" => s.video_output=message["data"].clone(),
                        "audio-out-params" => s.audio_output=message["data"].clone(),
                        "audio-device" => if let Some(n)=message["data"].as_str() {s.audio_device=n.into()},
                        "current-vo" => if let Some(n)=message["data"].as_str() {s.renderer=n.into()},
                        "hwdec-current" => if let Some(n)=message["data"].as_str() {s.hardware_decoder=n.into()},
                        _=>{}
                    }}); }
                    "client-message" if message["args"][0] == "miry-fullscreen" => {
                        if let Some(events) = &launch.ui_events {
                            let _ = events.try_send(UiEvent::ToggleFullscreen);
                        }
                    }
                    "client-message" if message["args"][0] == "miry-exit-fullscreen" => {
                        if let Some(events) = &launch.ui_events { let _ = events.try_send(UiEvent::ExitFullscreen); }
                    }
                    "client-message" if message["args"][0] == "miry-toggle-controls" => {
                        if let Some(events) = &launch.ui_events { let _ = events.try_send(UiEvent::ToggleControls); }
                    }
                    "client-message" if message["args"][0] == "miry-show-controls" => {
                        if let Some(events) = &launch.ui_events { let _ = events.try_send(UiEvent::RevealControls); }
                    }
                    "log-message" if message["level"] == "warn" || message["level"] == "error" || message["level"] == "fatal" => {
                        failure.capture(message["prefix"].as_str().unwrap_or("mpv"), message["level"].as_str().unwrap_or("error"), message["text"].as_str().unwrap_or(""), &launch);
                    }
                    "file-loaded" => {
                        terminal_error.clear();
                        failure = PlaybackFailure::default();
                        // Tracks use mpv IDs; Emby indexes are FFmpeg stream indexes.
                        let tracks = snapshots.borrow().tracks.clone();
                        for (kind,index) in [("audio",launch.audio_index),("sub",launch.subtitle_index)] {
                            let property=if kind=="audio" {"aid"} else {"sid"};
                            let value=if index==Some(-1) {Some(json!("no"))} else if index.is_some() {tracks.iter().find(|t| t["type"]==kind && t["ff-index"].as_i64()==index).map(|t|t["id"].clone())} else {None};
                            if let Some(value)=value { serial+=1; let _=write_command(&mut writer,json!(["set_property",property,value]),serial).await; }
                        }
                        for subtitle in &launch.subtitles { serial+=1; let flag=if launch.subtitle_index==Some(subtitle.index) {"select"} else {"auto"}; let _=write_command(&mut writer,json!(["sub-add",subtitle.url,flag,subtitle.title,subtitle.language]),serial).await; }
                        serial+=1; let _=write_command(&mut writer,json!(["set_property","sub-pos",launch.subtitle_position]),serial).await;
                        serial+=1; let _=write_command(&mut writer,json!(["set_property","sub-scale",launch.subtitle_scale]),serial).await;
                        if launch.subtitle_index==Some(-1){serial+=1;let _=write_command(&mut writer,json!(["set_property","sid","no"]),serial).await;}
                        snapshots.send_modify(|s|s.loaded=true);
                    }
                    "end-file" => {
                        let reason=message["reason"].as_str().unwrap_or("");
                        if reason=="redirect" {continue;}
                        expected_end = true;
                        if reason=="error" && terminal_error.is_empty() {terminal_error=failure.message().unwrap_or_else(|| "视频加载或解码失败，请检查媒体文件、网络和账号播放权限。".into());}
                        snapshots.send_modify(|s|s.finished=reason=="eof");
                        break;
                    }
                    "shutdown" => break, _=>{}
                }
            }
            _ = check.tick() => {
                pending.retain(|_,reply|!reply.is_closed());
                if child.try_wait().ok().flatten().is_some() {break;}
                // Some WASAPI failures leave current-ao and audio-out-params unavailable
                // without a later property event. Retry PCM once after actual track load.
                let q = launch.quality.clone().unwrap_or_default();
                let retry = { let s = snapshots.borrow();
                    !s.audio_fallback && s.loaded && began.elapsed() > Duration::from_secs(2)
                    && (q.passthrough == "on" || q.audio_device != "auto") && s.audio_output.is_null()
                    && s.tracks.iter().any(|t| t["type"] == "audio" && t["selected"] == true)
                };
                if retry {recover_pcm(&mut writer, &mut serial, &snapshots).await;}
                if !snapshots.borrow().loaded && began.elapsed()>Duration::from_secs(30) {terminal_error="视频准备超过 30 秒，已停止播放器。".into();break;}
            }
        }
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
    if !terminal_error.is_empty() {
        let method = match launch.play_method.as_str() {
            "DirectStream" => "直接串流",
            "Transcode" => "转码",
            _ => "直接播放",
        };
        terminal_error = format!("{method}失败：{terminal_error}");
    }
    snapshots.send_modify(|s| {
        s.active = false;
        s.load_elapsed_ms = began.elapsed().as_millis() as u64;
        if !terminal_error.is_empty() {
            s.error = terminal_error;
        } else if !s.loaded {
            s.error = failure
                .message()
                .unwrap_or_else(|| "播放器在加载视频前已退出。".into());
        } else if !expected_end {
            s.error = "播放器连接中断或进程异常退出，请重新播放。".into();
        }
        if !s.error.is_empty() {
            s.network_details = failure.details.clone();
            s.network_details.truncate(7);
            s.network_details.push(format!("Playback context: {}", json!({
                "itemId": crate::network::redact_detail(&launch.item_id, &launch.server, &launch.token),
                "MediaSourceId": crate::network::redact_detail(&launch.source_id, &launch.server, &launch.token),
                "PlayMethod": launch.play_method,
                "url": "[server]/Videos/{id}/[delivery]",
                "category": "mpv-load"
            })));
        }
    });
    for (_, reply) in pending {
        let _ = reply.send(Err("播放器已停止".into()));
    }
    let _ = process_done.send(true);
}

fn track_index(snapshot: &Snapshot, kind: &str, launch: &Launch) -> Option<i64> {
    let track = snapshot
        .tracks
        .iter()
        .find(|t| t["type"] == kind && t["selected"] == true);
    let delivery = reqwest::Url::parse(&launch.url).ok();
    let parameter = |key: &str| {
        delivery.as_ref().and_then(|url| {
            url.query_pairs()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v.into_owned())
        })
    };
    // A single remux/transcode audio stream can have a different output ff-index.
    // Emby reports must identify the original source stream, not that output index.
    if kind == "audio"
        && track.is_some()
        && snapshot
            .tracks
            .iter()
            .filter(|t| t["type"] == "audio")
            .count()
            == 1
        && (launch.play_method == "Transcode"
            || (launch.play_method == "DirectStream" && parameter("AudioStreamIndex").is_some()))
    {
        if let Some(index) = parameter("AudioStreamIndex")
            .and_then(|v| v.parse::<i64>().ok())
            .filter(|i| *i >= 0)
            .or(launch.audio_index)
        {
            return Some(index);
        }
    }
    if kind == "sub"
        && track.is_none()
        && launch.play_method == "Transcode"
        && parameter("SubtitleMethod").is_some_and(|v| v.eq_ignore_ascii_case("Encode"))
    {
        if let Some(index) = parameter("SubtitleStreamIndex")
            .and_then(|v| v.parse::<i64>().ok())
            .filter(|i| *i >= 0)
        {
            return Some(index);
        }
    }
    match track {
        Some(t) if t["external"] == true => launch
            .subtitles
            .iter()
            .find(|s| t["external-filename"].as_str() == Some(s.url.as_str()))
            .map(|s| s.index),
        Some(t) => t["ff-index"].as_i64(),
        None if kind == "sub" => Some(-1),
        None => None,
    }
}
fn payload(launch: &Launch, snapshot: &Snapshot, event: &str) -> Value {
    let mut body = json!({"ItemId":launch.item_id,"MediaSourceId":launch.source_id,"PlaySessionId":launch.play_session_id,"PositionTicks":(snapshot.position.max(0.0)*10000000.0).round() as u64,"IsPaused":snapshot.paused,"IsMuted":snapshot.muted,"VolumeLevel":snapshot.volume.round(),"PlayMethod":launch.play_method,"CanSeek":true,"QueueableMediaTypes":["Video"],"EventName":event,"PlaybackRate":snapshot.speed,"SubtitleOffset":snapshot.subtitle_delay});
    if let Some(index) = track_index(snapshot, "audio", launch) {
        body["AudioStreamIndex"] = json!(index)
    }
    if let Some(index) = track_index(snapshot, "sub", launch) {
        body["SubtitleStreamIndex"] = json!(index)
    }
    body
}
async fn post(
    client: &reqwest::Client,
    launch: &Launch,
    path: &str,
    body: Value,
) -> Result<(), String> {
    #[cfg(debug_assertions)]
    let began = Instant::now();
    let response = client
        .post(format!("{}{path}", launch.server))
        .header("X-Emby-Token", &launch.token)
        .header(
            "X-Emby-Authorization",
            format!(
                "Emby Client=\"Miry\", Device=\"Windows\", DeviceId=\"{}\", Version=\"{}\"",
                launch.device_id,
                env!("CARGO_PKG_VERSION")
            ),
        )
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|error| {
            #[cfg(debug_assertions)]
            eprintln!("[Miry network] {}", json!({"stage":"playback-sync", "method":"POST", "endpoint":path, "backend":"reqwest / rustls", "elapsedMs":began.elapsed().as_millis(), "underlying":crate::network::error_chain(&error, &launch.server).iter().map(|line| crate::network::redact_detail(line, &launch.server, &launch.token)).collect::<Vec<_>>()}));
            if error.is_timeout() { "播放进度同步超时，请检查网络。".to_string() } else { "播放进度同步失败，可在设置中获取底层连接诊断。".to_string() }
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "服务器未接受播放进度（{}）。",
            response.status().as_u16()
        ));
    }
    Ok(())
}
fn progress_feedback(failures: &mut u32, failed: bool) -> String {
    if !failed {
        *failures = 0;
        return String::new();
    }
    *failures = failures.saturating_add(1);
    if *failures >= 3 {
        "播放进度暂时无法同步".into()
    } else {
        String::new()
    }
}
async fn report_loop(
    launch: Launch,
    mut snapshot: watch::Receiver<Snapshot>,
    sender: Arc<watch::Sender<Snapshot>>,
    done: watch::Sender<bool>,
) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    let mut started = false;
    let mut sync_failures = 0;
    let mut last = Snapshot::default();
    let mut last_report = Instant::now();
    let mut last_recovery = Instant::now() - Duration::from_secs(10);
    loop {
        let state = snapshot.borrow_and_update().clone();
        if state.active && state.loaded && last_recovery.elapsed() >= Duration::from_secs(5) {
            if let Some(path) = &launch.recovery_path {
                let _ = crate::recovery::save(
                    path,
                    &crate::recovery::Record {
                        server_id: launch.server_id.clone(),
                        item_id: launch.item_id.clone(),
                        source_id: launch.source_id.clone(),
                        title: launch.title.clone(),
                        position: state.position,
                        audio_index: track_index(&state, "audio", &launch),
                        subtitle_index: track_index(&state, "sub", &launch),
                        version: env!("CARGO_PKG_VERSION").into(),
                        timestamp: crate::recovery::now(),
                    },
                );
            }
            last_recovery = Instant::now();
        }
        if state.loaded {
            let event = if state.paused != last.paused {
                if state.paused {
                    "Pause"
                } else {
                    "Unpause"
                }
            } else if track_index(&state, "audio", &launch) != track_index(&last, "audio", &launch)
            {
                "AudioTrackChange"
            } else if track_index(&state, "sub", &launch) != track_index(&last, "sub", &launch) {
                "SubtitleTrackChange"
            } else if (state.volume - last.volume).abs() >= 1.0 || state.muted != last.muted {
                "VolumeChange"
            } else if state.speed != last.speed {
                "PlaybackRateChange"
            } else if state.subtitle_delay != last.subtitle_delay {
                "SubtitleOffsetChange"
            } else {
                "TimeUpdate"
            };
            if !started {
                match post(
                    &client,
                    &launch,
                    "/Sessions/Playing",
                    payload(&launch, &state, event),
                )
                .await
                {
                    Ok(()) => {
                        started = true;
                        last_report = Instant::now();
                        sender.send_modify(|s| s.sync_error.clear());
                        sync_failures = 0;
                    }
                    Err(e) => {
                        if e.contains("超时") {
                            sender.send_modify(|s| {
                                s.sync_timeouts = s.sync_timeouts.saturating_add(1)
                            });
                        }
                        let feedback = progress_feedback(&mut sync_failures, true);
                        sender.send_modify(|s| s.sync_error = feedback);
                        tokio::time::sleep(Duration::from_secs(2)).await;
                    }
                }
            } else if state.active
                && (event != "TimeUpdate"
                    || last_report.elapsed() >= Duration::from_secs(10)
                    || (state.position - last.position).abs() > 3.0)
            {
                let result = post(
                    &client,
                    &launch,
                    "/Sessions/Playing/Progress",
                    payload(&launch, &state, event),
                )
                .await;
                if result.as_ref().err().is_some_and(|e| e.contains("超时")) {
                    sender.send_modify(|s| s.sync_timeouts = s.sync_timeouts.saturating_add(1));
                }
                let feedback = progress_feedback(&mut sync_failures, result.is_err());
                sender.send_modify(|s| s.sync_error = feedback);
                last_report = Instant::now();
            }
            last = state.clone();
        }
        // A report may have awaited HTTP while the player stopped; use the newest position.
        let terminal = snapshot.borrow().clone();
        if !terminal.active {
            if terminal.finished || terminal.error.is_empty() {
                if let Some(path) = &launch.recovery_path {
                    crate::recovery::clear(path);
                }
            }
            let final_client = reqwest::Client::builder()
                .timeout(Duration::from_secs(2))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap();
            let result = timeout(Duration::from_millis(6500), async {
                let progress_error = if started || terminal.loaded {
                    post(
                        &final_client,
                        &launch,
                        "/Sessions/Playing/Progress",
                        payload(&launch, &terminal, "TimeUpdate"),
                    )
                    .await
                    .err()
                } else {
                    None
                };
                let mut result = post(
                    &final_client,
                    &launch,
                    "/Sessions/Playing/Stopped",
                    payload(&launch, &terminal, "TimeUpdate"),
                )
                .await;
                if result.is_err() {
                    result = post(
                        &final_client,
                        &launch,
                        "/Sessions/Playing/Stopped",
                        payload(&launch, &terminal, "TimeUpdate"),
                    )
                    .await;
                }
                let stopped_ok = result.is_ok();
                let mut failure = result.err().or(progress_error);
                if stopped_ok && terminal.finished {
                    let path = format!("/Users/{}/PlayedItems/{}", launch.user_id, launch.item_id);
                    if let Err(e) = post(&final_client, &launch, &path, json!({})).await {
                        failure = Some(e);
                    }
                }
                failure
            })
            .await
            .unwrap_or_else(|_| Some("最终播放进度同步超时，播放器已停止。".into()));
            sender.send_modify(|s| {
                s.sync_error = if result.is_some() {
                    "播放位置已保存在本机，服务器同步失败".into()
                } else {
                    String::new()
                }
            });
            if launch.play_method == "Transcode" {
                if let Ok(mut url) =
                    reqwest::Url::parse(&format!("{}/Videos/ActiveEncodings", launch.server))
                {
                    url.query_pairs_mut()
                        .append_pair("DeviceId", &launch.device_id)
                        .append_pair("PlaySessionId", &launch.play_session_id);
                    let result = final_client
                        .delete(url)
                        .header("X-Emby-Token", &launch.token)
                        .send()
                        .await;
                    if !result.is_ok_and(|r| r.status().is_success()) {
                        sender.send_modify(|s| {
                            s.sync_error = "服务器转码任务清理未确认，请检查服务器。".into()
                        });
                    }
                }
            }
            break;
        }
        tokio::select! {
            changed=snapshot.changed()=>{if changed.is_err(){break;}},
            _=tokio::time::sleep(Duration::from_secs(1))=>{}
        }
    }
    let _ = done.send(true);
}

#[cfg(test)]
mod tests {
    #[test]
    fn progress_failures_are_quiet_until_consecutive_and_reset_on_success() {
        let mut failures = 0;
        assert_eq!(super::progress_feedback(&mut failures, true), "");
        assert_eq!(super::progress_feedback(&mut failures, true), "");
        assert_eq!(
            super::progress_feedback(&mut failures, true),
            "播放进度暂时无法同步"
        );
        assert_eq!(
            super::progress_feedback(&mut failures, true),
            "播放进度暂时无法同步"
        );
        assert_eq!(super::progress_feedback(&mut failures, false), "");
        assert_eq!(super::progress_feedback(&mut failures, true), "");
    }
    #[test]
    fn input_rate_is_smoothed_and_missing_data_clears_it() {
        assert_eq!(super::smooth_input_rate(None, Some(1000.)), Some(1000.));
        assert_eq!(
            super::smooth_input_rate(Some(1000.), Some(2000.)),
            Some(1350.)
        );
        for rate in [
            None,
            Some(0.),
            Some(-1.),
            Some(f64::NAN),
            Some(f64::INFINITY),
        ] {
            assert_eq!(super::smooth_input_rate(Some(1000.), rate), None);
        }
    }
    use super::*;
    #[tokio::test]
    async fn video_fit_rolls_back_partial_failure() {
        let (tx, mut requests) = mpsc::channel::<Rpc>(24);
        let original: HashMap<_, _> = VideoFit::Stretch.properties().into_iter().collect();
        let expected = original.clone();
        let worker = tokio::spawn(async move {
            let mut properties = original;
            let mut rejected = false;
            while let Some(request) = requests.recv().await {
                let name = request.command[1].as_str().unwrap();
                let result = if request.command[0] == "get_property" {
                    Ok(properties[name].clone())
                } else if name == "panscan" && !rejected {
                    rejected = true;
                    Err("injected property failure".into())
                } else {
                    *properties.get_mut(name).unwrap() = request.command[2].clone();
                    Ok(Value::Null)
                };
                let _ = request.reply.send(result);
            }
            properties
        });
        assert!(apply_video_fit(&tx, VideoFit::Fill).await.is_err());
        drop(tx);
        assert_eq!(worker.await.unwrap(), expected);
    }

    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_FIT_DIR with local aspect fixtures"]
    async fn real_mpv_video_fit_modes_preserve_surface_and_session() {
        use windows_sys::Win32::{Foundation::RECT, UI::WindowsAndMessaging::*};
        let directory = PathBuf::from(std::env::var("MIRY_TEST_FIT_DIR").unwrap());
        let (server, calls, task) = mock_server().await;
        let surface = crate::surface::TestSurface::new();
        let player = Player::default();
        for (name, aspect) in [("16x9", 16.0 / 9.0), ("4x3", 4.0 / 3.0), ("cinema", 2.35)] {
            for initial in [VideoFit::Fit, VideoFit::Fill, VideoFit::Stretch] {
                let mut a = launch();
                a.server = server.clone();
                a.url = directory
                    .join(format!("{name}.y4m"))
                    .to_string_lossy()
                    .into();
                a.play_session_id = format!("{name}-{initial:?}");
                a.video_fit = initial;
                a.window_id = Some(surface.handle as u32);
                a.quality = Some(crate::quality::Quality {
                    hwdec: "no".into(),
                    extra_args: vec!["--pause=yes".into()],
                    ..Default::default()
                });
                let mut h = start(mpv_path().unwrap(), a.clone(), true).await.unwrap();
                wait_state(&mut h, |s| s.loaded && s.paused).await;
                assert_eq!(h.snapshot.borrow().video_fit, initial);
                let tx = h.tx.clone();
                *player.0.lock().await = Some(h);
                assert!(set_video_fit(&player, VideoFit::Fill, "stale-session")
                    .await
                    .is_err());
                rpc(&tx, json!(["set_property", "sub-scale", 1.3]))
                    .await
                    .unwrap();
                rpc(&tx, json!(["set_property", "sub-pos", 72]))
                    .await
                    .unwrap();
                for (width, height) in [(640, 360), (480, 360), (800, 340)] {
                    unsafe {
                        SetWindowPos(
                            surface.handle as _,
                            HWND_TOP,
                            20,
                            20,
                            width,
                            height,
                            SWP_NOACTIVATE,
                        );
                    }
                    for mode in [
                        VideoFit::Fit,
                        VideoFit::Fill,
                        VideoFit::Stretch,
                        VideoFit::Fit,
                    ] {
                        assert_eq!(
                            set_video_fit(&player, mode, &a.play_session_id)
                                .await
                                .unwrap(),
                            mode
                        );
                        let dimensions = timeout(Duration::from_secs(4), async {
                            loop {
                                let dims = rpc(&tx, json!(["get_property", "osd-dimensions"]))
                                    .await
                                    .unwrap();
                                let w = dims["w"].as_f64().unwrap_or(0.);
                                let h = dims["h"].as_f64().unwrap_or(0.);
                                let x = dims["ml"].as_f64().unwrap_or(0.)
                                    + dims["mr"].as_f64().unwrap_or(0.);
                                let y = dims["mt"].as_f64().unwrap_or(0.)
                                    + dims["mb"].as_f64().unwrap_or(0.);
                                let expected = match mode {
                                    VideoFit::Fit => {
                                        x >= 0.
                                            && y >= 0.
                                            && ((w - x) / (h - y) - aspect).abs() < 0.025
                                    }
                                    VideoFit::Fill => {
                                        x <= 0.
                                            && y <= 0.
                                            && ((w - x) / (h - y) - aspect).abs() < 0.025
                                    }
                                    VideoFit::Stretch => x == 0. && y == 0.,
                                };
                                if w == width as f64 && h == height as f64 && expected {
                                    break dims;
                                }
                                tokio::time::sleep(Duration::from_millis(30)).await;
                            }
                        })
                        .await
                        .expect("mpv fitting/resize did not reach expected geometry");
                        eprintln!("{name} {initial:?} {width}x{height} {mode:?}: {dimensions}");
                        let render = unsafe { GetWindow(surface.handle as _, GW_CHILD) };
                        let mut rect: RECT = unsafe { std::mem::zeroed() };
                        assert_ne!(unsafe { GetClientRect(render, &mut rect) }, 0);
                        assert_eq!((rect.right, rect.bottom), (width, height));
                        assert_eq!(
                            rpc(&tx, json!(["get_property", "sub-scale"]))
                                .await
                                .unwrap(),
                            json!(1.3)
                        );
                        assert_eq!(
                            rpc(&tx, json!(["get_property", "sub-pos"]))
                                .await
                                .unwrap()
                                .as_f64(),
                            Some(72.)
                        );
                    }
                }
                stop(&player, |_| {}).await.unwrap();
                assert!(set_video_fit(&player, VideoFit::Fill, &a.play_session_id)
                    .await
                    .is_err());
                assert!(*player
                    .0
                    .lock()
                    .await
                    .as_ref()
                    .unwrap()
                    .process_done
                    .borrow());
            }
        }
        assert_eq!(
            calls
                .lock()
                .await
                .iter()
                .filter(|(path, _)| path.ends_with("/Stopped"))
                .count(),
            9
        );
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; verifies actual key precedence and local config"]
    async fn real_mpv_custom_keys_have_one_owner_and_input_config_keeps_other_keys() {
        let (server, _, task) = mock_server().await;
        let directory = std::env::temp_dir().join(format!("miry-keys-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("mpv.conf"), "speed=1.25\nhwdec=no\n").unwrap();
        std::fs::write(
            directory.join("input.conf"),
            "SPACE cycle mute\nz set speed 1.5\n",
        )
        .unwrap();
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        let (events, mut receiver) = mpsc::channel(8);
        a.ui_events = Some(events);
        a.quality = Some(crate::quality::Quality {
            directory: Some(directory.clone()),
            mpv_config: true,
            input_config: true,
            extra_args: vec!["--speed=1.4".into()],
            ..Default::default()
        });
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| s.loaded).await;
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "speed"])).await.unwrap(),
            json!(1.4)
        );
        rpc(&h.tx, json!(["keypress", "SPACE"])).await.unwrap();
        let event = timeout(Duration::from_secs(2), receiver.recv())
            .await
            .unwrap()
            .unwrap();
        assert!(matches!(event,UiEvent::Key(c) if c=="Space"));
        assert!(timeout(Duration::from_millis(100), receiver.recv())
            .await
            .is_err());
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "mute"])).await.unwrap(),
            json!(false)
        );
        rpc(&h.tx, json!(["cycle", "pause"])).await.unwrap();
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "pause"])).await.unwrap(),
            json!(true)
        );
        rpc(&h.tx, json!(["keypress", "z"])).await.unwrap();
        // keypress acknowledges the input before mpv executes its bound command.
        wait_state(&mut h, |s| (s.speed - 1.5).abs() < 0.001).await;
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "speed"])).await.unwrap(),
            json!(1.5)
        );
        stop_handle(&mut h).await.unwrap();
        task.abort();
        std::fs::remove_file(directory.join("mpv.conf")).unwrap();
        std::fs::remove_file(directory.join("input.conf")).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    fn launch() -> Launch {
        serde_json::from_value(json!({"server":"http://127.0.0.1:18096/emby","userId":"user","token":"token","deviceId":"device","itemId":"movie","title":"Test","sourceId":"source","playSessionId":"session","url":"http://127.0.0.1:18096/emby/Videos/movie/stream","startSeconds":0,"subtitles":[],"playMethod":"DirectPlay"})).unwrap()
    }
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; quality and automatic audio fallback"]
    async fn real_mpv_quality_policies_keep_the_session_and_recover_missing_device() {
        let (server, _, task) = mock_server().await;
        for policy in ["auto", "source", "sdr"] {
            let mut a = launch();
            a.server = server.clone();
            a.url = format!("{server}/local.mkv");
            a.quality = Some(crate::quality::Quality {
                hdr: policy.into(),
                audio_device: "wasapi/missing-device".into(),
                ..Default::default()
            });
            a.url = format!("{server}/Videos/movie/stream");
            let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
            let s = wait_state(&mut h, |s| s.loaded && s.audio_fallback).await;
            assert!(s.active);
            assert_eq!(s.output_policy, policy);
            let trc = rpc(&h.tx, json!(["get_property", "options/target-trc"]))
                .await
                .unwrap();
            assert_eq!(trc, if policy == "sdr" { "srgb" } else { "auto" });
            stop_handle(&mut h).await.unwrap();
        }
        task.abort();
    }
    #[test]
    fn shutdown_is_idempotent_and_blocks_further_starts() {
        let player = Player::default();
        assert!(begin_shutdown(&player));
        assert!(!begin_shutdown(&player));
        assert!(player.3.load(Ordering::SeqCst));
    }
    async fn report_server(
        status: u16,
    ) -> (
        String,
        Arc<Mutex<Vec<(String, Value)>>>,
        tokio::task::JoinHandle<()>,
    ) {
        use tokio::{io::AsyncReadExt, net::TcpListener};
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let server = format!("http://{}/emby", listener.local_addr().unwrap());
        let calls = Arc::new(Mutex::new(Vec::new()));
        let records = calls.clone();
        let task = tokio::spawn(async move {
            loop {
                let Ok((socket, _)) = listener.accept().await else {
                    break;
                };
                let records = records.clone();
                tokio::spawn(async move {
                    let (reader, mut writer) = socket.into_split();
                    let mut reader = BufReader::new(reader);
                    let mut line = String::new();
                    reader.read_line(&mut line).await.unwrap();
                    let path = line.split_whitespace().nth(1).unwrap().to_string();
                    let mut length = 0;
                    loop {
                        line.clear();
                        reader.read_line(&mut line).await.unwrap();
                        if line == "\r\n" {
                            break;
                        }
                        if line.to_lowercase().starts_with("content-length:") {
                            length = line
                                .split(':')
                                .nth(1)
                                .unwrap()
                                .trim()
                                .parse::<usize>()
                                .unwrap();
                        }
                    }
                    let mut body = vec![0; length];
                    reader.read_exact(&mut body).await.unwrap();
                    records
                        .lock()
                        .await
                        .push((path, serde_json::from_slice(&body).unwrap()));
                    let _ = writer.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes()).await;
                });
            }
        });
        (server, calls, task)
    }
    #[tokio::test]
    async fn final_progress_precedes_stopped_and_uses_the_latest_position() {
        let (server, calls, task) = report_server(204).await;
        let mut a = launch();
        a.server = server;
        let (sender, receiver) = watch::channel(Snapshot {
            active: true,
            loaded: true,
            ..Default::default()
        });
        let sender = Arc::new(sender);
        let (done_tx, mut done) = watch::channel(false);
        tokio::spawn(report_loop(a, receiver, sender.clone(), done_tx));
        timeout(Duration::from_secs(2), async {
            while calls.lock().await.is_empty() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        sender.send_modify(|s| {
            s.position = 1072.0;
            s.active = false;
        });
        timeout(Duration::from_secs(3), wait_done(&mut done))
            .await
            .unwrap();
        let reports = calls.lock().await;
        let stopped = reports
            .iter()
            .position(|(p, _)| p.ends_with("/Stopped"))
            .unwrap();
        assert!(reports[stopped - 1].0.ends_with("/Progress"));
        assert_eq!(
            reports[stopped - 1].1["PositionTicks"],
            json!(10720000000u64)
        );
        assert_eq!(reports[stopped].1["PositionTicks"], json!(10720000000u64));
        assert_eq!(
            reports
                .iter()
                .filter(|(p, _)| p.ends_with("/Stopped"))
                .count(),
            1
        );
        task.abort();
    }
    #[tokio::test]
    async fn rejected_start_still_finishes_reporting_and_retries_stopped_once() {
        let (server, calls, task) = report_server(401).await;
        let mut a = launch();
        a.server = server;
        let (sender, receiver) = watch::channel(Snapshot {
            active: false,
            loaded: true,
            position: 72.0,
            ..Default::default()
        });
        let sender = Arc::new(sender);
        let (done_tx, mut done) = watch::channel(false);
        tokio::spawn(report_loop(a, receiver, sender.clone(), done_tx));
        timeout(Duration::from_secs(4), wait_done(&mut done))
            .await
            .unwrap();
        assert!(!sender.borrow().active);
        assert_eq!(
            sender.borrow().sync_error,
            "播放位置已保存在本机，服务器同步失败"
        );
        assert_eq!(
            calls
                .lock()
                .await
                .iter()
                .filter(|(p, _)| p.ends_with("/Stopped"))
                .count(),
            2
        );
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; lifecycle return and switch regression"]
    async fn real_mpv_shared_stop_samples_progress_and_allows_resume() {
        let (server, calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        let mut h = start(mpv_path().unwrap(), a.clone(), true).await.unwrap();
        wait_state(&mut h, |s| s.loaded).await;
        rpc(&h.tx, json!(["seek", 9.0, "absolute+exact"]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.position >= 8.9).await;
        let player = Player::default();
        *player.0.lock().await = Some(h);
        let mut sampled = None;
        let final_state = stop(&player, |sample| sampled = Some(sample.clone()))
            .await
            .unwrap();
        let sampled = sampled.unwrap();
        assert!(!sampled.active);
        assert_eq!(sampled.position, final_state.position);
        assert!(!final_state.active);
        assert!(final_state.sync_complete);
        assert!((final_state.position - 9.0).abs() < 0.6);
        assert!(*player
            .0
            .lock()
            .await
            .as_ref()
            .unwrap()
            .process_done
            .borrow());
        let reports = calls.lock().await;
        let end = reports
            .iter()
            .position(|(p, _)| p.ends_with("/Stopped"))
            .unwrap();
        assert!(reports[end - 1].0.ends_with("/Progress"));
        assert_eq!(
            reports[end].1["PositionTicks"],
            reports[end - 1].1["PositionTicks"]
        );
        drop(reports);
        a.start_seconds = final_state.position;
        a.play_session_id = "next-session".into();
        let mut next = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut next, |s| s.loaded && s.position >= 8.9).await;
        stop_handle(&mut next).await.unwrap();
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; offline stop regression"]
    async fn real_mpv_offline_reports_do_not_keep_the_process_alive() {
        let (server, _, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| s.loaded && s.position > 0.0).await;
        task.abort();
        tokio::time::sleep(Duration::from_millis(100)).await;
        let final_state = stop_handle(&mut h).await.unwrap();
        assert!(!final_state.active);
        assert!(*h.process_done.borrow());
        assert!(final_state.sync_complete);
        assert!(!final_state.sync_error.is_empty());
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; shutdown while playing regression"]
    async fn real_mpv_shutdown_while_playing_reports_once_and_reclaims_the_child() {
        let (server, calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| s.loaded && s.position > 0.0).await;
        let player = Player::default();
        *player.0.lock().await = Some(h);
        assert!(begin_shutdown(&player));
        assert!(!begin_shutdown(&player));
        let final_state = stop(&player, |_| {}).await.unwrap();
        assert!(!final_state.active);
        assert!(final_state.sync_complete);
        assert!(final_state.position > 0.0);
        assert!(*player
            .0
            .lock()
            .await
            .as_ref()
            .unwrap()
            .process_done
            .borrow());
        stop(&player, |_| {}).await.unwrap();
        assert_eq!(
            calls
                .lock()
                .await
                .iter()
                .filter(|(p, _)| p.ends_with("/Stopped"))
                .count(),
            1
        );
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and MIRY_TEST_VIDEO; failure recovery regression"]
    async fn real_mpv_invalid_token_cleans_up_and_can_be_restarted() {
        let (server, _, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        a.token = "invalid".into();
        let mut h = start(mpv_path().unwrap(), a.clone(), true).await.unwrap();
        let state = wait_state(&mut h, |s| !s.active).await;
        assert!(state.error.contains("401"));
        stop_handle(&mut h).await.unwrap();
        assert!(*h.process_done.borrow());
        a.token = "token".into();
        a.play_session_id = "recovered".into();
        let mut recovered = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut recovered, |s| s.loaded).await;
        stop_handle(&mut recovered).await.unwrap();
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv; IPC disconnect and unexpected child exit regression"]
    async fn real_mpv_ipc_disconnect_and_unexpected_exit_are_reclaimed() {
        for disconnect in [true, false] {
            let (server, calls, task) = report_server(204).await;
            let mut a = launch();
            a.server = server;
            let mut child = Command::new(mpv_path().unwrap())
                .args([
                    "--no-config",
                    "--idle=yes",
                    "--vo=null",
                    "--ao=null",
                    "--force-window=no",
                ])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .creation_flags(0x08000000)
                .kill_on_drop(true)
                .spawn()
                .unwrap();
            let (reader, remote) = tokio::io::duplex(1024);
            let (_requests_tx, requests) = mpsc::channel(4);
            let (_shutdown_tx, stopping) = watch::channel(false);
            let (process_done, mut reclaimed) = watch::channel(false);
            let (done_tx, mut done) = watch::channel(false);
            let (sender, snapshot) = watch::channel(Snapshot {
                active: true,
                loaded: true,
                position: 12.0,
                item_id: a.item_id.clone(),
                play_session_id: a.play_session_id.clone(),
                ..Snapshot::default()
            });
            let sender = Arc::new(sender);
            let reports = tokio::spawn(report_loop(
                a.clone(),
                snapshot.clone(),
                sender.clone(),
                done_tx,
            ));
            if disconnect {
                drop(remote);
            } else {
                child.start_kill().unwrap();
            }
            tokio::spawn(run_ipc(
                child,
                reader,
                tokio::io::sink(),
                requests,
                sender.clone(),
                a,
                stopping,
                process_done,
            ));
            timeout(Duration::from_secs(3), wait_done(&mut reclaimed))
                .await
                .unwrap();
            assert!(!snapshot.borrow().active);
            assert!(snapshot.borrow().error.contains("连接中断或进程异常退出"));
            timeout(Duration::from_secs(10), wait_done(&mut done))
                .await
                .unwrap();
            reports.await.unwrap();
            let calls = calls.lock().await;
            assert!(calls.last().unwrap().0.ends_with("/Stopped"));
            assert_eq!(calls.last().unwrap().1["PositionTicks"], 120000000);
            task.abort();
        }
    }
    #[test]
    fn rejects_other_origins_and_header_injection() {
        let mut a = launch();
        assert!(validate(&a).is_ok());
        a.url = "http://evil.example/video".into();
        assert!(validate(&a).is_err());
        a = launch();
        a.token = "token\r\nEvil: x".into();
        assert!(validate(&a).is_err());
    }
    #[test]
    fn uses_ffmpeg_index_instead_of_mpv_id() {
        let a = launch();
        let s = Snapshot {
            position: 32.15,
            tracks: vec![json!({"id":2,"type":"audio","ff-index":5,"selected":true})],
            ..Default::default()
        };
        let p = payload(&a, &s, "Pause");
        assert_eq!(p["PositionTicks"], 321500000);
        assert_eq!(p["AudioStreamIndex"], 5);
        assert_eq!(p["SubtitleStreamIndex"], -1);
    }
    #[test]
    fn delivery_reports_original_audio_and_burned_subtitle_indexes() {
        let mut a = launch();
        a.play_method = "Transcode".into();
        a.audio_index = Some(5);
        a.url = "http://127.0.0.1:18096/emby/Videos/movie/master.m3u8?AudioStreamIndex=5&SubtitleStreamIndex=8&SubtitleMethod=Encode".into();
        let s = Snapshot {
            tracks: vec![json!({"id":1,"type":"audio","ff-index":1,"selected":true})],
            ..Default::default()
        };
        let p = payload(&a, &s, "TimeUpdate");
        assert_eq!(p["AudioStreamIndex"], 5);
        assert_eq!(p["SubtitleStreamIndex"], 8);
        assert_eq!(p["PlayMethod"], "Transcode");
        a.play_method = "DirectStream".into();
        assert_eq!(payload(&a, &s, "TimeUpdate")["AudioStreamIndex"], 5);
        a.play_method = "DirectPlay".into();
        assert_eq!(payload(&a, &s, "TimeUpdate")["AudioStreamIndex"], 1);
        let multi = Snapshot {
            tracks: vec![
                json!({"id":1,"type":"audio","ff-index":1,"selected":true}),
                json!({"id":2,"type":"audio","ff-index":2}),
            ],
            ..Default::default()
        };
        a.play_method = "Transcode".into();
        assert_eq!(payload(&a, &multi, "TimeUpdate")["AudioStreamIndex"], 1);
    }
    #[test]
    fn original_http_failure_survives_later_parser_errors_and_is_private() {
        let a = launch();
        let mut failure = PlaybackFailure::default();
        failure.capture(
            "curl",
            "error",
            "HTTP error 404 for http://127.0.0.1:18096/emby/Videos/movie/stream?api_key=token",
            &a,
        );
        failure.capture("lavf", "error", "Failed to open input", &a);
        failure.capture(
            "ytdl_hook",
            "error",
            "youtube-dl failed: unexpected error occurred",
            &a,
        );
        let message = failure.message().unwrap();
        assert!(message.contains("404"));
        assert!(!message.contains("youtube-dl"));
        assert!(!message.contains("127.0.0.1"));
        assert!(!message.contains("api_key"));
        assert!(!message.contains("token"));
    }
    #[test]
    fn playback_http_failures_are_distinct_and_credentials_stay_in_private_details() {
        for status in [401, 403, 404, 500, 503] {
            let a = launch();
            let mut failure = PlaybackFailure::default();
            failure.capture(
                "ffmpeg",
                "error",
                &format!("HTTP error {status} for http://127.0.0.1/video?api_key=token"),
                &a,
            );
            let message = failure.message().unwrap();
            assert!(message.contains(&status.to_string()));
            assert!(!message.contains("api_key"));
            assert!(!message.contains("127.0.0.1"));
        }
        let a = launch();
        let mut failure = PlaybackFailure::default();
        failure.capture("lavf", "error", "Unsupported protocol foo", &a);
        assert!(failure.message().unwrap().contains("协议"));
    }

    #[cfg(windows)]
    async fn wait_state(handle: &mut Handle, predicate: impl Fn(&Snapshot) -> bool) -> Snapshot {
        timeout(Duration::from_secs(10), async {
            loop {
                let s = handle.snapshot.borrow_and_update().clone();
                if predicate(&s) {
                    return s;
                }
                assert!(s.active, "mpv stopped: {}", s.error);
                handle.snapshot.changed().await.unwrap();
            }
        })
        .await
        .expect("mpv snapshot timed out")
    }
    #[cfg(windows)]
    async fn mock_server() -> (
        String,
        Arc<Mutex<Vec<(String, Value)>>>,
        tokio::task::JoinHandle<()>,
    ) {
        mock_server_with_policy(true).await
    }
    #[cfg(windows)]
    async fn mock_server_with_policy(
        require_auth: bool,
    ) -> (
        String,
        Arc<Mutex<Vec<(String, Value)>>>,
        tokio::task::JoinHandle<()>,
    ) {
        use tokio::{io::AsyncReadExt, net::TcpListener};
        let fixture = std::env::var("MIRY_TEST_VIDEO")
            .expect("set MIRY_TEST_VIDEO to the generated local MKV fixture");
        let video = Arc::new(tokio::fs::read(fixture).await.unwrap());
        let transcode = Arc::new(if let Ok(path) = std::env::var("MIRY_TEST_TRANSCODE") {
            tokio::fs::read(path).await.unwrap()
        } else {
            vec![]
        });
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let server = format!("http://{}/emby", listener.local_addr().unwrap());
        let calls = Arc::new(Mutex::new(vec![]));
        let records = calls.clone();
        let task = tokio::spawn(async move {
            loop {
                let Ok((socket, _)) = listener.accept().await else {
                    break;
                };
                let video = video.clone();
                let transcode = transcode.clone();
                let records = records.clone();
                tokio::spawn(async move {
                    let (read, mut write) = socket.into_split();
                    let mut read = BufReader::new(read);
                    let mut line = String::new();
                    if read.read_line(&mut line).await.is_err() {
                        return;
                    }
                    let words: Vec<_> = line.split_whitespace().collect();
                    if words.len() < 2 {
                        return;
                    }
                    let method = words[0].to_string();
                    let path = words[1].to_string();
                    let mut length = 0;
                    let mut range = None;
                    let mut authorized = false;
                    let mut credential_header = false;
                    loop {
                        line.clear();
                        if read.read_line(&mut line).await.unwrap_or(0) == 0 || line == "\r\n" {
                            break;
                        }
                        let lower = line.to_lowercase();
                        if lower.starts_with("authorization:") || lower.starts_with("x-emby-token:")
                        {
                            credential_header = true;
                        }
                        if lower.starts_with("content-length:") {
                            length = line.split(':').nth(1).unwrap().trim().parse().unwrap();
                        }
                        if lower.starts_with("range: bytes=") {
                            range = line
                                .trim()
                                .split('=')
                                .nth(1)
                                .and_then(|r| r.split('-').next())
                                .and_then(|r| r.parse::<usize>().ok());
                        }
                        if lower.trim() == "x-emby-token: token"
                            || (lower.starts_with("authorization: emby ")
                                && line.contains("Token=\"token\""))
                        {
                            authorized = true;
                        }
                    }
                    if (require_auth && !authorized) || (!require_auth && credential_header) {
                        let _=write.write_all(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                        return;
                    }
                    if method == "POST" || method == "DELETE" {
                        let mut body = vec![0; length];
                        let _ = read.read_exact(&mut body).await;
                        records
                            .lock()
                            .await
                            .push((path, serde_json::from_slice(&body).unwrap_or(Value::Null)));
                        let _=write.write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                    } else {
                        let subtitles =
                            b"1\n00:00:00,000 --> 00:00:19,000\nMiry subtitle fixture\n";
                        let data: &[u8] = if path.contains("subs.srt") {
                            subtitles
                        } else if path.contains("master.m3u8") {
                            b"#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:21\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:20.0,\nsegments.ts\n#EXT-X-ENDLIST\n"
                        } else if path.contains("segments.ts") {
                            &transcode
                        } else {
                            &video
                        };
                        let start = range.unwrap_or(0).min(data.len().saturating_sub(1));
                        let header = if range.is_some() {
                            format!("HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n",data.len()-start,start,data.len()-1,data.len())
                        } else {
                            format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n",data.len())
                        };
                        let _ = write.write_all(header.as_bytes()).await;
                        let _ = write.write_all(&data[start..]).await;
                    }
                });
            }
        });
        (server, calls, task)
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv and existing MIRY_TEST_VIDEO; local redirect playback only"]
    async fn real_mpv_server_delivery_redirect_and_original_http_error() {
        use tokio::{io::AsyncReadExt, net::TcpListener};
        let (cdn, _, cdn_task) = mock_server_with_policy(false).await;
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let server = format!("http://{}/emby", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            loop {
                let Ok((socket, _)) = listener.accept().await else {
                    break;
                };
                let cdn = cdn.clone();
                tokio::spawn(async move {
                    let (read, mut write) = socket.into_split();
                    let mut read = BufReader::new(read);
                    let mut line = String::new();
                    let _ = read.read_line(&mut line).await;
                    let request = line.clone();
                    let mut authorized = false;
                    let mut length = 0;
                    loop {
                        line.clear();
                        if read.read_line(&mut line).await.unwrap_or(0) == 0 || line == "\r\n" {
                            break;
                        }
                        let lower = line.to_lowercase();
                        if lower.starts_with("authorization: emby ")
                            && line.contains("Token=\"token\"")
                        {
                            authorized = true;
                        }
                        if lower.trim() == "x-emby-token: token" {
                            authorized = true;
                        }
                        if lower.starts_with("content-length:") {
                            length = lower.split(':').nth(1).unwrap().trim().parse().unwrap();
                        }
                    }
                    let mut body = vec![0; length];
                    let _ = read.read_exact(&mut body).await;
                    let response = if !authorized {
                        "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into()
                    } else if request.starts_with("POST ") {
                        "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n".into()
                    } else if request.contains("/original.mkv") {
                        format!("HTTP/1.1 302 Found\r\nLocation: {cdn}/Videos/movie/source.mkv\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    } else {
                        "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                            .into()
                    };
                    let _ = write.write_all(response.as_bytes()).await;
                });
            }
        });
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        let mut failed = start(mpv_path().unwrap(), a.clone(), true).await.unwrap();
        let error = wait_state(&mut failed, |s| !s.active).await;
        assert!(!error.loaded);
        assert!(
            error.error.contains("404"),
            "original HTTP status must survive: {}",
            error.error
        );
        assert!(!error.error.contains("youtube-dl"));
        assert!(!error.error.contains("127.0.0.1"));
        a.url = format!("{server}/Videos/movie/original.mkv");
        a.start_seconds = 3.0;
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        let _ = wait_state(&mut h, |s| s.loaded && s.position >= 3.0).await;
        rpc(&h.tx, json!(["set_property", "pause", true]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["seek", 7, "absolute+exact"]))
            .await
            .unwrap();
        let state = wait_state(&mut h, |s| s.position >= 6.9).await;
        assert!(state.error.is_empty());
        rpc(&h.tx, json!(["quit"])).await.unwrap();
        let _ = wait_state(&mut h, |s| !s.active).await;
        task.abort();
        cdn_task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires downloaded mpv and MIRY_TEST_VIDEO; run explicitly for playback integration"]
    async fn real_mpv_resume_controls_and_checkins() {
        let (server, calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        a.start_seconds = 5.0;
        a.subtitles = vec![Subtitle {
            url: format!("{server}/subs.srt"),
            index: 3,
            title: "Fixture subtitle".into(),
            language: "eng".into(),
        }];
        validate(&a).unwrap();
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        let state = wait_state(&mut h, |s| {
            s.loaded
                && s.position >= 5.0
                && s.tracks.iter().any(|t| t["type"] == "audio")
                && s.tracks.iter().any(|t| t["type"] == "sub")
        })
        .await;
        assert!(
            state.position < 7.0,
            "resume position was {}",
            state.position
        );
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "media-title"]))
                .await
                .unwrap(),
            json!("Miry")
        );
        rpc(&h.tx, json!(["set_property", "pause", true]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.paused).await;
        rpc(&h.tx, json!(["seek", 8.0, "absolute+exact"]))
            .await
            .unwrap();
        wait_state(&mut h, |s| (s.position - 8.0).abs() < 0.5).await;
        rpc(&h.tx, json!(["set_property", "speed", 1.5]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.speed == 1.5).await;
        rpc(&h.tx, json!(["set_property", "sub-delay", 1.0]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.subtitle_delay == 1.0).await;
        rpc(&h.tx, json!(["set_property", "sub-scale", 1.25]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.subtitle_scale == 1.25).await;
        rpc(&h.tx, json!(["set_property", "audio-delay", 0.2]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.audio_delay == 0.2).await;
        rpc(&h.tx, json!(["set_property", "ab-loop-a", 6.0]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["set_property", "ab-loop-b", 9.0]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.loop_a == Some(6.0) && s.loop_b == Some(9.0)).await;
        rpc(&h.tx, json!(["set_property", "ab-loop-a", "no"]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["set_property", "ab-loop-b", "no"]))
            .await
            .unwrap();
        let sub = state.tracks.iter().find(|t| t["type"] == "sub").unwrap()["id"].clone();
        rpc(&h.tx, json!(["set_property", "sid", "no"]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["set_property", "secondary-sid", sub.clone()]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.secondary_subtitle == sub.as_i64()).await;
        select_primary_subtitle(&h.tx, sub.as_i64().unwrap())
            .await
            .unwrap();
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "secondary-sid"]))
                .await
                .unwrap(),
            json!(false)
        );
        rpc(&h.tx, json!(["set_property", "secondary-sid", "no"]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["set_property", "sid", sub]))
            .await
            .unwrap();
        wait_state(&mut h, |s| {
            s.tracks
                .iter()
                .any(|t| t["type"] == "sub" && t["selected"] == true)
        })
        .await;
        let primary = rpc(&h.tx, json!(["get_property", "sid"])).await.unwrap();
        rpc(
            &h.tx,
            json!(["sub-add", format!("{server}/subs.srt?secondary"), "auto"]),
        )
        .await
        .unwrap();
        let tracks = rpc(&h.tx, json!(["get_property", "track-list"]))
            .await
            .unwrap();
        let secondary = tracks
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["type"] == "sub" && t["id"] != primary)
            .expect("local fixture server must supply a second subtitle")["id"]
            .clone();
        rpc(&h.tx, json!(["set_property", "secondary-sid", secondary]))
            .await
            .unwrap();
        rpc(&h.tx, json!(["set_property", "secondary-sub-pos", 18]))
            .await
            .unwrap();
        let mut subtitle_properties = Vec::new();
        for name in [
            "sid",
            "secondary-sid",
            "sub-scale",
            "sub-pos",
            "secondary-sub-pos",
            "sub-delay",
        ] {
            subtitle_properties.push((
                name,
                rpc(&h.tx, json!(["get_property", name])).await.unwrap(),
            ));
        }
        for mode in [VideoFit::Fill, VideoFit::Stretch, VideoFit::Fit] {
            apply_video_fit(&h.tx, mode).await.unwrap();
            for (name, value) in &subtitle_properties {
                assert_eq!(
                    rpc(&h.tx, json!(["get_property", name])).await.unwrap(),
                    *value,
                    "{mode:?} changed subtitle property {name}"
                );
            }
        }
        tokio::time::sleep(Duration::from_secs(11)).await;
        rpc(&h.tx, json!(["quit"])).await.unwrap_or(Value::Null);
        timeout(Duration::from_secs(12), async {
            while !*h.done.borrow_and_update() {
                h.done.changed().await.unwrap();
            }
        })
        .await
        .unwrap();
        let reports = calls.lock().await;
        assert!(reports.iter().any(|(p, _)| p == "/emby/Sessions/Playing"));
        assert!(reports
            .iter()
            .any(|(p, b)| p.ends_with("/Progress") && b["IsPaused"] == true));
        assert!(reports
            .iter()
            .any(|(p, b)| p.ends_with("/Progress") && b["SubtitleStreamIndex"] == 3));
        assert!(reports.iter().any(|(p, b)| p.ends_with("/Progress")
            && b["PlaybackRate"] == 1.5
            && b["SubtitleOffset"] == 1.0));
        let (_, stopped) = reports
            .iter()
            .find(|(p, _)| p.ends_with("/Stopped"))
            .expect("final stop check-in missing");
        assert!((stopped["PositionTicks"].as_u64().unwrap() as i64 - 80000000).abs() < 5000000);
        assert!(
            !reports.iter().any(|(p, _)| p.contains("PlayedItems")),
            "stopped mid-video must not be marked watched"
        );
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires downloaded mpv and MIRY_TEST_VIDEO; run explicitly for playback integration"]
    async fn real_mpv_embeds_in_child_surface_and_resizes() {
        use windows_sys::Win32::{Foundation::RECT, UI::WindowsAndMessaging::*};
        let surface = crate::surface::TestSurface::new();
        let (server, _calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        a.window_id = Some(surface.handle as u32);
        a.embedded = true;
        a.shortcuts
            .insert("subtitle".into(), "Ctrl+Shift+KeyS".into());
        a.shortcuts.insert("audio".into(), "Alt+Enter".into());
        let (events, mut receive) = mpsc::channel(4);
        a.ui_events = Some(events);
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        let state = wait_state(&mut h, |s| s.loaded && s.position > 0.0).await;
        assert!(state.embedded);
        for (key, code) in [
            ("Ctrl+Shift+s", "Ctrl+Shift+KeyS"),
            ("Alt+ENTER", "Alt+Enter"),
        ] {
            rpc(&h.tx, json!(["keypress", key])).await.unwrap();
            assert!(
                matches!(timeout(Duration::from_secs(3), receive.recv()).await.unwrap(), Some(UiEvent::Key(value)) if value == code)
            );
        }
        rpc(&h.tx, json!(["keypress", "h"])).await.unwrap();
        assert!(matches!(
            timeout(Duration::from_secs(3), receive.recv())
                .await
                .unwrap(),
            Some(UiEvent::ToggleControls)
        ));
        rpc(&h.tx, json!(["keypress", "TAB"])).await.unwrap();
        assert!(matches!(
            timeout(Duration::from_secs(3), receive.recv())
                .await
                .unwrap(),
            Some(UiEvent::RevealControls)
        ));
        rpc(&h.tx, json!(["keypress", "f"])).await.unwrap();
        assert!(matches!(
            timeout(Duration::from_secs(3), receive.recv())
                .await
                .unwrap(),
            Some(UiEvent::Key(code)) if code=="KeyF"
        ));
        rpc(&h.tx, json!(["keypress", "ESC"])).await.unwrap();
        assert!(matches!(
            timeout(Duration::from_secs(3), receive.recv())
                .await
                .unwrap(),
            Some(UiEvent::ExitFullscreen)
        ));
        rpc(&h.tx, json!(["keypress", "SPACE"])).await.unwrap();
        assert!(
            matches!(timeout(Duration::from_secs(3), receive.recv()).await.unwrap(),Some(UiEvent::Key(code)) if code=="Space")
        );
        rpc(&h.tx, json!(["cycle", "pause"])).await.unwrap();
        wait_state(&mut h, |s| s.paused).await;
        rpc(&h.tx, json!(["keypress", "RIGHT"])).await.unwrap();
        assert!(
            matches!(timeout(Duration::from_secs(3), receive.recv()).await.unwrap(),Some(UiEvent::Key(code)) if code=="ArrowRight")
        );
        rpc(&h.tx, json!(["seek", 10, "absolute+exact"]))
            .await
            .unwrap();
        wait_state(&mut h, |s| s.position >= 10.0 && s.position < 12.0).await;
        let render = unsafe {
            FindWindowExW(
                surface.handle as _,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
            )
        };
        assert!(!render.is_null(), "mpv should create a child renderer");
        assert_eq!(unsafe { GetParent(render) } as usize, surface.handle);
        unsafe {
            SetWindowPos(
                surface.handle as _,
                HWND_TOP,
                20,
                20,
                320,
                180,
                SWP_NOACTIVATE,
            );
        }
        timeout(Duration::from_secs(5), async {
            loop {
                let mut rect: RECT = unsafe { std::mem::zeroed() };
                unsafe {
                    GetClientRect(render, &mut rect);
                }
                if rect.right == 320 && rect.bottom == 180 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(30)).await;
            }
        })
        .await
        .expect("embedded renderer should follow host size");
        rpc(&h.tx, json!(["quit"])).await.unwrap_or(Value::Null);
        timeout(Duration::from_secs(12), async {
            while !*h.done.borrow_and_update() {
                h.done.changed().await.unwrap();
            }
        })
        .await
        .unwrap();
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires downloaded mpv and MIRY_TEST_VIDEO; run explicitly for playback integration"]
    async fn real_mpv_eof_marks_watched() {
        let (server, calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        a.start_seconds = 18.0;
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        timeout(Duration::from_secs(15), async {
            while !*h.done.borrow_and_update() {
                h.done.changed().await.unwrap();
            }
        })
        .await
        .unwrap();
        assert!(
            h.snapshot.borrow().finished,
            "{}",
            h.snapshot.borrow().error
        );
        let reports = calls.lock().await;
        assert!(reports.iter().any(|(p, _)| p.ends_with("/Stopped")));
        assert!(reports
            .iter()
            .any(|(p, _)| p == "/emby/Users/user/PlayedItems/movie"));
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires bundled mpv, MIRY_TEST_VIDEO and MIRY_TEST_TRANSCODE; actual local HLS and recovery"]
    async fn real_mpv_transcode_hls_recovery_and_terminal_cleanup() {
        std::env::var("MIRY_TEST_TRANSCODE").expect("provide the local TS fixture");
        let (server, calls, task) = mock_server().await;
        let path =
            std::env::temp_dir().join(format!("miry-hls-recovery-{}.json", uuid::Uuid::new_v4()));
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/master.m3u8");
        a.play_method = "Transcode".into();
        a.server_id = "qa".into();
        a.recovery_path = Some(path.clone());
        a.start_seconds = 5.;
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| s.loaded && s.position >= 5.).await;
        rpc(&h.tx, json!(["set_property", "pause", true]))
            .await
            .unwrap();
        timeout(Duration::from_secs(7), async {
            loop {
                if crate::recovery::read(&path).is_some_and(|r| r.position >= 5.) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        })
        .await
        .unwrap();
        let record = crate::recovery::read(&path).unwrap();
        assert_eq!(record.source_id, "source");
        assert_eq!(record.server_id, "qa");
        let final_state = stop_handle(&mut h).await.unwrap();
        assert!(final_state.position >= 5.);
        assert!(crate::recovery::read(&path).is_none());
        let reports = calls.lock().await;
        assert_eq!(
            reports
                .iter()
                .filter(|(p, _)| p.ends_with("/Stopped"))
                .count(),
            1
        );
        assert_eq!(
            reports
                .iter()
                .filter(|(p, _)| p.starts_with("/emby/Videos/ActiveEncodings"))
                .count(),
            1
        );
        assert!(reports
            .iter()
            .filter(|(p, _)| p.contains("/Sessions/Playing"))
            .all(|(_, b)| b["PlayMethod"] == "Transcode"));
        task.abort();
    }
    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires downloaded mpv and MIRY_TEST_VIDEO"]
    async fn real_mpv_preferences_keep_subtitles_off() {
        let (server, calls, task) = mock_server().await;
        let mut a = launch();
        a.server = server.clone();
        a.url = format!("{server}/Videos/movie/stream");
        a.volume = Some(40.0);
        a.subtitle_position = 77.0;
        a.subtitle_scale = 1.37;
        a.hardware_decode = false;
        a.subtitle_index = Some(-1);
        a.subtitles = vec![Subtitle {
            url: format!("{server}/subs.srt"),
            index: 3,
            title: "Fixture".into(),
            language: "eng".into(),
        }];
        let mut h = start(mpv_path().unwrap(), a, true).await.unwrap();
        wait_state(&mut h, |s| {
            s.loaded && s.tracks.iter().any(|t| t["type"] == "sub") && s.volume == 40.0
        })
        .await;
        tokio::time::sleep(Duration::from_millis(400)).await;
        assert_eq!(h.snapshot.borrow().subtitle_position, 77.0);
        assert_eq!(h.snapshot.borrow().subtitle_scale, 1.37);
        assert!(h.snapshot.borrow().double_click_ms > 0);
        assert_eq!(
            rpc(&h.tx, json!(["get_property", "sub-ass-override"]))
                .await
                .unwrap(),
            json!(false)
        );
        assert!(!h
            .snapshot
            .borrow()
            .tracks
            .iter()
            .any(|t| t["type"] == "sub" && t["selected"] == true));
        let _ = rpc(&h.tx, json!(["quit"])).await;
        timeout(Duration::from_secs(12), async {
            while !*h.done.borrow_and_update() {
                h.done.changed().await.unwrap();
            }
        })
        .await
        .unwrap();
        assert!(calls
            .lock()
            .await
            .iter()
            .any(|(p, b)| p.ends_with("/Stopped")
                && b["SubtitleStreamIndex"] == -1
                && b["VolumeLevel"] == 40.0));
        task.abort();
    }
}
