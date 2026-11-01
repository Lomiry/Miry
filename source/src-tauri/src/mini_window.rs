//! A window target for the existing surface, never a second playback session.
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct MiniWindow(pub Mutex<MiniState>);
#[derive(Default)]
pub struct MiniState {
    revision: u64,
    pub session: Option<String>,
    pub label: Option<String>,
    fullscreen: bool,
    pub surface: crate::surface::Rect,
    pub overlay: crate::surface::Rect,
}
#[derive(Clone, serde::Serialize)]
pub struct Presentation {
    active: bool,
    session: String,
    revision: u64,
}
pub fn presentation(app: &tauri::AppHandle, session: &str) -> Presentation {
    let state = app.state::<MiniWindow>();
    let state = state.0.lock().unwrap();
    Presentation {
        active: state.session.as_deref() == Some(session),
        session: session.into(),
        revision: state.revision,
    }
}

// Transfer media ownership inside the same Mini host; never restore old geometry
// or recreate a host after the user has already left Mini during loading.
pub fn retarget(app: &tauri::AppHandle, session: &str) -> Result<(), String> {
    {
        let state = app.state::<MiniWindow>();
        let mut state = state.0.lock().map_err(|e| e.to_string())?;
        if state.session.is_none() {
            return Ok(());
        }
        state.session = Some(session.into());
        state.revision += 1;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.emit("player-mini-changed", presentation(app, session))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn host(app: &tauri::AppHandle) -> Option<tauri::Window> {
    let label = app.state::<MiniWindow>().0.lock().unwrap().label.clone()?;
    app.get_window(&label)
}

pub fn active(app: &tauri::AppHandle) -> bool {
    app.state::<MiniWindow>()
        .0
        .lock()
        .unwrap()
        .session
        .is_some()
}

// A native border gesture must retain focus until Windows exits its modal
// move/size loop. The WebView remains the keyboard owner outside that gesture.
pub fn focus_controls(host: &tauri::Window) -> Result<(), String> {
    let app = host.app_handle();
    if app.state::<crate::tray::TrayState>().is_exiting()
        || !self::host(app).is_some_and(|current| current.label() == host.label())
        || !host.is_visible().unwrap_or(false)
        || host.is_minimized().unwrap_or(false)
    {
        return Ok(());
    }
    #[cfg(windows)]
    if native_input::is_interacting(host.hwnd().map_err(|e| e.to_string())?.0) {
        return Ok(());
    }
    if let Some(overlay) = app.get_webview_window("player-ui") {
        if overlay.is_visible().unwrap_or(false) {
            overlay.set_focus().map_err(|e| e.to_string())?;
            let webview: &tauri::Webview = overlay.as_ref();
            webview.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(windows)]
mod native_input {
    use std::{cell::Cell, rc::Rc};
    use tauri::Manager;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM},
        UI::{
            Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON},
            Shell::*,
            WindowsAndMessaging::*,
        },
    };

    const SUBCLASS_ID: usize = 1;
    struct InputOwner {
        app: tauri::AppHandle,
        label: String,
        interacting: Cell<bool>,
    }
    fn move_or_size(hit: u32) -> bool {
        hit == HTCAPTION || (HTLEFT..=HTBOTTOMRIGHT).contains(&hit)
    }
    pub(super) fn is_interacting(hwnd: HWND) -> bool {
        unsafe {
            let mut data = 0;
            if GetWindowSubclass(hwnd, Some(window_proc), SUBCLASS_ID, &mut data) != 0
                && (&*(data as *const Rc<InputOwner>)).interacting.get()
            {
                return true;
            }
            // Activation can arrive before WM_NCLBUTTONDOWN/ENTERSIZEMOVE.
            let mut cursor = POINT { x: 0, y: 0 };
            GetAsyncKeyState(VK_LBUTTON as i32) < 0
                && GetCursorPos(&mut cursor) != 0
                && move_or_size(SendMessageW(
                    hwnd,
                    WM_NCHITTEST,
                    0,
                    ((cursor.y as u16 as u32) << 16 | cursor.x as u16 as u32) as isize,
                ) as u32)
        }
    }
    pub(super) fn install(host: &tauri::Window) -> Result<(), String> {
        let hwnd = host.hwnd().map_err(|e| e.to_string())?.0;
        let owner = Box::new(Rc::new(InputOwner {
            app: host.app_handle().clone(),
            label: host.label().into(),
            interacting: Cell::new(false),
        }));
        let data = Box::into_raw(owner);
        unsafe {
            if SetWindowSubclass(hwnd, Some(window_proc), SUBCLASS_ID, data as usize) == 0 {
                drop(Box::from_raw(data));
                return Err("Mini input ownership unavailable".into());
            }
        }
        Ok(())
    }
    unsafe extern "system" fn window_proc(
        hwnd: HWND,
        msg: u32,
        wp: WPARAM,
        lp: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        // DefSubclassProc can dispatch nested destruction. Keep the context alive
        // until this callback returns; NCDESTROY releases the installed reference.
        let owner = Rc::clone(&*(data as *const Rc<InputOwner>));
        if msg == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(window_proc), id);
            drop(Box::from_raw(data as *mut Rc<InputOwner>));
            return DefSubclassProc(hwnd, msg, wp, lp);
        }
        let nonclient = msg == WM_NCLBUTTONDOWN && move_or_size(wp as u32);
        if nonclient || msg == WM_ENTERSIZEMOVE {
            owner.interacting.set(true);
        }
        let result = DefSubclassProc(hwnd, msg, wp, lp);
        if nonclient || msg == WM_EXITSIZEMOVE {
            owner.interacting.set(false);
            if let Some(host) = super::host(&owner.app).filter(|w| w.label() == owner.label) {
                // A late event must not steal focus from another application.
                if GetForegroundWindow() == hwnd {
                    let _ = super::focus_controls(&host);
                }
            }
        }
        result
    }
}

