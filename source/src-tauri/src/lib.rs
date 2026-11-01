#[cfg(windows)]
mod child_job;
mod danmaku;
mod danmaku_sources;
mod desktop;
mod display;
mod final_save;
mod mini_window;
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
mod source_credentials;
mod surface;
mod system_media;
mod tray;
mod updater;
mod video_fit;
mod window_state;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || { let _ = tray::show_main(&handle); });
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::Service::default())
        .manage(player::Player::default())
        .manage(final_save::FinalSave::default())
        .manage(danmaku::Files::default())
        .manage(danmaku_sources::Service::default())
        .manage(online_danmaku::Service::default())
        .manage(surface::Surface::default())
        .manage(player_ui::OverlayOwner::default())
        .manage(mini_window::MiniWindow::default())
        .manage(routes::Probes::default())
        .manage(system_media::SystemMedia::default())
        .manage(tray::TrayState::default())
        .manage(window_state::WindowState::default())
        .setup(|app| {
            if tray::initialize(app.handle()).is_err() {
                eprintln!("Miry tray initialization failed; normal window behavior retained");
            }
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
                    if window.state::<tray::TrayState>().is_exiting() { continue; }
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
            player::player_mini,
            player::player_status,
            player::player_clock,
            danmaku::danmaku_pick,
            danmaku::danmaku_read,
            danmaku::danmaku_bind,
            danmaku::danmaku_binding,
            danmaku_sources::danmaku_source_key,
            danmaku_sources::danmaku_source_request,
            danmaku_sources::danmaku_source_cancel,
            online_danmaku::danmaku_online_status,
            online_danmaku::danmaku_online_configure,
            online_danmaku::danmaku_online_request,
            online_danmaku::danmaku_online_cancel,
            player::player_control,
            player::player_video_fit,
            player::player_key,
            player::player_stop,
            final_save::player_final_saved,
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
            updater::download_update,
            updater::cancel_update_download,
            updater::prepare_update_install,
            updater::install_update,
            updater::cancel_update_install,
            desktop::open_release,
            desktop::export_diagnostics,
            system_media::system_media_update,
            system_media::system_media_status,
            tray::set_tray_behavior,
            tray::exit_app
        ])
        .on_window_event(|window, event| {
            if window.label().starts_with("player-mini-") {
                if !mini_window::host(window.app_handle()).is_some_and(|w| w.label() == window.label()) { return; }
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = mini_window::leave(window.app_handle(), true);
                    }
                    tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                        if mini_window::active(window.app_handle()) { let _ = mini_window::refresh(window.app_handle()); }
                    }
                    tauri::WindowEvent::Focused(focused) => {
                        if let Some(overlay) = window.app_handle().get_webview_window("player-ui") {
                            if *focused {
                                let _ = overlay.emit("player-controls", "resume");
                                let _ = mini_window::focus_controls(window);
                            }
                            else if !overlay.is_focused().unwrap_or(false) { let _ = overlay.emit("player-controls", "suspend"); }
                        }
                    }
                    _ => {}
                }
                return;
            }
            if matches!(event, tauri::WindowEvent::Resized(_) | tauri::WindowEvent::CloseRequested { .. }) {
                window_state::remember(window);
            }
            if let tauri::WindowEvent::Focused(focused) = event {
                if let Some(overlay) = window.app_handle().get_webview_window("player-ui") {
                    let other = if window.label() == "main" { Some(overlay.clone()) } else { window.app_handle().get_webview_window("main") };
                    if *focused {
                        let _ = overlay.emit("player-controls", "resume");
                    } else if !other.is_some_and(|w| w.is_focused().unwrap_or(false)) && !mini_window::host(window.app_handle()).is_some_and(|w| w.is_focused().unwrap_or(false)) {
                        let _ = overlay.emit("player-controls", "suspend");
                    }
                }
            }
            if window.label() == "player-ui" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if mini_window::active(window.app_handle()) {
                        let _ = mini_window::leave(window.app_handle(), true);
                        return;
                    }
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        let _ = main.close();
                    }
                }
                return;
            }
            if window.label() != "main" { return; }
            if matches!(event, tauri::WindowEvent::Destroyed) {
                tray::remove(window.app_handle());
                return;
            }
            if matches!(event, tauri::WindowEvent::Focused(_) | tauri::WindowEvent::Resized(_)) {
                tray::sync_menu(window.app_handle());
            }
            if matches!(event, tauri::WindowEvent::Resized(_)) && window.is_minimized().unwrap_or(false) {
                if !mini_window::active(window.app_handle()) { let _ = tray::suspend_overlay(window.app_handle()); }
                if window.state::<tray::TrayState>().hide_on_minimize() {
                    let _ = tray::hide_main(window.app_handle());
                }
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.state::<tray::TrayState>().hide_on_close()
                    && tray::hide_main(window.app_handle()).unwrap_or(false)
                { return; }
                window.state::<tray::TrayState>().request_exit();
                tray::sync_menu(window.app_handle());
                if !player::begin_shutdown(&window.state::<player::Player>()) {
                    return;
                }
                if player_ui::dispose(window.app_handle()).is_err() {
                    eprintln!("shutdown: overlay disposal failed");
                }
                let window = window.clone();
                if let Ok(path) = recovery::path(window.app_handle()) {
                    recovery::clear(&path);
                }
                tauri::async_runtime::spawn(async move {
                    let mut sampled = None;
                    let stopped = player::stop(&window.state::<player::Player>(), |sample| {
                        sampled = Some(sample.clone());
                        let _ = window.emit("player-final-snapshot", sample);
                    })
                    .await;
                    let state = match stopped {
                        Ok(state) => Some(state),
                        Err(_) => {
                            eprintln!("shutdown: player stop or final reporting failed");
                            sampled
                        }
                    };
                    if let Some(state) = state {
                        if let Err(error) = final_save::persist(&window, &state).await {
                            eprintln!("shutdown: {error}");
                        }
                    }
                    if window.destroy().is_err() {
                        eprintln!("shutdown: window destruction failed");
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("Miry could not start");
}
