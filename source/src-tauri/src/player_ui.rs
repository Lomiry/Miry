//! Window composition for the UI only. Playback remains owned by the main window.
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
#[derive(Default)]
pub struct OverlayOwner(std::sync::Mutex<Option<String>>);

// Windows can propagate an owner's topmost bit without updating tao's flags.
// Synchronize both the framework and native level when changing the video host.
pub(crate) fn bind_host(
    overlay: &tauri::WebviewWindow,
    target: &tauri::Window,
) -> Result<(), String> {
    let topmost = target.is_always_on_top().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let hwnd = overlay.hwnd().map_err(|e| e.to_string())?.0;
        let parent = target.hwnd().map_err(|e| e.to_string())?.0;
        SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, parent as isize);
        if GetWindow(hwnd, GW_OWNER) != parent {
            return Err("Overlay host transfer failed".into());
        }
    }
    overlay
        .set_always_on_top(topmost)
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        if SetWindowPos(
            overlay.hwnd().map_err(|e| e.to_string())?.0,
            if topmost {
                HWND_TOPMOST
            } else {
                HWND_NOTOPMOST
            },
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        ) == 0
        {
            return Err("Overlay window level transfer failed".into());
        }
    }
    Ok(())
}

pub fn dispose(app: &tauri::AppHandle) -> Result<(), String> {
    crate::mini_window::leave(app, false)?;
    let state = app.state::<OverlayOwner>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    *current = None;
    destroy_overlay(app)
}

fn destroy_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("player-ui") {
        use tauri::Emitter;
        let _ = overlay.emit("player-ui-dispose", ());
        overlay.hide().map_err(|e| e.to_string())?;
        overlay.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn player_overlay_attach(window: tauri::WebviewWindow, owner: String) -> Result<(), String> {
    if window.label() != "main" || owner.is_empty() || owner.len() > 128 {
        return Err("Invalid overlay owner".into());
    }
    if window.state::<crate::tray::TrayState>().is_exiting() {
        return Err("Application is exiting".into());
    }
    let state = window.state::<OverlayOwner>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    destroy_overlay(window.app_handle())?;
    *current = Some(owner);
    Ok(())
}

#[tauri::command]
pub fn player_overlay_release(window: tauri::WebviewWindow, owner: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Invalid overlay owner".into());
    }
    let state = window.state::<OverlayOwner>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    if current.as_deref() == Some(owner.as_str()) {
        *current = None;
        destroy_overlay(window.app_handle())?;
        drop(current);
        crate::mini_window::leave(window.app_handle(), true)?;
    }
    Ok(())
}
#[cfg(not(windows))]
use tauri::{PhysicalPosition, PhysicalSize};