pub fn target(
    main: &tauri::WebviewWindow,
    rect: &crate::surface::Rect,
) -> Result<(tauri::Window, crate::surface::Rect), String> {
    if active(main.app_handle()) {
        if let Some(host) = host(main.app_handle()) {
            let size = host.inner_size().map_err(|e| e.to_string())?;
            let scale = host.scale_factor().map_err(|e| e.to_string())?;
            return Ok((
                host.clone(),
                crate::surface::Rect {
                    x: 0.0,
                    y: 0.0,
                    width: size.width as f64 / scale,
                    height: size.height as f64 / scale,
                    visible: host.is_visible().unwrap_or(false)
                        && !host.is_minimized().unwrap_or(false),
                },
            ));
        }
    }
    Ok((
        main.app_handle()
            .get_window(main.label())
            .ok_or("Main window unavailable")?,
        rect.clone(),
    ))
}

#[cfg(windows)]
pub fn reparent(surface: usize, parent: usize) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    if surface == 0 {
        return Err("Video surface unavailable".into());
    }
    unsafe {
        ShowWindow(surface as _, SW_HIDE);
        SetParent(surface as _, parent as _);
        if GetParent(surface as _) as usize != parent {
            return Err("Video surface transfer failed".into());
        }
    }
    Ok(())
}

pub fn refresh(app: &tauri::AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    let (surface, overlay) = {
        let state = app.state::<MiniWindow>();
        let state = state.0.lock().map_err(|e| e.to_string())?;
        (state.surface.clone(), state.overlay.clone())
    };
    crate::surface::update_surface(&main, surface)?;
    crate::player_ui::update_overlay(main, overlay, None)
}

