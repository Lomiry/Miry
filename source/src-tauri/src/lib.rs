#[cfg(windows)]
mod child_job;
mod danmaku;
mod desktop;
mod display;
mod network;
#[cfg(test)]
mod network_ipc_tests;
mod online_danmaku;
mod player;
mod player_ui;
mod quality;
mod recovery;
mod release;
mod routes;
mod shortcuts;
mod surface;
mod system_media;
mod video_fit;
mod window_state;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_http::init())
        .manage(player::Player::default())
        .manage(danmaku::Files::default())
        .manage(online_danmaku::Service::default())
        .manage(surface::Surface::default())
        .manage(player_ui::OverlayOwner::default())
        .manage(routes::Probes::default())
        .manage(system_media::SystemMedia::default())
        .manage(window_state::WindowState::default())
        .setup(|app| {
            recovery::discard_retired_display_marker(app.handle());
            let window = app.get_webview_window("main").ok_or("主窗口不可用")?;
            window_state::restore(&window);
            #[cfg(windows)]
            system_media::initialize(&window);
            #[cfg(windows)]
            surface::watch_pointer(window.clone());
            let (events, mut receiver) = tokio::sync::mpsc::channel(4);
            *app.state::<player::Player>().1.lock().unwrap() = Some(events);
            tauri::async_runtime::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    let fullscreen = match event {
                        player::UiEvent::Key(code) => {
                            let base = code.rsplit('+').next().unwrap_or(&code);
                            let key = match base {
                                "Space" => " ".into(),
                                c if c.starts_with("Key") => c[3..].to_ascii_lowercase(),
                                c if c.starts_with("Digit") => c[5..].into(),
                                c => c.into(),
                            };
                            let _ = window.emit(
                                "player-ui-key",
                                serde_json::json!({"key":key,"code":base,"shiftKey":code.split('+').any(|p| p=="Shift"),"ctrlKey":code.split('+').any(|p| p=="Ctrl"),"altKey":code.split('+').any(|p| p=="Alt")}),
                            );
                            continue;
                        }
                        player::UiEvent::ToggleFullscreen => {
                            !window.is_fullscreen().unwrap_or(false)
                        }
                        player::UiEvent::ExitFullscreen => {
                            let _ = window.emit("player-ui-key", serde_json::json!({"key":"Escape","code":"Escape","shiftKey":false}));
                            continue;
                        }
                        player::UiEvent::ToggleControls => {
                            let _ = window.emit("player-controls", "toggle");
                            continue;
                        }
                        player::UiEvent::RevealControls => {
                            let _ = window.emit("player-controls", "keyboard");
                            continue;
                        }
                    };
                    let _ = player::set_fullscreen(&window, fullscreen);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            player::player_start,
            player::player_status,
            player::player_clock,
            danmaku::danmaku_pick,
            danmaku::danmaku_read,
            danmaku::danmaku_bind,
            danmaku::danmaku_binding,
            online_danmaku::danmaku_online_status,
            online_danmaku::danmaku_online_configure,
            online_danmaku::danmaku_online_request,
            online_danmaku::danmaku_online_cancel,
            player::player_control,
            player::player_video_fit,
            player::player_key,
            player::player_stop,
            surface::player_surface,
            player_ui::player_overlay,
            player_ui::player_overlay_attach,
            player_ui::player_overlay_release,
            player_ui::player_overlay_focus,
            player_ui::player_ui_geometry,
            quality::mpv_config_files,
            quality::open_mpv_directory,
            quality::audio_devices,
            network::diagnose_server,
            routes::route_probe,
            routes::cancel_route_probe,
            recovery::recovery_read,
            recovery::recovery_clear,
            desktop::check_release,
            desktop::open_release,
            desktop::export_diagnostics,
            system_media::system_media_update,
            system_media::system_media_status
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Resized(_) | tauri::WindowEvent::CloseRequested { .. }) {
                window_state::remember(window);
            }
            if let tauri::WindowEvent::Focused(focused) = event {
                if let Some(overlay) = window.app_handle().get_webview_window("player-ui") {
                    let other = if window.label() == "main" { Some(overlay.clone()) } else { window.app_handle().get_webview_window("main") };
                    if *focused {
                        let _ = overlay.emit("player-controls", "resume");
                    } else if !other.is_some_and(|w| w.is_focused().unwrap_or(false)) {
                        let _ = overlay.emit("player-controls", "suspend");
                    }
                }
            }
            if window.label() == "player-ui" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        let _ = main.close();
                    }
                }
                return;
            }
            if matches!(event, tauri::WindowEvent::Resized(_)) && window.is_minimized().unwrap_or(false) {
                if let Some(overlay) = window.app_handle().get_webview_window("player-ui") {
                    let _ = overlay.emit("player-controls", "suspend");
                    let _ = overlay.hide();
                }
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if !player::begin_shutdown(&window.state::<player::Player>()) {
                    return;
                }
                let _ = player_ui::dispose(window.app_handle());
                let window = window.clone();
                if let Ok(path) = recovery::path(window.app_handle()) {
                    recovery::clear(&path);
                }
                tauri::async_runtime::spawn(async move {
                    if let Ok(state) = player::stop(&window.state::<player::Player>(), |sample| {
                        let _ = window.emit("player-final-snapshot", sample);
                    })
                    .await
                    {
                        let _ = window.emit("player-final-snapshot", state);
                        // Let the existing frontend history listener persist the final sample.
                        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
                    }
                    let _ = window.destroy();
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("Miry could not start");
}