#[tauri::command]
pub fn player_overlay_focus(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("控制层只能由主窗口管理".into());
    }
    if let Some(overlay) = window.app_handle().get_webview_window("player-ui") {
        if overlay.is_visible().unwrap_or(false) {
            overlay.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// Read-only composition diagnostics: no playback or window geometry is changed.
#[derive(serde::Serialize)]
pub struct PlayerGeometry {
    video: Option<(i32, i32)>,
    renderer: Option<(i32, i32)>,
    overlay: Option<(u32, u32)>,
    video_visible: bool,
    overlay_visible: bool,
}

#[tauri::command]
pub fn player_ui_geometry(window: tauri::WebviewWindow) -> Result<PlayerGeometry, String> {
    if window.label() != "main" {
        return Err("画面区域只能由主窗口检查".into());
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::{Foundation::RECT, UI::WindowsAndMessaging::*};
        let handle = window.state::<super::surface::Surface>().handle();
        let size = |hwnd: windows_sys::Win32::Foundation::HWND| unsafe {
            let mut rect: RECT = std::mem::zeroed();
            if hwnd.is_null() || GetClientRect(hwnd, &mut rect) == 0 {
                None
            } else {
                Some((rect.right - rect.left, rect.bottom - rect.top))
            }
        };
        let video = size(handle as _);
        let renderer = if handle == 0 {
            None
        } else {
            size(unsafe { GetWindow(handle as _, GW_CHILD) })
        };
        let overlay = window
            .app_handle()
            .get_webview_window("player-ui")
            .and_then(|w| w.inner_size().ok())
            .map(|s| (s.width, s.height));
        Ok(PlayerGeometry {
            video,
            renderer,
            overlay,
            video_visible: handle != 0 && unsafe { IsWindowVisible(handle as _) != 0 },
            overlay_visible: window
                .app_handle()
                .get_webview_window("player-ui")
                .is_some_and(|w| w.is_visible().unwrap_or(false)),
        })
    }
    #[cfg(not(windows))]
    Ok(PlayerGeometry {
        video: None,
        renderer: None,
        overlay: None,
        video_visible: false,
        overlay_visible: false,
    })
}

#[tauri::command]
pub async fn player_overlay(
    window: tauri::WebviewWindow,
    rect: super::surface::Rect,
    owner: String,
) -> Result<(), String> {
    // Serialize the visibility check and native show with tray hide/restore.
    // No owner lock is held while waiting for the main event loop.
    let (send, receive) = tokio::sync::oneshot::channel();
    let app = window.app_handle().clone();
    app.run_on_main_thread(move || {
        let _ = send.send(update_overlay(window, rect, Some(owner)));
    })
    .map_err(|e| e.to_string())?;
    receive
        .await
        .map_err(|_| "Overlay event loop unavailable".to_string())?
}

pub(crate) fn update_overlay(
    window: tauri::WebviewWindow,
    rect: super::surface::Rect,
    owner: Option<String>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("控制层只能由主窗口管理".into());
    }
    if ![rect.x, rect.y, rect.width, rect.height]
        .iter()
        .all(|n| n.is_finite() && n.abs() <= 32768.0)
        || rect.width < 0.0
        || rect.height < 0.0
    {
        return Err("控制层区域无效".into());
    }
    let app = window.app_handle();
    let ownership = app.state::<OverlayOwner>();
    let current = ownership.0.lock().map_err(|e| e.to_string())?;
    if current.is_none()
        || owner
            .as_ref()
            .is_some_and(|owner| current.as_deref() != Some(owner.as_str()))
    {
        return Ok(());
    }
    if owner.is_some() {
        app.state::<crate::mini_window::MiniWindow>()
            .0
            .lock()
            .unwrap()
            .overlay = rect.clone();
    }
    let (target, rect) = crate::mini_window::target(&window, &rect)?;
    if app.state::<crate::tray::TrayState>().is_exiting()
        || !rect.visible
        || rect.width == 0.0
        || rect.height == 0.0
        || target.is_minimized().unwrap_or(false)
        || !target.is_visible().unwrap_or(false)
    {
        if let Some(overlay) = app.get_webview_window("player-ui") {
            overlay.hide().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let overlay = match app.get_webview_window("player-ui") {
        Some(overlay) => overlay,
        None => WebviewWindowBuilder::new(app, "player-ui", WebviewUrl::App("index.html".into()))
            .title("Miry")
            .initialization_script("window.__MIRY_PLAYER_UI__ = true;")
            .parent(&window)
            .map_err(|e| e.to_string())?
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .focused(false)
            .build()
            .map_err(|e| e.to_string())?,
    };
    let scale = target.scale_factor().map_err(|e| e.to_string())?;
    let origin = target.inner_position().map_err(|e| e.to_string())?;
    let was_visible = overlay.is_visible().unwrap_or(false);
    bind_host(&overlay, &target)?;
    #[cfg(not(windows))]
    overlay
        .set_position(PhysicalPosition::new(
            origin.x + (rect.x * scale).round() as i32,
            origin.y + (rect.y * scale).round() as i32,
        ))
        .map_err(|e| e.to_string())?;
    #[cfg(not(windows))]
    overlay
        .set_size(PhysicalSize::new(
            (rect.width * scale).round() as u32,
            (rect.height * scale).round() as u32,
        ))
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        // Position before showing, and preserve the level derived from the host.
        // Tauri owns visibility: SWP_SHOWWINDOW would bypass tao's VISIBLE flag
        // and make a subsequent overlay.hide() a no-op.
        if SetWindowPos(
            overlay.hwnd().map_err(|e| e.to_string())?.0,
            std::ptr::null_mut(),
            origin.x + (rect.x * scale).round() as i32,
            origin.y + (rect.y * scale).round() as i32,
            (rect.width * scale).round() as i32,
            (rect.height * scale).round() as i32,
            SWP_NOACTIVATE | SWP_NOZORDER,
        ) == 0
        {
            return Err("无法调整控制层区域".into());
        }
    }
    overlay.show().map_err(|e| e.to_string())?;
    use tauri::Emitter;
    if !was_visible {
        overlay
            .emit("player-controls", "resume")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
