//! Local interrupted playback only. Never contains endpoints or credentials.
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub server_id: String,
    pub item_id: String,
    pub source_id: String,
    pub title: String,
    pub position: f64,
    pub audio_index: Option<i64>,
    pub subtitle_index: Option<i64>,
    pub version: String,
    pub timestamp: u64,
}
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
// One-time upgrade cleanup only; never read or apply the retired display mode.
pub fn discard_retired_display_marker(app: &tauri::AppHandle) {
    if let Ok(dir) = app.path().app_data_dir() {
        discard_retired_display_files(&dir);
    }
}
fn discard_retired_display_files(dir: &Path) {
    for name in ["refresh-recovery.json", "refresh-recovery.tmp"] {
        if let Err(error) = std::fs::remove_file(dir.join(name)) {
            if error.kind() != std::io::ErrorKind::NotFound {
                eprintln!("retired display marker cleanup: {error}");
            }
        }
    }
}
#[test]
fn retired_display_cleanup_is_idempotent_and_preserves_playback_recovery() {
    let dir = std::env::temp_dir().join(format!("miry-retired-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&dir).unwrap();
    for name in [
        "refresh-recovery.json",
        "refresh-recovery.tmp",
        "playback-recovery.json",
    ] {
        std::fs::write(dir.join(name), b"unchanged").unwrap();
    }
    discard_retired_display_files(&dir);
    discard_retired_display_files(&dir);
    assert!(!dir.join("refresh-recovery.json").exists());
    assert!(!dir.join("refresh-recovery.tmp").exists());
    assert_eq!(
        std::fs::read(dir.join("playback-recovery.json")).unwrap(),
        b"unchanged"
    );
    std::fs::remove_file(dir.join("playback-recovery.json")).unwrap();
    std::fs::remove_dir(dir).unwrap();
}
pub fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "恢复目录不可用")?;
    std::fs::create_dir_all(&dir).map_err(|_| "恢复目录不可用")?;
    Ok(dir.join("playback-recovery.json"))
}
impl Record {
    pub fn valid(&self) -> bool {
        !self.server_id.is_empty()
            && self.server_id.len() <= 256
            && !self.item_id.is_empty()
            && self.item_id.len() <= 256
            && self.source_id.len() <= 256
            && self.title.len() <= 2048
            && self.position.is_finite()
            && self.position >= 0.
            && self.position < 365. * 86400.
            && self.timestamp <= now() + 60000
            && now().saturating_sub(self.timestamp) < 7 * 86400000
    }
}
pub fn save(path: &Path, record: &Record) -> Result<(), String> {
    if !record.valid() {
        return Err("恢复记录无效".into());
    }
    let temp = path.with_extension("tmp");
    let data = serde_json::to_vec(record).map_err(|_| "恢复记录无法编码")?;
    use std::io::Write;
    let mut file = std::fs::File::create(&temp).map_err(|_| "恢复记录无法保存")?;
    file.write_all(&data)
        .and_then(|_| file.sync_all())
        .map_err(|_| "恢复记录无法保存")?;
    drop(file);
    std::fs::rename(temp, path).map_err(|_| "恢复记录无法保存".into())
}
pub fn clear(path: &Path) {
    let _ = std::fs::remove_file(path);
}
pub fn read(path: &Path) -> Option<Record> {
    let bytes = std::fs::read(path).ok()?;
    if bytes.len() > 16384 {
        clear(path);
        return None;
    }
    let record = serde_json::from_slice::<Record>(&bytes)
        .ok()
        .filter(Record::valid);
    if record.is_none() {
        clear(path);
    }
    record
}
#[tauri::command]
pub fn recovery_read(window: tauri::WebviewWindow) -> Result<Option<Record>, String> {
    if window.label() != "main" {
        return Err("恢复由主窗口管理".into());
    }
    Ok(read(&path(window.app_handle())?))
}
#[tauri::command]
pub fn recovery_clear(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("恢复由主窗口管理".into());
    }
    clear(&path(window.app_handle())?);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn atomic_record_survives_reopen_and_expires_without_credentials() {
        let p = std::env::temp_dir().join(format!("miry-recovery-{}.json", uuid::Uuid::new_v4()));
        let mut r = Record {
            server_id: "s".into(),
            item_id: "m".into(),
            source_id: "v".into(),
            title: "QA".into(),
            position: 123.,
            audio_index: Some(1),
            subtitle_index: Some(-1),
            version: "0.13.3".into(),
            timestamp: now(),
        };
        save(&p, &r).unwrap();
        r.position = 125.;
        save(&p, &r).unwrap();
        assert_eq!(read(&p).unwrap().position, 125.);
        let text = std::fs::read_to_string(&p).unwrap();
        assert!(!text.contains("token"));
        assert!(!text.contains("serverUrl"));
        r.timestamp = now() - 8 * 86400000;
        assert!(!r.valid());
        clear(&p);
        assert!(read(&p).is_none());
    }
}
