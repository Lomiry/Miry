use serde_json::{json, Value};
use std::time::Duration;
use tauri::Manager;
#[tauri::command]
pub async fn check_release(
    window: tauri::WebviewWindow,
) -> Result<crate::release::ReleaseInfo, String> {
    if window.label() != "main" {
        return Err("更新由主窗口管理".into());
    }
    let release = crate::release::check_latest().await?;
    *window
        .state::<crate::updater::Service>()
        .release
        .lock()
        .unwrap() = Some(release.clone());
    Ok(release)
}
#[tauri::command]
pub fn open_release(window: tauri::WebviewWindow, url: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("发布页面由主窗口管理".into());
    }
    crate::release::validate_page(&url)?;
    #[cfg(windows)]
    unsafe {
        use windows::{
            core::HSTRING, Win32::UI::Shell::ShellExecuteW,
            Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        };
        let result = ShellExecuteW(
            None,
            &HSTRING::from("open"),
            &HSTRING::from(url),
            None,
            None,
            SW_SHOWNORMAL,
        );
        if result.0 as isize <= 32 {
            return Err("无法打开发布页面".into());
        }
    }
    Ok(())
}
pub fn sanitize(value: &Value, secrets: &[String]) -> Value {
    match value {
        Value::Object(o) => Value::Object(
            o.iter()
                .filter(|(k, _)| {
                    ![
                        "password",
                        "pw",
                        "token",
                        "access_token",
                        "accesstoken",
                        "cookie",
                        "authorization",
                        "api_key",
                        "userid",
                        "deviceid",
                        "serverid",
                    ]
                    .iter()
                    .any(|key| k.to_lowercase().contains(key))
                })
                .map(|(k, v)| (k.clone(), sanitize(v, secrets)))
                .collect(),
        ),
        Value::Array(a) => Value::Array(a.iter().take(100).map(|v| sanitize(v, secrets)).collect()),
        Value::String(s) => {
            let mut t = s.chars().take(1200).collect::<String>();
            for secret in secrets.iter().filter(|s| !s.is_empty()) {
                t = t.replace(secret, "[redacted]");
            }
            t = crate::network::redact_detail(&t, "", "");
            let credentials = regex::Regex::new(
                r"(?i)(password|pw|api_key|access_token|token)\s*[:=]\s*[^,\s}\]]+",
            )
            .unwrap();
            t = credentials
                .replace_all(&t, "[credential omitted]")
                .into_owned();
            Value::String(t)
        }
        _ => value.clone(),
    }
}
#[tauri::command]
pub async fn export_diagnostics(
    window: tauri::WebviewWindow,
    payload: Value,
    secrets: Vec<String>,
) -> Result<String, String> {
    if window.label() != "main" || payload.to_string().len() > 262144 || secrets.len() > 16 {
        return Err("诊断导出参数无效".into());
    }
    let mut command = tokio::process::Command::new(crate::player::mpv_path()?);
    command.arg("--version");
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    command.kill_on_drop(true);
    let version = tokio::time::timeout(Duration::from_secs(3), command.output())
        .await
        .ok()
        .and_then(Result::ok)
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("Unknown")
                .to_string()
        })
        .unwrap_or("Unknown".into());
    #[cfg(windows)]
    let os = windows::System::Profile::AnalyticsInfo::VersionInfo()
        .and_then(|i| i.DeviceFamilyVersion())
        .ok()
        .and_then(|s| s.to_string().parse::<u64>().ok())
        .map(|v| {
            format!(
                "Windows {}.{}.{}.{}",
                v >> 48,
                (v >> 32) & 65535,
                (v >> 16) & 65535,
                v & 65535
            )
        })
        .unwrap_or("Windows (版本 Unknown)".into());
    #[cfg(not(windows))]
    let os = "Unknown".to_string();
    let dir = window
        .app_handle()
        .path()
        .document_dir()
        .map_err(|_| "文档目录不可用")?;
    std::fs::create_dir_all(&dir).map_err(|_| "诊断目录不可用")?;
    let path = dir.join(format!(
        "Miry-diagnostics-{}-{}.json",
        env!("CARGO_PKG_VERSION"),
        crate::recovery::now()
    ));
    let report = json!({"version":env!("CARGO_PKG_VERSION"),"windows":os,"mpv":version,"diagnostics":sanitize(&payload,&secrets)});
    std::fs::write(
        &path,
        serde_json::to_vec_pretty(&report).map_err(|_| "诊断编码失败")?,
    )
    .map_err(|_| "诊断保存失败")?;
    Ok(path.to_string_lossy().into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn export_redacts_nested_credentials_and_server_addresses() {
        let v = json!({"password":"p","nested":{"Authorization":"Bearer private","cookie":"private","message":"https://real.example/abc token=private password=unlisted-pass token=unlisted-token","rate":12},"error":"secret"});
        let text = sanitize(&v, &["secret".into(), "private".into()]).to_string();
        assert!(!text.contains("real.example"));
        assert!(!text.contains("secret"));
        assert!(!text.contains("private"));
        assert!(!text.contains("password"));
        assert!(!text.contains("unlisted"));
        assert!(text.contains("rate"));
    }
    #[test]
    fn release_links_only_open_web_pages() {
        assert!(crate::release::validate_page("file:///c:/test").is_err());
        assert!(crate::release::validate_page("https://u:p@host/release").is_err());
        assert!(crate::release::validate_page("http://127.0.0.1:18196/qa/release").is_err());
    }
}
