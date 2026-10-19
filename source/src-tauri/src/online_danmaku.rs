use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::Read,
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::sync::{oneshot, Semaphore};

mod bundled {
    include!(concat!(env!("OUT_DIR"), "/provider_identity.rs"));
}
#[cfg(test)]
#[allow(dead_code)]
#[path = "../provider_build.rs"]
mod build_tests;

fn initial_config() -> Option<Config> {
    if let Some((app_id, secret)) = bundled::identity() {
        return Some(Config::Live {
            app_id: app_id.into(),
            secret: secret.into(),
            built_in: true,
        });
    }
    environment()
}

#[derive(Clone)]
enum Config {
    Live {
        app_id: String,
        secret: String,
        built_in: bool,
    },
    Mock(reqwest::Url),
}
fn credentials(app_id: String, secret: String) -> Option<Config> {
    if app_id.is_empty()
        || app_id.len() > 128
        || !app_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
        || secret.len() < 8
        || secret.len() > 512
        || secret.trim().is_empty()
        || secret.chars().any(char::is_control)
    {
        return None;
    }
    Some(Config::Live {
        app_id,
        secret,
        built_in: false,
    })
}
fn mock_url(value: &str) -> Option<reqwest::Url> {
    let u = reqwest::Url::parse(value).ok()?;
    (u.scheme() == "http"
        && u.host_str() == Some("127.0.0.1")
        && u.port().is_some()
        && u.path() == "/"
        && u.username().is_empty()
        && u.password().is_none()
        && u.query().is_none()
        && u.fragment().is_none())
    .then_some(u)
}
// Development overrides are not read by public Release builds.
#[cfg(debug_assertions)]
fn environment() -> Option<Config> {
    development_config(|key| std::env::var(key).ok())
}
#[cfg(any(debug_assertions, test))]
fn development_config(read: impl Fn(&str) -> Option<String>) -> Option<Config> {
    if let Some(value) = read("MIRY_DANDAN_MOCK_URL") {
        return mock_url(&value).map(Config::Mock);
    }
    credentials(read("MIRY_DANDAN_APP_ID")?, read("MIRY_DANDAN_APP_SECRET")?)
}
#[cfg(not(debug_assertions))]
fn environment() -> Option<Config> {
    None
}

pub struct Service {
    config: Mutex<Option<Config>>,
    pending: Mutex<HashMap<String, oneshot::Sender<()>>>,
    slots: Semaphore,
    cooldown: Mutex<Option<Instant>>,
}
impl Default for Service {
    fn default() -> Self {
        Self {
            config: Mutex::new(initial_config()),
            pending: Mutex::new(HashMap::new()),
            slots: Semaphore::new(2),
            cooldown: Mutex::new(None),
        }
    }
}
#[derive(Serialize)]
pub struct Availability {
    configured: bool,
    mock: bool,
    #[serde(rename = "builtIn")]
    built_in: bool,
}
#[derive(Serialize, Debug)]
pub struct Failure {
    kind: &'static str,
    status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    diagnostic: Option<Value>,
}
fn failure(kind: &'static str) -> Failure {
    Failure {
        kind,
        status: None,
        code: None,
        diagnostic: None,
    }
}
fn provider_failure(data: &Value, comments: bool) -> Option<Failure> {
    let code = data.get("errorCode").and_then(Value::as_i64);
    if data.get("success").and_then(Value::as_bool) != Some(false) && code.is_none_or(|n| n == 0) {
        return None;
    }
    let kind = match code {
        Some(429) => "rate-limit",
        Some(401 | 403) => "auth",
        Some(7) if !comments => "no-match",
        Some(7) => "not-found",
        _ => "provider",
    };
    Some(Failure {
        kind,
        status: Some(200),
        code,
        diagnostic: None,
    })
}
fn main_only(window: &tauri::WebviewWindow) -> Result<(), Failure> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err(failure("permission"))
    }
}
fn availability(service: &Service) -> Availability {
    let c = service.config.lock().unwrap();
    Availability {
        configured: c.is_some(),
        mock: matches!(*c, Some(Config::Mock(_))),
        built_in: matches!(*c, Some(Config::Live { built_in: true, .. })),
    }
}
fn reset(service: &Service, config: Option<Config>) {
    for (_, sender) in service.pending.lock().unwrap().drain() {
        let _ = sender.send(());
    }
    *service.config.lock().unwrap() = config;
    // Configuration cleanup cannot clear a throttle for the current process.
}
fn signature(id: &str, time: u64, path: &str, secret: &str) -> String {
    STANDARD.encode(Sha256::digest(
        format!("{id}{time}{path}{secret}").as_bytes(),
    ))
}

