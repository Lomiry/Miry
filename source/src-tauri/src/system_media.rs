use serde::Deserialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
#[cfg(windows)]
use windows::{
    core::{factory, HSTRING},
    Foundation::TypedEventHandler,
    Media::{
        MediaPlaybackStatus, MediaPlaybackType, SystemMediaTransportControls,
        SystemMediaTransportControlsButton, SystemMediaTransportControlsButtonPressedEventArgs,
    },
    Win32::{
        Foundation::HWND,
        System::WinRT::{
            ISystemMediaTransportControlsInterop, RoInitialize, RO_INIT_MULTITHREADED,
        },
    },
};
#[derive(Default)]
pub struct SystemMedia {
    #[cfg(windows)]
    controls: Mutex<Option<SystemMediaTransportControls>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    enabled: bool,
    active: bool,
    paused: bool,
    title: String,
    episode: String,
    next: bool,
    previous: bool,
    cover: Option<Vec<u8>>,
}
#[cfg(windows)]
pub fn initialize(window: &tauri::WebviewWindow) {
    let result = (|| -> windows::core::Result<SystemMediaTransportControls> {
        let interop: ISystemMediaTransportControlsInterop =
            factory::<SystemMediaTransportControls, _>()?;
        let hwnd = window.hwnd().map_err(|_| {
            windows::core::Error::from_hresult(windows::core::HRESULT(0x80004005u32 as i32))
        })?;
        let controls: SystemMediaTransportControls = unsafe { interop.GetForWindow(HWND(hwnd.0))? };
        let owner = window.clone();
        controls.ButtonPressed(&TypedEventHandler::<
            SystemMediaTransportControls,
            SystemMediaTransportControlsButtonPressedEventArgs,
        >::new(move |_, event| {
            if let Some(e) = event.as_ref() {
                let name = match e.Button()? {
                    SystemMediaTransportControlsButton::Play => "play",
                    SystemMediaTransportControlsButton::Pause => "pause",
                    SystemMediaTransportControlsButton::Next => "next",
                    SystemMediaTransportControlsButton::Previous => "previous",
                    _ => return Ok(()),
                };
                let _ = owner.emit("system-media-action", name);
            }
            Ok(())
        }))?;
        controls.SetIsEnabled(false)?;
        Ok(controls)
    })();
    if let Ok(controls) = result {
        *window.state::<SystemMedia>().controls.lock().unwrap() = Some(controls);
    }
}
#[tauri::command]
pub async fn system_media_update(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SystemMedia>,
    info: Info,
) -> Result<bool, String> {
    if window.label() != "main"
        || info.title.len() > 2048
        || info.episode.len() > 2048
        || info.cover.as_ref().is_some_and(|b| b.len() > 262144)
    {
        return Err("系统媒体信息无效".into());
    }
    #[cfg(windows)]
    {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let controls = state
            .controls
            .lock()
            .map_err(|_| "系统媒体状态不可用")?
            .clone();
        let Some(c) = controls else {
            return Ok(false);
        };
        let result = (|| -> windows::core::Result<()> {
            c.SetIsEnabled(info.enabled && info.active)?;
            c.SetIsPlayEnabled(info.active)?;
            c.SetIsPauseEnabled(info.active)?;
            c.SetIsNextEnabled(info.next && info.active)?;
            c.SetIsPreviousEnabled(info.previous && info.active)?;
            c.SetPlaybackStatus(if !info.active {
                MediaPlaybackStatus::Stopped
            } else if info.paused {
                MediaPlaybackStatus::Paused
            } else {
                MediaPlaybackStatus::Playing
            })?;
            let updater = c.DisplayUpdater()?;
            updater.SetType(MediaPlaybackType::Video)?;
            let video = updater.VideoProperties()?;
            video.SetTitle(&HSTRING::from(&info.title))?;
            video.SetSubtitle(&HSTRING::from(&info.episode))?;
            if let Some(bytes) = info.cover {
                use windows::Storage::Streams::{
                    DataWriter, InMemoryRandomAccessStream, RandomAccessStreamReference,
                };
                let stream = InMemoryRandomAccessStream::new()?;
                let writer = DataWriter::CreateDataWriter(&stream)?;
                writer.WriteBytes(&bytes)?;
                writer.StoreAsync()?.join()?;
                writer.DetachStream()?;
                stream.Seek(0)?;
                updater.SetThumbnail(&RandomAccessStreamReference::CreateFromStream(&stream)?)?;
            } else if !info.active {
                updater.ClearAll()?;
            }
            updater.Update()?;
            Ok(())
        })();
        result
            .map(|_| true)
            .map_err(|_| "Windows 系统媒体整合暂不可用，客户端播放不受影响。".into())
    }
    #[cfg(not(windows))]
    {
        let _ = (state, info);
        Ok(false)
    }
}
#[tauri::command]
pub fn system_media_status(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SystemMedia>,
) -> Result<serde_json::Value, String> {
    if window.label() != "main" {
        return Err("状态由主窗口管理".into());
    }
    #[cfg(windows)]
    {
        let c = state.controls.lock().map_err(|_| "状态不可用")?.clone();
        Ok(if let Some(c) = c {
            serde_json::json!({"available":true,"enabled":c.IsEnabled().unwrap_or(false),"status":c.PlaybackStatus().map(|s|s.0).unwrap_or(-1),"title":c.DisplayUpdater().and_then(|u|u.VideoProperties()).and_then(|v|v.Title()).map(|s|s.to_string()).unwrap_or_default()})
        } else {
            serde_json::json!({"available":false})
        })
    }
    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(serde_json::json!({"available":false}))
    }
}