pub fn leave(app: &tauri::AppHandle, restore: bool) -> Result<(), String> {
    if !active(app) && host(app).is_none() {
        return Ok(());
    }
    let main = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    let fullscreen = app.state::<MiniWindow>().0.lock().unwrap().fullscreen;
    #[cfg(windows)]
    if host(app).is_some() {
        // Return the child before destroying its temporary parent.
        reparent(
            main.state::<crate::surface::Surface>().handle(),
            main.hwnd().map_err(|e| e.to_string())?.0 as usize,
        )?;
        if let Some(overlay) = app.get_webview_window("player-ui") {
            overlay.hide().map_err(|e| e.to_string())?;
            let target = app.get_window("main").ok_or("Main window unavailable")?;
            crate::player_ui::bind_host(&overlay, &target)?;
        }
    }
    let window = host(app);
    let session = {
        let state = app.state::<MiniWindow>();
        let mut state = state.0.lock().unwrap();
        state.label = None;
        state.revision += 1;
        state.session.take()
    };
    if let Some(host) = window {
        host.destroy().map_err(|e| e.to_string())?;
    }
    if let Some(session) = session {
        main.emit("player-mini-changed", presentation(app, &session))
            .map_err(|e| e.to_string())?;
    }
    if restore {
        crate::tray::show_main(app)?;
        crate::player::set_fullscreen(&main, fullscreen)?;
        refresh(app)?;
    }
    Ok(())
}

pub fn apply(
    main: &tauri::WebviewWindow,
    command: &str,
    session: &str,
) -> Result<Presentation, String> {
    let app = main.app_handle();
    if app.state::<crate::tray::TrayState>().is_exiting() {
        return Err("Application is exiting".into());
    }
    let current = app.state::<MiniWindow>().0.lock().unwrap().session.clone();
    if command != "enter" && current.as_deref() != Some(session) {
        return Err("Stale mini window action".into());
    }
    match command {
        "enter" => {
            if current.is_some() {
                return Ok(presentation(app, session));
            }
            #[cfg(not(windows))]
            return Err("Mini window requires Windows".into());
            #[cfg(windows)]
            {
                let fullscreen = main.is_fullscreen().map_err(|e| e.to_string())?;
                let label = format!("player-mini-{}", uuid::Uuid::new_v4());
                let host = tauri::WindowBuilder::new(app, &label)
                    .title("Miry")
                    .inner_size(480.0, 270.0)
                    .min_inner_size(320.0, 180.0)
                    .resizable(true)
                    .decorations(false)
                    .visible(false)
                    .build()
                    .map_err(|e| e.to_string())?;
                if let Err(error) = native_input::install(&host) {
                    let _ = host.destroy();
                    return Err(error);
                }
                if let Err(error) = reparent(
                    main.state::<crate::surface::Surface>().handle(),
                    host.hwnd().map_err(|e| e.to_string())?.0 as usize,
                ) {
                    let _ = host.destroy();
                    return Err(error);
                }
                {
                    let state = app.state::<MiniWindow>();
                    let mut state = state.0.lock().unwrap();
                    state.session = Some(session.to_string());
                    state.revision += 1;
                    state.label = Some(label);
                    state.fullscreen = fullscreen;
                }
                let result = (|| {
                    crate::player::set_fullscreen(main, false)?;
                    host.show().map_err(|e| e.to_string())?;
                    refresh(app)?;
                    host.set_focus().map_err(|e| e.to_string())?;
                    focus_controls(&host)?;
                    main.emit("player-mini-changed", presentation(app, session))
                        .map_err(|e| e.to_string())?;
                    Ok(())
                })();
                if let Err(error) = result {
                    let _ = leave(app, true);
                    return Err(error);
                }
            }
        }
        "leave" => {
            leave(app, true)?;
        }
        "pin" => {
            let host = host(app).ok_or("Mini window unavailable")?;
            host.set_always_on_top(!host.is_always_on_top().map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            refresh(app)?;
        }
        "drag" => {
            host(app)
                .ok_or("Mini window unavailable")?
                .start_dragging()
                .map_err(|e| e.to_string())?;
        }
        _ => return Err("Invalid mini window action".into()),
    }
    Ok(presentation(app, session))
}
