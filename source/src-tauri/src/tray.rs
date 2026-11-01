//! Tray actions run on the main event loop. Visibility is read from the window;
//! preferences are a projection of the existing frontend settings, never a second store.
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const TRAY_ID: &str = "miry-tray";
const SHOW_ID: &str = "tray-show";
const HIDE_ID: &str = "tray-hide";
const EXIT_ID: &str = "tray-exit";
// Startup fallback; the main window projects its existing language catalog via IPC.
const SHOW_TEXT: &str = "显示 Miry";
const HIDE_TEXT: &str = "隐藏 Miry";
const EXIT_TEXT: &str = "退出 Miry";

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrayBehavior {
    pub close_to_tray: bool,
    pub minimize_to_tray: bool,
}

#[derive(Debug, Deserialize)]
pub struct TrayLabels {
    pub show: String,
    pub hide: String,
    pub exit: String,
}

#[derive(Default)]
pub struct TrayState {
    behavior: Mutex<TrayBehavior>,
    exiting: AtomicBool,
    available: AtomicBool,
    menu: Mutex<Option<[MenuItem<tauri::Wry>; 3]>>,
}

impl TrayState {
    fn behavior(&self) -> TrayBehavior {
        self.behavior.lock().map(|value| *value).unwrap_or_default()
    }

    pub fn request_exit(&self) {
        self.exiting.store(true, Ordering::SeqCst);
    }

    pub fn is_exiting(&self) -> bool {
        self.exiting.load(Ordering::SeqCst)
    }

    fn can_hide(&self) -> bool {
        self.available.load(Ordering::SeqCst) && !self.is_exiting()
    }

    pub fn hide_on_close(&self) -> bool {
        self.can_hide() && self.behavior().close_to_tray
    }

    pub fn hide_on_minimize(&self) -> bool {
        self.can_hide() && self.behavior().minimize_to_tray
    }
}

#[tauri::command]
pub fn set_tray_behavior(
    window: tauri::WebviewWindow,
    input: TrayBehavior,
    labels: TrayLabels,
) -> Result<bool, String> {
    if window.label() != "main" {
        return Err("Tray preferences belong to the main window".into());
    }
    let state = window.state::<TrayState>();
    if state.is_exiting() {
        return Err("Application is exiting".into());
    }
    let texts = [&labels.show, &labels.hide, &labels.exit];
    if texts
        .iter()
        .any(|text| text.is_empty() || text.len() > 120 || text.chars().any(char::is_control))
    {
        return Err("Invalid tray labels".into());
    }
    if let Some(items) = state
        .menu
        .lock()
        .map_err(|_| "Tray menu unavailable")?
        .as_ref()
    {
        for (item, text) in items.iter().zip(texts) {
            item.set_text(text).map_err(|error| error.to_string())?;
        }
    }
    *state
        .behavior
        .lock()
        .map_err(|_| "Tray preferences unavailable")? = input;
    Ok(state.available.load(Ordering::SeqCst))
}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }
    let show = MenuItem::with_id(app, SHOW_ID, SHOW_TEXT, true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let hide = MenuItem::with_id(app, HIDE_ID, HIDE_TEXT, true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let exit = MenuItem::with_id(app, EXIT_ID, EXIT_TEXT, true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let menu = Menu::with_items(app, &[&show, &hide, &exit]).map_err(|error| error.to_string())?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("Miry tray icon unavailable")?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("Miry")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let result = match event.id().as_ref() {
                SHOW_ID => show_main(app),
                HIDE_ID => hide_main(app).map(|_| ()),
                EXIT_ID => exit_main(app),
                _ => return,
            };
            if result.is_err() {
                eprintln!("Miry tray window action failed");
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left release restores only; ignore DoubleClick so a double click never toggles.
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                let _ = show_main(tray.app_handle());
            }
            sync_menu(tray.app_handle());
        })
        .build(app)
        .map_err(|error| error.to_string())?;
    let state = app.state::<TrayState>();
    *state.menu.lock().map_err(|_| "Tray menu unavailable")? = Some([show, hide, exit]);
    state.available.store(true, Ordering::SeqCst);
    sync_menu(app);
    Ok(())
}

fn menu_enabled(visible: bool, minimized: bool, focused: bool, exiting: bool) -> [bool; 3] {
    if exiting {
        [false; 3]
    } else {
        [!visible || minimized || !focused, visible, true]
    }
}

