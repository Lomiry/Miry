use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::Manager;
const MAX_BYTES: u64 = 8 * 1024 * 1024;
#[derive(Default)]
pub struct Files(Mutex<BTreeMap<String, PathBuf>>);
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Binding {
    reference: String,
    path: PathBuf,
    offset: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFile {
    reference: String,
    name: String,
    text: String,
    offset: f64,
}
fn key(scope: &str, item: &str, episode: &str) -> Result<String, String> {
    if scope.is_empty()
        || item.is_empty()
        || scope.len() > 2048
        || item.len() > 256
        || episode.len() > 256
    {
        return Err("弹幕绑定信息无效".into());
    }
    serde_json::to_string(&[scope, item, episode]).map_err(|_| "弹幕绑定信息无效".into())
}
fn read_text(path: &Path) -> Result<String, String> {
    if !["xml", "ass"].contains(
        &path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
    ) {
        return Err("请选择 Bilibili XML 或 ASS 文件。".into());
    }
    let file = fs::File::open(path).map_err(|_| "弹幕文件不可用，请重新选择或解除绑定。")?;
    let metadata = file.metadata().map_err(|_| "弹幕文件不可用")?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return Err("弹幕文件须小于 8 MiB。".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "弹幕文件不可用")?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("弹幕文件须小于 8 MiB。".into());
    }
    if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        let little = bytes[0] == 0xff;
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err("弹幕文件编码无效。".into());
        }
        let words: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|b| {
                if little {
                    u16::from_le_bytes([b[0], b[1]])
                } else {
                    u16::from_be_bytes([b[0], b[1]])
                }
            })
            .collect();
        String::from_utf16(&words).map_err(|_| "请将弹幕文件保存为 UTF-8 或 UTF-16。".into())
    } else {
        String::from_utf8(bytes)
            .map(|s| s.trim_start_matches('\u{feff}').to_owned())
            .map_err(|_| "请将弹幕文件保存为 UTF-8 或 UTF-16。".into())
    }
}
fn bindings(path: &Path) -> BTreeMap<String, Binding> {
    let read = || -> Option<BTreeMap<String, Binding>> {
        let file = fs::File::open(path).ok()?;
        if file.metadata().ok()?.len() > 4 * 1024 * 1024 {
            return None;
        }
        let mut bytes = Vec::new();
        file.take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .ok()?;
        if bytes.len() > 4 * 1024 * 1024 {
            return None;
        }
        serde_json::from_slice(&bytes).ok()
    };
    read().filter(|m| m.len() <= 1000).unwrap_or_default()
}
fn save(path: &Path, all: &BTreeMap<String, Binding>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "无法保存弹幕绑定")?;
    }
    let temp = path.with_extension("tmp");
    fs::write(
        &temp,
        serde_json::to_vec(all).map_err(|_| "无法保存弹幕绑定")?,
    )
    .map_err(|_| "无法保存弹幕绑定")?;
    fs::rename(temp, path).map_err(|_| "无法保存弹幕绑定".into())
}
fn storage(window: &tauri::WebviewWindow) -> Result<PathBuf, String> {
    if window.label() != "main" {
        return Err("弹幕文件仅由主窗口管理".into());
    }
    Ok(window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|_| "无法定位弹幕绑定")?
        .join("danmaku-bindings.json"))
}
fn presentation(binding: &Binding) -> Result<LocalFile, String> {
    Ok(LocalFile {
        reference: binding.reference.clone(),
        name: binding
            .path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .chars()
            .filter(|c| !c.is_control())
            .take(256)
            .collect(),
        text: read_text(&binding.path)?,
        offset: binding.offset,
    })
}
#[cfg(windows)]
fn pick(owner: usize) -> Result<Option<PathBuf>, String> {
    use windows_sys::Win32::UI::Controls::Dialogs::{
        GetOpenFileNameW, OFN_EXPLORER, OFN_FILEMUSTEXIST, OFN_NOCHANGEDIR, OFN_PATHMUSTEXIST,
        OPENFILENAMEW,
    };
    let mut name = vec![0u16; 32768];
    let filter: Vec<u16> = "Local Danmaku (XML / ASS)\0*.xml;*.ass\0\0"
        .encode_utf16()
        .collect();
    let title: Vec<u16> = "选择本地弹幕文件\0".encode_utf16().collect();
    let mut dialog = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: owner as _,
        lpstrFilter: filter.as_ptr(),
        lpstrFile: name.as_mut_ptr(),
        nMaxFile: name.len() as u32,
        lpstrTitle: title.as_ptr(),
        Flags: OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_EXPLORER | OFN_NOCHANGEDIR,
        ..Default::default()
    };
    if unsafe { GetOpenFileNameW(&mut dialog) } == 0 {
        return Ok(None);
    }
    let len = name.iter().position(|c| *c == 0).unwrap_or(name.len());
    Ok(Some(PathBuf::from(String::from_utf16_lossy(&name[..len]))))
}
#[tauri::command]
pub async fn danmaku_pick(
    window: tauri::WebviewWindow,
    files: tauri::State<'_, Files>,
) -> Result<Option<LocalFile>, String> {
    storage(&window)?;
    #[cfg(windows)]
    {
        let owner = window
            .app_handle()
            .get_webview_window("player-ui")
            .filter(|w| w.is_visible().unwrap_or(false))
            .unwrap_or(window.clone())
            .hwnd()
            .map_err(|_| "无法打开文件选择")?
            .0 as usize;
        let path = tauri::async_runtime::spawn_blocking(move || pick(owner))
            .await
            .map_err(|_| "无法打开文件选择")??;
        let Some(path) = path else { return Ok(None) };
        let binding = Binding {
            reference: uuid::Uuid::new_v4().to_string(),
            path,
            offset: 0.,
        };
        let result = presentation(&binding)?;
        let mut grants = files.0.lock().map_err(|_| "无法选择弹幕")?;
        if grants.len() >= 16 {
            let first = grants.keys().next().cloned().unwrap();
            grants.remove(&first);
        }
        grants.insert(binding.reference, binding.path);
        Ok(Some(result))
    }
    #[cfg(not(windows))]
    {
        let _ = files;
        Err("此版本仅支持 Windows".into())
    }
}
#[tauri::command]
pub async fn danmaku_read(
    window: tauri::WebviewWindow,
    files: tauri::State<'_, Files>,
    scope: String,
    item_id: String,
    episode_id: String,
) -> Result<Option<LocalFile>, String> {
    let path = storage(&window)?;
    let key = key(&scope, &item_id, &episode_id)?;
    let _guard = files.0.lock().map_err(|_| "无法读取弹幕绑定")?;
    bindings(&path).get(&key).map(presentation).transpose()
}
#[tauri::command]
pub async fn danmaku_bind(
    window: tauri::WebviewWindow,
    files: tauri::State<'_, Files>,
    scope: String,
    item_id: String,
    episode_id: String,
    reference: String,
    offset: f64,
) -> Result<(), String> {
    let storage = storage(&window)?;
    let key = key(&scope, &item_id, &episode_id)?;
    let mut grants = files.0.lock().map_err(|_| "无法保存弹幕绑定")?;
    let path = grants.remove(&reference).ok_or("请重新选择弹幕文件")?;
    read_text(&path)?;
    let mut all = bindings(&storage);
    if all.len() >= 1000 && !all.contains_key(&key) {
        let first = all.keys().next().cloned().unwrap();
        all.remove(&first);
    }
    all.insert(
        key,
        Binding {
            reference,
            path,
            offset: bounded_offset(offset),
        },
    );
    save(&storage, &all)
}
fn bounded_offset(value: f64) -> f64 {
    if value.is_finite() {
        (value.clamp(-600., 600.) * 10.).round() / 10.
    } else {
        0.
    }
}
#[tauri::command]
pub async fn danmaku_binding(
    window: tauri::WebviewWindow,
    files: tauri::State<'_, Files>,
    scope: String,
    item_id: String,
    episode_id: String,
    offset: Option<f64>,
) -> Result<(), String> {
    let path = storage(&window)?;
    let key = key(&scope, &item_id, &episode_id)?;
    let _guard = files.0.lock().map_err(|_| "无法保存弹幕绑定")?;
    let mut all = bindings(&path);
    if let Some(offset) = offset {
        if let Some(binding) = all.get_mut(&key) {
            binding.offset = bounded_offset(offset);
        }
    } else {
        all.remove(&key);
    }
    save(&path, &all)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn binding_separates_same_titles_episodes_and_servers() {
        assert_ne!(
            key("server-a", "episode1", "episode1").unwrap(),
            key("server-a", "episode2", "episode2").unwrap()
        );
        assert_ne!(
            key("server-a", "item", "").unwrap(),
            key("server-b", "item", "").unwrap()
        );
        assert!(key("", "", "").is_err());
        assert_eq!(bounded_offset(1.234), 1.2);
        assert_eq!(bounded_offset(f64::NAN), 0.);
    }
    #[test]
    fn local_file_bounds_missing_and_encoding() {
        let path = std::env::temp_dir().join(format!("miry-danmaku-{}.ass", uuid::Uuid::new_v4()));
        assert!(read_text(&path).unwrap_err().contains("不可用"));
        fs::write(&path, [0xff, 0xfe, b'A', 0, b'S', 0, b'S', 0]).unwrap();
        assert_eq!(read_text(&path).unwrap(), "ASS");
        fs::write(&path, vec![b'a'; MAX_BYTES as usize + 1]).unwrap();
        assert!(read_text(&path).is_err());
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn persists_binding_reference_and_offset_without_touching_source() {
        let dir = std::env::temp_dir().join(format!("miry-binding-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let source = dir.join("local.xml");
        fs::write(&source, "<i/>").unwrap();
        let path = dir.join("bindings.json");
        let mut all = BTreeMap::new();
        all.insert(
            key("s", "i", "").unwrap(),
            Binding {
                reference: "r".into(),
                path: source.clone(),
                offset: -1.5,
            },
        );
        save(&path, &all).unwrap();
        assert_eq!(bindings(&path).values().next().unwrap().offset, -1.5);
        all.clear();
        save(&path, &all).unwrap();
        assert_eq!(fs::read_to_string(&source).unwrap(), "<i/>");
        fs::remove_dir_all(dir).unwrap();
    }
}
