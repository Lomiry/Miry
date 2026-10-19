//! Main-window maximization only; playback fullscreen and monitor coordinates are temporary.
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};
use tauri::Manager;

#[derive(Default)]
pub struct WindowState(pub Mutex<Option<bool>>);

#[derive(Serialize, Deserialize)]
struct SavedState {
    maximized: bool,
}

fn read(path: &Path) -> bool {
    std::fs::read(path)
        .ok()
        .and_then(|data| serde_json::from_slice::<SavedState>(&data).ok())
        .is_some_and(|state| state.maximized)
}

fn write(path: &Path, maximized: bool) -> std::io::Result<()> {
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, serde_json::to_vec(&SavedState { maximized })?)?;
    std::fs::rename(temporary, path)
}

pub fn restore(window: &tauri::WebviewWindow) {
    let maximized = window
        .app_handle()
        .path()
        .app_local_data_dir()
        .ok()
        .is_some_and(|dir| read(&dir.join("window-state.json")));
    *window.state::<WindowState>().0.lock().unwrap() = Some(maximized);
    if maximized {
        let _ = window.maximize();
    }
}

pub fn remember(window: &tauri::Window) {
    if window.label() != "main"
        || window.is_fullscreen().unwrap_or(true)
        || window.is_minimized().unwrap_or(true)
    {
        return;
    }
    let Ok(maximized) = window.is_maximized() else {
        return;
    };
    let state = window.state::<WindowState>();
    let mut previous = state.0.lock().unwrap();
    if *previous == Some(maximized) {
        return;
    }
    let saved = (|| {
        let dir = window
            .app_handle()
            .path()
            .app_local_data_dir()
            .map_err(std::io::Error::other)?;
        std::fs::create_dir_all(&dir)?;
        write(&dir.join("window-state.json"), maximized)
    })();
    if saved.is_ok() {
        *previous = Some(maximized);
    } else {
        eprintln!("main window state could not be saved");
    }
}

#[test]
fn persists_maximize_restore_and_recovers_missing_or_corrupt_state() {
    let dir = std::env::temp_dir().join(format!("miry-window-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&dir).unwrap();
    let path = dir.join("window-state.json");
    assert!(!read(&path));
    write(&path, true).unwrap();
    assert!(read(&path));
    write(&path, false).unwrap();
    assert!(!read(&path));
    for invalid in ["{", "{\"maximized\":\"true\"}", "{\"fullscreen\":true}"] {
        std::fs::write(&path, invalid).unwrap();
        assert!(!read(&path));
    }
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(dir).unwrap();
}