pub fn sync_menu(app: &AppHandle) {
    let state = app.state::<TrayState>();
    let items = state.menu.lock().ok().and_then(|menu| menu.clone());
    if let (Some(items), Some(window)) = (items, app.get_webview_window("main")) {
        let enabled = menu_enabled(
            window.is_visible().unwrap_or(false),
            window.is_minimized().unwrap_or(false),
            window.is_focused().unwrap_or(false),
            state.is_exiting(),
        );
        for (item, enabled) in items.iter().zip(enabled) {
            let _ = item.set_enabled(enabled);
        }
    }
}

pub fn show_main(app: &AppHandle) -> Result<(), String> {
    if app.state::<TrayState>().is_exiting() {
        return Ok(());
    }
    let window = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    let restore = !window.is_visible().map_err(|e| e.to_string())?
        || window.is_minimized().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    if restore {
        // Windows may automatically show owned windows with their owner. Reposition
        // through the existing viewport owner before exposing the controls again.
        suspend_overlay(app)?;
        window
            .emit("tray-restored", ())
            .map_err(|e| e.to_string())?;
    }
    window.set_focus().map_err(|e| e.to_string())?;
    if crate::mini_window::active(app) {
        if let Some(host) = crate::mini_window::host(app) {
            host.show().map_err(|e| e.to_string())?;
        }
        crate::mini_window::refresh(app)?;
    }
    sync_menu(app);
    Ok(())
}