#[tauri::command]
pub fn danmaku_online_status(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
) -> Result<Availability, Failure> {
    main_only(&window)?;
    Ok(availability(&service))
}
#[tauri::command]
pub fn danmaku_online_cancel(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    request_id: String,
) -> Result<(), Failure> {
    main_only(&window)?;
    if let Some(tx) = service.pending.lock().unwrap().remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
}

#[cfg(windows)]
fn pick_config(owner: usize) -> Option<std::path::PathBuf> {
    use windows_sys::Win32::UI::Controls::Dialogs::*;
    let mut name = vec![0u16; 32768];
    let filter: Vec<u16> = "Provider credential (JSON)\0*.json\0\0"
        .encode_utf16()
        .collect();
    let title: Vec<u16> = "选择已授权的弹弹play凭据文件（仅本次运行）\0"
        .encode_utf16()
        .collect();
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
        return None;
    }
    let len = name.iter().position(|c| *c == 0).unwrap_or(name.len());
    Some(std::path::PathBuf::from(String::from_utf16_lossy(
        &name[..len],
    )))
}
#[tauri::command]
pub async fn danmaku_online_configure(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    clear: bool,
) -> Result<Availability, Failure> {
    main_only(&window)?;
    if availability(&service).built_in {
        return Ok(availability(&service));
    }
    if clear {
        reset(&service, None);
        return Ok(availability(&service));
    }
    #[cfg(windows)]
    {
        let owner = window
            .app_handle()
            .get_webview_window("player-ui")
            .filter(|w| w.is_visible().unwrap_or(false))
            .unwrap_or(window.clone())
            .hwnd()
            .map_err(|_| failure("config"))?
            .0 as usize;
        let config =
            tauri::async_runtime::spawn_blocking(move || -> Result<Option<Config>, Failure> {
                let Some(path) = pick_config(owner) else {
                    return Ok(None);
                };
                let file = std::fs::File::open(path).map_err(|_| failure("config"))?;
                let mut bytes = Vec::new();
                file.take(8193)
                    .read_to_end(&mut bytes)
                    .map_err(|_| failure("config"))?;
                if bytes.len() > 8192 {
                    return Err(failure("config"));
                }
                let v: Value = serde_json::from_slice(&bytes).map_err(|_| failure("config"))?;
                credentials(
                    v["appId"].as_str().unwrap_or_default().into(),
                    v["appSecret"].as_str().unwrap_or_default().into(),
                )
                .map(Some)
                .ok_or_else(|| failure("config"))
            })
            .await
            .map_err(|_| failure("config"))??;
        if let Some(config) = config {
            reset(&service, Some(config));
        }
        Ok(availability(&service))
    }
    #[cfg(not(windows))]
    {
        Err(failure("config"))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Query {
    kind: String,
    anime: Option<String>,
    episode: Option<String>,
    tmdb_id: Option<u32>,
    movie: Option<bool>,
    episode_id: Option<String>,
}
fn query_url(config: &Config, q: &Query) -> Result<(reqwest::Url, usize), Failure> {
    let base = match config {
        Config::Mock(u) => u.clone(),
        _ => reqwest::Url::parse("https://api.dandanplay.net/").unwrap(),
    };
    let mut u = base;
    let size;
    match q.kind.as_str() {
        "anime" | "search" => {
            if q.anime
                .as_ref()
                .is_some_and(|s| s.chars().count() > 200 || s.chars().any(char::is_control))
                || q.episode
                    .as_ref()
                    .is_some_and(|s| s.len() > 32 || s.chars().any(char::is_control))
            {
                return Err(failure("query"));
            }
            if q.anime
                .as_ref()
                .is_none_or(|s| s.trim().chars().count() < 2)
                && (q.kind == "anime" || q.tmdb_id.is_none_or(|n| n == 0))
            {
                return Err(failure("query"));
            }
            u.set_path(if q.kind == "anime" {
                "/api/v2/search/anime"
            } else {
                "/api/v2/search/episodes"
            });
            {
                let mut p = u.query_pairs_mut();
                p.append_pair("v2", "true");
                if let Some(title) = &q.anime {
                    p.append_pair(
                        if q.kind == "anime" {
                            "keyword"
                        } else {
                            "anime"
                        },
                        title.trim(),
                    );
                }
                if q.kind == "search" {
                    if let Some(id) = q.tmdb_id {
                        p.append_pair("tmdbId", &id.to_string());
                        p.append_pair("tmdbIdType", if q.movie == Some(true) { "1" } else { "0" });
                    }
                    if let Some(e) = &q.episode {
                        p.append_pair("episode", e);
                    }
                }
            }
            size = 1024 * 1024;
        }
        "comments" => {
            let id = q.episode_id.as_deref().unwrap_or_default();
            if id
                .parse::<u64>()
                .ok()
                .is_none_or(|n| n == 0 || n > i64::MAX as u64)
                || !id.bytes().all(|b| b.is_ascii_digit())
            {
                return Err(failure("query"));
            }
            u.set_path(&format!("/api/v2/comment/{id}"));
            u.query_pairs_mut().append_pair("withRelated", "true");
            size = 8 * 1024 * 1024;
        }
        _ => return Err(failure("query")),
    }
    Ok((u, size))
}
fn redirect_allowed(config: &Config, u: &reqwest::Url) -> bool {
    if !u.username().is_empty() || u.password().is_some() || u.fragment().is_some() {
        return false;
    }
    if let Config::Mock(base) = config {
        return u.origin() == base.origin();
    }
    if u.scheme() != "https" {
        return false;
    }
    let Some(host) = u.host_str() else {
        return false;
    };
    if host == "localhost" || host.ends_with(".localhost") {
        return false;
    }
    match host.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(ip)) => {
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast())
        }
        Ok(std::net::IpAddr::V6(ip)) => {
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local())
        }
        Err(_) => true,
    }
}
fn preserve_ids(v: &mut Value) {
    if let Some(animes) = v.get_mut("animes").and_then(Value::as_array_mut) {
        for anime in animes {
            if let Some(id) = anime.get_mut("animeId") {
                if let Some(n) = id.as_u64() {
                    *id = Value::String(n.to_string());
                }
            }
            if let Some(episodes) = anime.get_mut("episodes").and_then(Value::as_array_mut) {
                for episode in episodes {
                    if let Some(id) = episode.get_mut("episodeId") {
                        if let Some(n) = id.as_u64() {
                            *id = Value::String(n.to_string());
                        }
                    }
                }
            }
        }
    }
}
async fn fetch(config: &Config, q: &Query) -> Result<Value, Failure> {
    fetch_timeout(config, q, Duration::from_secs(12)).await
}
async fn fetch_timeout(config: &Config, q: &Query, timeout: Duration) -> Result<Value, Failure> {
    let (mut url, limit) = query_url(config, q)?;
    let path = url.path().to_string();
    let started = Instant::now();
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout)
        .user_agent(format!("Miry/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| failure("network"))?;
    for redirects in 0..=3 {
        let mut request = client.get(url.clone()).header("Accept", "application/json");
        if redirects == 0 {
            if let Config::Live { app_id, secret, .. } = config {
                let timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map_err(|_| failure("clock"))?
                    .as_secs();
                request = request
                    .header("X-AppId", app_id)
                    .header("X-Timestamp", timestamp.to_string())
                    .header("X-Signature", signature(app_id, timestamp, &path, secret));
            }
        }
        let mut response = request
            .send()
            .await
            .map_err(|e| failure(if e.is_timeout() { "timeout" } else { "network" }))?;
        let status = response.status().as_u16();
        let content_type = response
            .headers()
            .get("Content-Type")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .to_string();
        if matches!(status, 301 | 302 | 303 | 307 | 308) {
            if q.kind != "comments" || redirects == 3 {
                return Err(failure("redirect"));
            }
            url = url
                .join(
                    response
                        .headers()
                        .get("Location")
                        .and_then(|h| h.to_str().ok())
                        .ok_or_else(|| failure("redirect"))?,
                )
                .map_err(|_| failure("redirect"))?;
            if !redirect_allowed(config, &url) {
                return Err(failure("redirect"));
            }
            continue;
        }
        if !response.status().is_success() {
            return Err(Failure {
                kind: "http",
                status: Some(status),
                code: None,
                diagnostic: Some(
                    json!({"path":path,"method":"GET","status":status,"contentType":content_type,"elapsedMs":started.elapsed().as_millis()}),
                ),
            });
        }
        if response
            .content_length()
            .is_some_and(|len| len > limit as u64)
        {
            return Err(failure("size"));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| failure(if e.is_timeout() { "timeout" } else { "network" }))?
        {
            if bytes.len() + chunk.len() > limit {
                return Err(failure("size"));
            }
            bytes.extend_from_slice(&chunk);
        }
        let diagnostic = json!({"provider":"dandanplay","path":path,"method":"GET","status":status,"contentType":content_type,"responseBytes":bytes.len(),"elapsedMs":started.elapsed().as_millis(),"appIdPresent":matches!(config,Config::Live {..}),"redirects":redirects,"authenticated":redirects==0 && matches!(config,Config::Live{..})});
        let mut data: Value = serde_json::from_slice(&bytes).map_err(|_| {
            let mut error = failure("format");
            error.status = Some(status);
            error.diagnostic = Some(diagnostic.clone());
            error
        })?;
        if let Some(mut error) = provider_failure(&data, q.kind == "comments") {
            error.status = Some(status);
            error.diagnostic = Some(diagnostic);
            return Err(error);
        }
        if q.kind != "comments" {
            preserve_ids(&mut data);
        }
        return Ok(json!({"data":data,"diagnostic":diagnostic}));
    }
    Err(failure("redirect"))
}
#[tauri::command]
pub async fn danmaku_online_request(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    query: Query,
    request_id: String,
) -> Result<Value, Failure> {
    main_only(&window)?;
    run_request(&service, query, request_id).await
}
async fn run_request(
    service: &Service,
    query: Query,
    request_id: String,
) -> Result<Value, Failure> {
    if request_id.len() > 64 || request_id.is_empty() {
        return Err(failure("query"));
    }
    let config = service
        .config
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| failure("unconfigured"))?;
    if service.cooldown.lock().unwrap().is_some() {
        return Err(Failure {
            kind: "rate-limited",
            status: Some(429),
            code: None,
            diagnostic: None,
        });
    }
    let (tx, mut rx) = oneshot::channel();
    {
        let mut p = service.pending.lock().unwrap();
        if p.len() >= 16 || p.contains_key(&request_id) {
            return Err(failure("busy"));
        }
        p.insert(request_id.clone(), tx);
    }
    let job = async {
        let _slot = service
            .slots
            .acquire()
            .await
            .map_err(|_| failure("cancelled"))?;
        // A queued request may predate the first 429. Recheck after acquiring
        // its slot so the queue cannot keep hitting the provider after throttle.
        if service.cooldown.lock().unwrap().is_some() {
            let mut error = failure("rate-limited");
            error.status = Some(429);
            return Err(error);
        }
        tokio::time::timeout(Duration::from_secs(15), fetch(&config, &query))
            .await
            .map_err(|_| failure("timeout"))?
    };
    let result = tokio::select! {_=&mut rx=>Err(failure("cancelled")),result=job=>result};
    service.pending.lock().unwrap().remove(&request_id);
    if result
        .as_ref()
        .err()
        .is_some_and(|e| e.status == Some(429) || e.kind == "rate-limit")
    {
        *service.cooldown.lock().unwrap() = Some(Instant::now());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn development_configuration_requires_explicit_valid_inputs() {
        assert!(development_config(|_| None).is_none());
        assert!(credentials("app".into(), "        ".into()).is_none());
        assert!(development_config(|key| match key {
            "MIRY_DANDAN_APP_ID" => Some("unit-test-identity".into()),
            "MIRY_DANDAN_APP_SECRET" => Some("unit-test-only-material".into()),
            _ => None,
        })
        .is_some());
        assert!(matches!(
            development_config(
                |key| (key == "MIRY_DANDAN_MOCK_URL").then(|| "http://127.0.0.1:9/".into())
            ),
            Some(Config::Mock(_))
        ));
        assert!(development_config(
            |key| (key == "MIRY_DANDAN_MOCK_URL").then(|| "https://untrusted.test/".into())
        )
        .is_none());
    }
    #[test]
    #[cfg(not(miry_official))]
    fn public_build_has_no_bundled_identity() {
        let service = Service::default();
        assert!(!availability(&service).built_in);
        #[cfg(not(debug_assertions))]
        assert!(!availability(&service).configured);
    }
    #[test]
    #[cfg(miry_official)]
    fn official_build_starts_with_native_identity_and_boolean_status_only() {
        let service = Service::default();
        let value = serde_json::to_value(availability(&service)).unwrap();
        assert_eq!(
            value,
            json!({"configured":true,"mock":false,"builtIn":true})
        );
        let config = service.config.lock().unwrap();
        assert!(matches!(
            &*config,
            Some(Config::Live { built_in: true, .. })
        ));
        let (id, secret) = bundled::identity().expect("OFFICIAL identity required");
        assert!(credentials(id.into(), secret.into()).is_some());
        assert!(!value.to_string().contains(secret));
    }
    #[tokio::test]
    async fn unconfigured_then_unavailable_then_recovered() {
        let service = Service::default();
        reset(&service, None);
        let e = run_request(&service, query("search"), "absent".into())
            .await
            .unwrap_err();
        assert_eq!(e.kind, "unconfigured");
        assert!(service.pending.lock().unwrap().is_empty());
        let (config, handle) = server(vec![
            response(503, "unavailable"),
            response(200, r#"{"success":true,"animes":[]}"#),
        ]);
        reset(&service, Some(config));
        assert_eq!(
            run_request(&service, query("search"), "down".into())
                .await
                .unwrap_err()
                .status,
            Some(503)
        );
        assert!(run_request(&service, query("search"), "recovered".into())
            .await
            .is_ok());
        reset(&service, None);
        assert!(!availability(&service).configured);
        assert_eq!(handle.join().unwrap().len(), 2);
    }
    #[tokio::test]
    async fn configuration_reset_keeps_process_throttle() {
        let service = Service::default();
        *service.cooldown.lock().unwrap() = Some(Instant::now());
        reset(&service, None);
        reset(
            &service,
            Some(Config::Mock(
                reqwest::Url::parse("http://127.0.0.1:9/").unwrap(),
            )),
        );
        let error = run_request(&service, query("search"), "reset".into())
            .await
            .unwrap_err();
        assert_eq!(error.kind, "rate-limited");
        assert!(error.diagnostic.is_none());
        assert!(Service::default().cooldown.lock().unwrap().is_none());
    }
    #[tokio::test]
    async fn queued_requests_recheck_throttle_before_http() {
        use std::future::Future;
        let service = Service::default();
        reset(
            &service,
            Some(Config::Mock(
                reqwest::Url::parse("http://127.0.0.1:9/").unwrap(),
            )),
        );
        let slots = service.slots.acquire_many(2).await.unwrap();
        let mut queued = Box::pin(run_request(&service, query("search"), "queued".into()));
        std::future::poll_fn(|cx| {
            assert!(queued.as_mut().poll(cx).is_pending());
            std::task::Poll::Ready(())
        })
        .await;
        *service.cooldown.lock().unwrap() = Some(Instant::now());
        drop(slots);
        let error = queued.await.unwrap_err();
        assert_eq!(error.kind, "rate-limited");
        assert_eq!(error.status, Some(429));
        assert!(error.diagnostic.is_none());
    }
    #[test]
    fn api_error_envelopes_keep_http_separate_and_never_expose_body() {
        for (code, kind) in [
            (429, "rate-limit"),
            (401, "auth"),
            (403, "auth"),
            (500, "provider"),
            (7, "no-match"),
        ] {
            let error = provider_failure(
                &json!({"success":false,"errorCode":code,"errorMessage":"private-body"}),
                false,
            )
            .unwrap();
            assert_eq!(error.kind, kind);
            assert_eq!(error.status, Some(200));
            assert_eq!(error.code, Some(code));
            assert!(!serde_json::to_string(&error)
                .unwrap()
                .contains("private-body"));
        }
        assert_eq!(
            provider_failure(&json!({"success":false,"errorCode":7}), true)
                .unwrap()
                .kind,
            "not-found"
        );
        assert!(provider_failure(&json!({"success":true,"animes":[]}), false).is_none());
        assert!(provider_failure(&json!({"count":0,"comments":[]}), true).is_none());
    }
    #[tokio::test]
    async fn http_200_api_429_trips_native_guard_but_no_match_does_not() {
        let (config, handle) = server(vec![response(
            200,
            r#"{"success":false,"errorCode":429,"errorMessage":"private-body"}"#,
        )]);
        let service = Service::default();
        reset(&service, Some(config));
        let e = run_request(&service, query("search"), "one".into())
            .await
            .unwrap_err();
        assert_eq!(e.status, Some(200));
        assert_eq!(e.kind, "rate-limit");
        assert_eq!(e.code, Some(429));
        assert_eq!(e.diagnostic.as_ref().unwrap()["responseBytes"], 63);
        assert_eq!(
            run_request(&service, query("search"), "two".into())
                .await
                .unwrap_err()
                .status,
            Some(429)
        );
        assert_eq!(handle.join().unwrap().len(), 1);
        let (config, handle) = server(vec![
            response(200, r#"{"success":false,"errorCode":7}"#),
            response(200, r#"{"success":true,"animes":[]}"#),
        ]);
        let service = Service::default();
        reset(&service, Some(config));
        assert_eq!(
            run_request(&service, query("search"), "three".into())
                .await
                .unwrap_err()
                .kind,
            "no-match"
        );
        assert!(run_request(&service, query("search"), "four".into())
            .await
            .is_ok());
        assert_eq!(handle.join().unwrap().len(), 2);
    }
    #[test]
    fn builtin_status_exposes_only_availability() {
        let service = Service::default();
        reset(
            &service,
            Some(Config::Live {
                app_id: "test-identity".into(),
                secret: "test-signing-material".into(),
                built_in: true,
            }),
        );
        assert_eq!(
            serde_json::to_value(availability(&service)).unwrap(),
            json!({"configured":true,"mock":false,"builtIn":true})
        );
    }
    #[test]
    fn official_signature_and_paths() {
        assert_eq!(
            signature("app", 1735660800, "/api/v2/comment/123", "secret"),
            "KLk0whdohp9F1/N0/miPs64uKcsQGIZTucCaFJo6OT0="
        );
        let config = Config::Mock(mock_url("http://127.0.0.1:18200").unwrap());
        let q: Query =
            serde_json::from_value(json!({"kind":"search","tmdbId":123,"movie":true})).unwrap();
        let (u, _) = query_url(&config, &q).unwrap();
        assert_eq!(u.path(), "/api/v2/search/episodes");
        assert!(u.query().unwrap().contains("tmdbIdType=1"));
    }
    #[test]
    fn rejects_credentials_and_untrusted_queries() {
        assert!(credentials("app\r\n".into(), "private-secret".into()).is_none());
        assert!(mock_url("http://evil.test:18200").is_none());
        assert!(mock_url("http://127.0.0.1:18200?token=a").is_none());
        assert!(serde_json::from_value::<Query>(
            json!({"kind":"search","anime":"Movie","serverId":"private"})
        )
        .is_err());
        let config = Config::Live {
            app_id: "app".into(),
            secret: "unit-test-only".into(),
            built_in: false,
        };
        for uri in [
            "http://cdn.test/file",
            "https://localhost/file",
            "https://127.0.0.1/file",
            "https://user:secret@cdn.test/file",
        ] {
            assert!(!redirect_allowed(
                &config,
                &reqwest::Url::parse(uri).unwrap()
            ));
        }
        assert!(redirect_allowed(
            &config,
            &reqwest::Url::parse("https://cdn.test/file").unwrap()
        ));
    }
    #[test]
    fn preserves_large_ids_without_exposing_config() {
        let mut v =
            json!({"animes":[{"animeId":123,"episodes":[{"episodeId":9007199254740993u64}]}]});
        preserve_ids(&mut v);
        assert_eq!(
            v["animes"][0]["episodes"][0]["episodeId"],
            "9007199254740993"
        );
        let service = Service::default();
        *service.config.lock().unwrap() = credentials("app".into(), "private-secret".into());
        let value = serde_json::to_string(&availability(&service)).unwrap();
        assert!(!value.contains("private-secret"));
        assert!(!value.contains("app"));
    }
    fn server(responses: Vec<String>) -> (Config, std::thread::JoinHandle<Vec<String>>) {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let config =
            Config::Mock(mock_url(&format!("http://{}", listener.local_addr().unwrap())).unwrap());
        let handle = std::thread::spawn(move || {
            let mut requests = vec![];
            for response in responses {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .unwrap();
                let mut bytes = [0; 8192];
                let n = stream.read(&mut bytes).unwrap();
                requests.push(String::from_utf8_lossy(&bytes[..n]).to_string());
                stream.write_all(response.as_bytes()).unwrap();
            }
            requests
        });
        (config, handle)
    }
    fn response(status: u16, body: &str) -> String {
        format!(
            "HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }
    fn query(kind: &str) -> Query {
        serde_json::from_value(json!({"kind":kind,"anime":"Movie","episodeId":"123"})).unwrap()
    }
    #[tokio::test]
    async fn mock_http_search_comments_redirect_and_limits() {
        let (config, handle) = server(vec![response(
            200,
            r#"{"success":true,"animes":[{"animeId":123,"episodes":[{"episodeId":9007199254740993}]}]}"#,
        )]);
        let result = fetch(&config, &query("search")).await.unwrap();
        assert_eq!(
            result["data"]["animes"][0]["episodes"][0]["episodeId"],
            "9007199254740993"
        );
        let calls = handle.join().unwrap();
        assert!(calls[0].contains("v2=true"));
        assert!(!calls[0].to_lowercase().contains("x-app"));
        let(config,handle)=server(vec!["HTTP/1.1 302 Found\r\nLocation: /cdn/comments\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),response(200,r#"{"count":0,"comments":[]}"#)]);
        assert_eq!(
            fetch(&config, &query("comments")).await.unwrap()["data"]["count"],
            0
        );
        let calls = handle.join().unwrap();
        assert_eq!(calls.len(), 2);
        assert!(calls
            .iter()
            .all(|r| !r.to_lowercase().contains("x-signature")));
        let (config, handle) = server(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 9999999\r\nConnection: close\r\n\r\n".into(),
        ]);
        assert_eq!(
            fetch(&config, &query("comments")).await.unwrap_err().kind,
            "size"
        );
        handle.join().unwrap();
    }
    #[tokio::test]
    async fn mock_http_failures_and_rate_limit_do_not_retry() {
        for status in [401, 403, 429, 500] {
            let (config, handle) = server(vec![response(status, "private-body-must-not-leak")]);
            let service = Service::default();
            reset(&service, Some(config));
            let e = run_request(&service, query("search"), "one".into())
                .await
                .unwrap_err();
            assert_eq!(e.status, Some(status));
            assert!(!serde_json::to_string(&e).unwrap().contains("private-body"));
            handle.join().unwrap();
            if status == 429 {
                assert_eq!(
                    run_request(&service, query("search"), "two".into())
                        .await
                        .unwrap_err()
                        .status,
                    Some(429)
                );
            }
            assert!(service.pending.lock().unwrap().is_empty());
        }
        let (config, handle) = server(vec![response(200, "not json")]);
        assert_eq!(
            fetch(&config, &query("search")).await.unwrap_err().kind,
            "format"
        );
        handle.join().unwrap();
    }
    #[tokio::test]
    async fn reset_cancels_queued_request_and_unconfigured_has_no_network() {
        let service = Service::default();
        reset(&service, None);
        assert_eq!(
            run_request(&service, query("search"), "one".into())
                .await
                .unwrap_err()
                .kind,
            "unconfigured"
        );
        reset(
            &service,
            Some(Config::Mock(mock_url("http://127.0.0.1:1").unwrap())),
        );
        let _slots = service.slots.acquire_many(2).await.unwrap();
        let job = run_request(&service, query("search"), "one".into());
        let cancel = async {
            tokio::task::yield_now().await;
            reset(&service, None);
        };
        let (result, _) = tokio::join!(job, cancel);
        assert_eq!(result.unwrap_err().kind, "cancelled");
        assert!(service.pending.lock().unwrap().is_empty());
    }
    #[tokio::test]
    async fn mock_http_timeout_is_bounded() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let config =
            Config::Mock(mock_url(&format!("http://{}", listener.local_addr().unwrap())).unwrap());
        let handle = std::thread::spawn(move || {
            let (_stream, _) = listener.accept().unwrap();
            std::thread::sleep(Duration::from_millis(120));
        });
        assert_eq!(
            fetch_timeout(&config, &query("search"), Duration::from_millis(40))
                .await
                .unwrap_err()
                .kind,
            "timeout"
        );
        handle.join().unwrap();
    }
}