pub fn suspend_overlay(app: &AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("player-ui") {
        let _ = overlay.emit("player-controls", "suspend");
        overlay.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// False means no hide occurred; close must fall through to the normal shutdown.
pub fn hide_main(app: &AppHandle) -> Result<bool, String> {
    if !app.state::<TrayState>().can_hide() {
        return Ok(false);
    }
    let window = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    suspend_overlay(app)?;
    if let Some(host) = crate::mini_window::host(app) {
        host.hide().map_err(|e| e.to_string())?;
    }
    if window.is_visible().map_err(|e| e.to_string())? {
        if let Err(error) = window.hide() {
            let _ = window.emit("tray-restored", ());
            return Err(error.to_string());
        }
    }
    sync_menu(app);
    Ok(true)
}

pub fn exit_main(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<TrayState>();
    if state.is_exiting() {
        return Ok(());
    }
    let window = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    state.request_exit();
    // A persistent latch bypasses every repeated close while the original
    // Player shutdown guard owns sampling, reporting and native teardown.
    if let Err(error) = window.close() {
        state.exiting.store(false, Ordering::SeqCst);
        sync_menu(app);
        return Err(error.to_string());
    }
    sync_menu(app);
    Ok(())
}

#[tauri::command]
pub fn exit_app(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Application exit belongs to the main window".into());
    }
    exit_main(window.app_handle())
}

pub fn remove(app: &AppHandle) {
    app.state::<TrayState>()
        .available
        .store(false, Ordering::SeqCst);
    drop(app.remove_tray_by_id(TRAY_ID));
}

#[cfg(test)]
mod tests {
    use super::*;

    // Explicit opt-in: real HWNDs/WebView2, no player, provider or single-instance
    // plugin. Run only on an idle Windows QA desktop. API checks are not a
    // replacement for the physical resize/occlusion acceptance tests.
    #[cfg(windows)]
    #[test]
    #[ignore = "requires an idle Windows desktop and WebView2"]
    fn native_mini_overlay_visibility_level_and_resize_focus() {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let mut context = tauri::test::mock_context::<tauri::Wry, _>(tauri::test::noop_assets());
        context.config_mut().identifier = "com.miry.playeruie.window-regression".into();
        let mut app = tauri::Builder::default()
            .any_thread()
            .manage(TrayState::default())
            .manage(crate::mini_window::MiniWindow::default())
            .manage(crate::surface::Surface::default())
            .manage(crate::player_ui::OverlayOwner::default())
            .build(context)
            .unwrap();
        let main = tauri::WebviewWindowBuilder::new(
            &app,
            "main",
            tauri::WebviewUrl::External("about:blank".parse().unwrap()),
        )
        .title("Miry E window regression")
        .data_directory(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".cache/window-regression"),
        )
        .build()
        .unwrap();
        let handle = app.handle().clone();
        handle
            .state::<TrayState>()
            .available
            .store(true, Ordering::SeqCst);
        let rect = crate::surface::Rect {
            width: 640.0,
            height: 360.0,
            visible: true,
            ..Default::default()
        };
        handle
            .state::<crate::mini_window::MiniWindow>()
            .0
            .lock()
            .unwrap()
            .surface = rect.clone();
        crate::surface::update_surface(&main, rect.clone()).unwrap();
        crate::player_ui::player_overlay_attach(main.clone(), "window-regression".into()).unwrap();
        crate::player_ui::update_overlay(
            main.clone(),
            rect.clone(),
            Some("window-regression".into()),
        )
        .unwrap();
        crate::mini_window::apply(&main, "enter", "window-regression").unwrap();
        let mini = crate::mini_window::host(&handle).unwrap();
        let overlay = handle.get_webview_window("player-ui").unwrap();
        let mini_hwnd = mini.hwnd().unwrap().0;
        let overlay_hwnd = overlay.hwnd().unwrap().0;
        let surface = handle.state::<crate::surface::Surface>().handle();
        {
            use tauri::Listener;
            let count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let received = count.clone();
            let listener = handle.listen("player-controls", move |event| {
                if event.payload() == "\"pointer\"" {
                    received.fetch_add(1, Ordering::SeqCst);
                }
            });
            unsafe {
                SendMessageW(surface as _, WM_MOUSEMOVE, 0, (7 << 16) | 5);
                let first = count.load(Ordering::SeqCst);
                assert!(
                    first > 0,
                    "native Surface movement wakes the owned control bridge"
                );
                SendMessageW(surface as _, WM_MOUSEMOVE, 0, (7 << 16) | 5);
                assert_eq!(
                    count.load(Ordering::SeqCst),
                    first,
                    "stationary cursor does not wake controls"
                );
            }
            handle.unlisten(listener);
        }
        unsafe {
            // Tao keeps WS_CAPTION for native sizing and removes the actual
            // caption through WM_NCCALCSIZE; verify the client bounds instead.
            assert_ne!(
                GetWindowLongPtrW(mini_hwnd, GWL_STYLE) & WS_THICKFRAME as isize,
                0,
                "Mini retains native resizing"
            );
            let mut bounds = std::mem::zeroed();
            assert_ne!(GetWindowRect(mini_hwnd, &mut bounds), 0);
            let mut client = std::mem::zeroed();
            assert_ne!(GetClientRect(mini_hwnd, &mut client), 0);
            assert!(
                bounds.bottom - bounds.top - client.bottom
                    <= bounds.right - bounds.left - client.right,
                "Mini has no caption height in addition to its resize borders"
            );
            for (x, y, edge) in [
                (bounds.left + 1, (bounds.top + bounds.bottom) / 2, HTLEFT),
                (bounds.right - 2, (bounds.top + bounds.bottom) / 2, HTRIGHT),
                (
                    (bounds.left + bounds.right) / 2,
                    bounds.bottom - 2,
                    HTBOTTOM,
                ),
            ] {
                let point = ((y as u32 & 0xffff) << 16) | (x as u32 & 0xffff);
                assert_eq!(
                    SendMessageW(mini_hwnd, WM_NCHITTEST, 0, point as isize),
                    edge as isize,
                    "undecorated Mini resize hit test"
                );
            }
        }
        // Native event injection tests focus ownership, not physical resizing.
        // The real before-fix failure is documented with unchanged HWND bounds.
        mini.set_focus().unwrap();
        unsafe {
            SendMessageW(mini_hwnd, WM_ENTERSIZEMOVE, 0, 0);
        }
        crate::mini_window::focus_controls(&mini).unwrap();
        unsafe {
            assert_eq!(GetForegroundWindow(), mini_hwnd, "size loop retains focus");
            SendMessageW(mini_hwnd, WM_EXITSIZEMOVE, 0, 0);
            assert_eq!(
                GetForegroundWindow(),
                overlay_hwnd,
                "controls regain keyboard focus"
            );
        }
        main.minimize().unwrap();
        assert!(mini.is_visible().unwrap(), "ordinary minimize keeps Mini");
        assert!(overlay.is_visible().unwrap());
        for _ in 0..3 {
            assert!(hide_main(&handle).unwrap());
            unsafe {
                assert_eq!(IsWindowVisible(main.hwnd().unwrap().0), 0);
                assert_eq!(IsWindowVisible(mini_hwnd), 0);
                assert_eq!(
                    IsWindowVisible(overlay_hwnd),
                    0,
                    "Overlay must actually hide"
                );
            }
            // A late viewport refresh cannot revive a hidden host's Overlay.
            crate::mini_window::refresh(&handle).unwrap();
            assert!(!overlay.is_visible().unwrap());
            show_main(&handle).unwrap();
            assert!(mini.is_visible().unwrap());
            assert!(overlay.is_visible().unwrap());
            assert_eq!(overlay.hwnd().unwrap().0, overlay_hwnd);
            assert_eq!(handle.state::<crate::surface::Surface>().handle(), surface);
        }
        for pinned in [true, false] {
            crate::mini_window::apply(&main, "pin", "window-regression").unwrap();
            assert_eq!(mini.is_always_on_top().unwrap(), pinned);
            assert_eq!(overlay.is_always_on_top().unwrap(), pinned);
            unsafe {
                assert_eq!(
                    GetWindowLongPtrW(overlay_hwnd, GWL_EXSTYLE) & WS_EX_TOPMOST as isize != 0,
                    pinned
                );
            }
        }
        for main_topmost in [false, true] {
            let departing = crate::mini_window::host(&handle).unwrap().hwnd().unwrap().0;
            main.set_always_on_top(main_topmost).unwrap();
            crate::mini_window::apply(&main, "pin", "window-regression").unwrap();
            crate::mini_window::refresh(&handle).unwrap();
            assert!(overlay.is_always_on_top().unwrap());
            crate::mini_window::leave(&handle, true).unwrap();
            // Destroy is delivered through the runtime event queue.
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
            while unsafe { IsWindow(departing) } != 0 && std::time::Instant::now() < deadline {
                #[allow(deprecated)]
                app.run_iteration(|_, _| {});
            }
            unsafe {
                assert_eq!(IsWindow(departing), 0);
                assert_eq!(GetWindow(overlay_hwnd, GW_OWNER), main.hwnd().unwrap().0);
                assert_eq!(
                    GetWindowLongPtrW(overlay_hwnd, GWL_EXSTYLE) & WS_EX_TOPMOST as isize != 0,
                    main_topmost
                );
            }
            assert_eq!(overlay.is_always_on_top().unwrap(), main_topmost);
            if !main_topmost {
                crate::mini_window::apply(&main, "enter", "window-regression").unwrap();
            }
        }
        crate::player_ui::dispose(&handle).unwrap();
        main.destroy().unwrap();
        #[allow(deprecated)]
        app.run_iteration(|_, _| {});
        unsafe {
            assert_eq!(IsWindow(overlay_hwnd), 0);
        }
        app.cleanup_before_exit();
    }

    #[test]
    fn missing_tray_never_hides_even_with_enabled_preferences() {
        let state = TrayState::default();
        *state.behavior.lock().unwrap() = TrayBehavior {
            close_to_tray: true,
            minimize_to_tray: true,
        };
        assert!(!state.can_hide());
        assert!(!state.hide_on_close());
        assert!(!state.hide_on_minimize());
    }

    #[test]
    fn tray_ready_retains_old_defaults() {
        let state = TrayState::default();
        state.available.store(true, Ordering::SeqCst);
        assert!(state.can_hide());
        assert!(!state.hide_on_close());
        assert!(!state.hide_on_minimize());
    }

    #[test]
    fn independent_preferences_and_repeated_exit_never_reenable_hiding() {
        for close_to_tray in [false, true] {
            for minimize_to_tray in [false, true] {
                let state = TrayState::default();
                state.available.store(true, Ordering::SeqCst);
                *state.behavior.lock().unwrap() = TrayBehavior {
                    close_to_tray,
                    minimize_to_tray,
                };
                assert_eq!(state.hide_on_close(), close_to_tray);
                assert_eq!(state.hide_on_minimize(), minimize_to_tray);
                for _ in 0..3 {
                    state.request_exit();
                    assert!(state.is_exiting());
                    assert!(!state.hide_on_close());
                    assert!(!state.hide_on_minimize());
                    assert!(!state.can_hide());
                }
            }
        }
    }

    #[test]
    fn menus_follow_real_visibility_focus_and_exit() {
        assert_eq!(menu_enabled(true, false, true, false), [false, true, true]);
        assert_eq!(menu_enabled(true, false, false, false), [true, true, true]);
        assert_eq!(
            menu_enabled(false, false, false, false),
            [true, false, true]
        );
        assert_eq!(menu_enabled(false, true, false, false), [true, false, true]);
        assert_eq!(menu_enabled(true, true, false, false), [true, true, true]);
        for visible in [false, true] {
            assert_eq!(menu_enabled(visible, false, false, true), [false; 3]);
        }
    }

    #[test]
    fn ipc_rejects_invalid_boolean_preferences() {
        for input in [
            r#"{"closeToTray":"true","minimizeToTray":true}"#,
            r#"{"closeToTray":true,"minimizeToTray":1}"#,
            "{}",
        ] {
            assert!(serde_json::from_str::<TrayBehavior>(input).is_err());
        }
    }
}
