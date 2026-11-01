//! User-selected LogVar-compatible endpoints. Tokens never enter settings or diagnostics.
#[cfg(test)]
#[path = "danmaku_sources_http_tests.rs"]
mod http_tests;
use crate::source_credentials::{Snapshot, Store};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, net::IpAddr, sync::Mutex, time::Duration};
use tauri::Manager;
use tauri_plugin_http::reqwest;
use tokio::sync::{oneshot, Semaphore};

struct CredentialChange {
    id: String,
    source: String,
    previous: Snapshot,
    cached: Option<(String, String)>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    state: &'static str,
    transaction: Option<String>,
}

pub struct Service {
    keys: Mutex<HashMap<String, (String, String)>>,
    pending: Mutex<HashMap<String, oneshot::Sender<()>>>,
    slots: Semaphore,
    credential_change: Mutex<Option<CredentialChange>>,
}
impl Default for Service {
    fn default() -> Self {
        Self {
            keys: Mutex::new(HashMap::new()),
            pending: Mutex::new(HashMap::new()),
            slots: Semaphore::new(2),
            credential_change: Mutex::new(None),
        }
    }
}
fn main_only(window: &tauri::WebviewWindow) -> Result<(), &'static str> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("permission")
    }
}
fn endpoint(value: &str) -> Result<reqwest::Url, &'static str> {
    let u = reqwest::Url::parse(value.trim_end_matches('/')).map_err(|_| "query")?;
    let local =
        u.host_str() == Some("localhost") || endpoint_ip(&u).is_some_and(|ip| ip.is_loopback());
    let private = endpoint_ip(&u).is_some_and(|ip| matches!(ip, IpAddr::V4(v) if v.is_private()));
    let path = decoded_path(&u)?;
    if value.len() > 2048
        || value
            .chars()
            .any(|c| c.is_control() || c.is_whitespace() || c == '\\')
        || !(u.scheme() == "https" || (u.scheme() == "http" && (local || private)))
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
        || u.query().is_some()
        || u.fragment().is_some()
        || u.port() == Some(0)
        || path.chars().any(char::is_control)
        || path.split('/').any(|s| {
            matches!(
                s.split('=')
                    .next()
                    .unwrap_or("")
                    .to_ascii_lowercase()
                    .as_str(),
                "api" | "token" | "admin_token" | "access_token" | "api_key"
            )
        })
    {
        return Err("query");
    }
    Ok(u)
}
fn endpoint_ip(u: &reqwest::Url) -> Option<IpAddr> {
    u.host_str()?.trim_matches(['[', ']']).parse().ok()
}
fn decoded_path(u: &reqwest::Url) -> Result<String, &'static str> {
    let path = u.path().as_bytes();
    let mut decoded = Vec::with_capacity(path.len());
    let mut i = 0;
    while i < path.len() {
        if path[i] == b'%' {
            let a = (*path.get(i + 1).ok_or("query")? as char)
                .to_digit(16)
                .ok_or("query")?;
            let b = (*path.get(i + 2).ok_or("query")? as char)
                .to_digit(16)
                .ok_or("query")?;
            decoded.push((a * 16 + b) as u8);
            i += 3;
        } else {
            decoded.push(path[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).map_err(|_| "query")
}
// Every external credential/request entry point must check explicit per-source consent.
// endpoint() also bounds all internally constructed targets to HTTPS, loopback or RFC1918.
fn authorized_endpoint(value: &str, allow_lan_http: bool) -> Result<reqwest::Url, &'static str> {
    let u = endpoint(value)?;
    if u.scheme() == "http"
        && endpoint_ip(&u).is_some_and(|ip| matches!(ip, IpAddr::V4(v) if v.is_private()))
        && !allow_lan_http
    {
        return Err("query");
    }
    Ok(u)
}
fn source_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value != "dandanplay"
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
}
#[tauri::command]
pub async fn danmaku_source_key(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    source_id: String,
    endpoint: String,
    token: Option<String>,
    action: Option<String>,
    transaction: Option<String>,
    allow_lan_http: Option<bool>,
) -> Result<CredentialStatus, &'static str> {
    main_only(&window)?;
    if !matches!(action.as_deref(), Some("finish" | "rollback")) {
        let u = authorized_endpoint(&endpoint, allow_lan_http.unwrap_or(false))?;
        if token.as_ref().is_some_and(|token| {
            !token.is_empty()
                && decoded_path(&u).is_ok_and(|path| path.split('/').any(|s| s == token))
        }) {
            return Err("query");
        }
    }
    let directory = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|_| "credential-permission")?
        .join("credentials")
        .join("danmaku-sources-v1");
    let app = window.app_handle().clone();
    let _ = service;
    tauri::async_runtime::spawn_blocking(move || {
        credential_action(
            &app.state::<Service>(),
            &Store(directory),
            &source_id,
            &endpoint,
            token,
            action.as_deref().unwrap_or("save"),
            transaction.as_deref(),
        )
    })
    .await
    .map_err(|_| "credential-write")?
}
fn credential_action(
    service: &Service,
    store: &Store,
    source_id: &str,
    endpoint: &str,
    token: Option<String>,
    action: &str,
    transaction: Option<&str>,
) -> Result<CredentialStatus, &'static str> {
    if !self::source_id(source_id) {
        return Err("query");
    }
    let mut pending = service
        .credential_change
        .lock()
        .map_err(|_| "credential-write")?;
    if action == "finish" || action == "rollback" {
        let change = pending
            .as_ref()
            .filter(|c| c.source == source_id && Some(c.id.as_str()) == transaction)
            .ok_or("credential-stale")?;
        if action == "rollback" {
            store
                .restore(source_id, &change.previous)
                .map_err(|_| "credential-rollback")?;
            let mut keys = service.keys.lock().map_err(|_| "credential-write")?;
            keys.remove(source_id);
            if let Some(cached) = &change.cached {
                keys.insert(source_id.into(), cached.clone());
            }
        }
        *pending = None;
        return Ok(CredentialStatus {
            state: "finished",
            transaction: None,
        });
    }
    let base = self::endpoint(&endpoint)?;
    if action == "status" {
        return Ok(CredentialStatus {
            state: match store.load(source_id) {
                Ok(Some(binding)) if binding.endpoint == base.as_str() => "saved",
                Ok(Some(_)) => "endpoint-changed",
                Ok(None) => {
                    if service
                        .keys
                        .lock()
                        .map_err(|_| "credential-read")?
                        .get(source_id)
                        .is_some_and(|(u, _)| u == base.as_str())
                    {
                        "session"
                    } else {
                        "missing"
                    }
                }
                Err(_) => "unavailable",
            },
            transaction: None,
        });
    }
    if pending.is_some() {
        return Err("busy");
    }
    if action != "save" && action != "clear" && action != "delete" {
        return Err("query");
    }
    let replacement = if action == "save" {
        let token = if let Some(token) = token.filter(|s| !s.is_empty()) {
            token
        } else if let Some(binding) = store.load(source_id)? {
            if binding.endpoint != base.as_str() {
                return Err("credential-endpoint");
            }
            binding.token
        } else {
            service
                .keys
                .lock()
                .map_err(|_| "credential-read")?
                .get(source_id)
                .filter(|(u, _)| u == base.as_str())
                .map(|(_, t)| t.clone())
                .ok_or("credential-missing")?
        };
        if token.len() > 512 || token.chars().any(char::is_control) || token.trim() != token {
            return Err("query");
        }
        Some(token)
    } else {
        None
    };
    if replacement.is_some() {
        let keys = service.keys.lock().map_err(|_| "credential-read")?;
        if keys.len() >= 12 && !keys.contains_key(source_id) {
            return Err("size");
        }
    }
    let cached = service
        .keys
        .lock()
        .map_err(|_| "credential-read")?
        .get(source_id)
        .cloned();
    let previous = store.snapshot(source_id)?;
    let result = if let Some(token) = &replacement {
        store.save(source_id, base.to_string(), token.clone())
    } else {
        store.remove(source_id)
    };
    if let Err(error) = result {
        store
            .restore(source_id, &previous)
            .map_err(|_| "credential-rollback")?;
        return Err(error);
    }
    let mut keys = service.keys.lock().map_err(|_| "credential-write")?;
    keys.remove(source_id);
    if let Some(token) = replacement {
        keys.insert(source_id.into(), (base.to_string(), token));
    }
    let id = uuid::Uuid::new_v4().to_string();
    *pending = Some(CredentialChange {
        id: id.clone(),
        source: source_id.into(),
        previous,
        cached,
    });
    Ok(CredentialStatus {
        state: if action == "save" { "saved" } else { "missing" },
        transaction: Some(id),
    })
}
#[derive(Deserialize)]
pub struct Query {
    kind: String,
    title: Option<String>,
    episode: Option<String>,
    id: Option<String>,
}
fn query_url(base: &str, token: &str, q: &Query) -> Result<reqwest::Url, &'static str> {
    let mut u = endpoint(base)?;
    if !token.is_empty() && decoded_path(&u)?.split('/').any(|s| s == token) {
        return Err("query");
    }
    let path = u.path().trim_end_matches('/').to_owned();
    u.set_path(&format!("{path}/"));
    {
        let mut parts = u.path_segments_mut().map_err(|_| "query")?;
        parts.pop_if_empty();
        if !token.is_empty() {
            parts.push(token);
        }
        parts.extend(["api", "v2"]);
        match q.kind.as_str() {
            "search" => {
                parts.extend(["search", "episodes"]);
            }
            "comments" => {
                let id = q.id.as_deref().unwrap_or("");
                if id.is_empty() || id.len() > 19 || !id.bytes().all(|b| b.is_ascii_digit()) {
                    return Err("query");
                }
                parts.extend(["comment", id]);
            }
            // Empty anime search validates the actual API envelope without a media query.
            "health" => {
                parts.extend(["search", "anime"]);
            }
            _ => return Err("query"),
        }
    }
    match q.kind.as_str() {
        "search" => {
            let title = q.title.as_deref().unwrap_or("");
            if !(2..=200).contains(&title.chars().count())
                || title.chars().any(char::is_control)
                || title.contains('/')
                || title.contains('\\')
            {
                return Err("query");
            }
            u.query_pairs_mut().append_pair("anime", title);
            if let Some(ep) = &q.episode {
                if ep.is_empty() || ep.len() > 4 || !ep.bytes().all(|b| b.is_ascii_digit()) {
                    return Err("query");
                }
                u.query_pairs_mut().append_pair("episode", ep);
            }
        }
        "health" => {
            u.query_pairs_mut().append_pair("keyword", "");
        }
        "comments" => {
            u.query_pairs_mut().append_pair("format", "json");
            u.query_pairs_mut().append_pair("duration", "true");
        }
        _ => unreachable!(),
    }
    Ok(u)
}
async fn fetch(url: reqwest::Url, comments: bool) -> Result<Value, &'static str> {
    fetch_timeout(url, comments, Duration::from_secs(12)).await
}
async fn fetch_timeout(
    url: reqwest::Url,
    comments: bool,
    timeout: Duration,
) -> Result<Value, &'static str> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout)
        .build()
        .map_err(|_| "network")?;
    let mut response = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| if e.is_timeout() { "timeout" } else { "network" })?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => "auth",
            429 => "rate-limit",
            404 => "not-found",
            _ => "provider",
        });
    }
    let limit = if comments {
        8 * 1024 * 1024
    } else {
        1024 * 1024
    };
    if response.content_length().is_some_and(|n| n > limit as u64) {
        return Err("size");
    }
    let mut bytes = Vec::new();
    while let Some(chunk) =
        response
            .chunk()
            .await
            .map_err(|e| if e.is_timeout() { "timeout" } else { "network" })?
    {
        if bytes.len() + chunk.len() > limit {
            return Err("size");
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "format")
}
#[tauri::command]
pub fn danmaku_source_cancel(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    request_id: String,
) -> Result<(), &'static str> {
    main_only(&window)?;
    if let Some(tx) = service.pending.lock().unwrap().remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
}
#[tauri::command]
pub async fn danmaku_source_request(
    window: tauri::WebviewWindow,
    service: tauri::State<'_, Service>,
    source_id: String,
    endpoint: String,
    query: Query,
    request_id: String,
    allow_lan_http: Option<bool>,
) -> Result<Value, &'static str> {
    main_only(&window)?;
    let directory = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|_| "credential-permission")?
        .join("credentials")
        .join("danmaku-sources-v1");
    let app = window.app_handle().clone();
    let id = source_id.clone();
    let base = authorized_endpoint(&endpoint, allow_lan_http.unwrap_or(false))?.to_string();
    run_with_key(
        &service,
        source_id,
        endpoint,
        query,
        request_id,
        async move {
            tauri::async_runtime::spawn_blocking(move || {
                load_key(&app.state::<Service>(), &Store(directory), &id, &base)
            })
            .await
            .map_err(|_| "credential-read")?
        },
    )
    .await
}
fn load_key(service: &Service, store: &Store, id: &str, base: &str) -> Result<(), &'static str> {
    if !source_id(id) {
        return Err("query");
    }
    let _guard = service
        .credential_change
        .lock()
        .map_err(|_| "credential-read")?;
    let mut keys = service.keys.lock().map_err(|_| "credential-read")?;
    if !keys.get(id).is_some_and(|(u, _)| u == base) {
        if let Some(binding) = store.load(id)? {
            if binding.endpoint != base {
                return Err("credential-endpoint");
            }
            if keys.len() >= 12 && !keys.contains_key(id) {
                return Err("size");
            }
            keys.insert(id.into(), (base.into(), binding.token));
        }
    }
    Ok(())
}
#[cfg(test)]
async fn run(
    service: &Service,
    source_id: String,
    endpoint: String,
    query: Query,
    request_id: String,
) -> Result<Value, &'static str> {
    run_with_key(service, source_id, endpoint, query, request_id, async {
        Ok(())
    })
    .await
}
async fn run_with_key(
    service: &Service,
    source_id: String,
    endpoint: String,
    query: Query,
    request_id: String,
    load: impl std::future::Future<Output = Result<(), &'static str>>,
) -> Result<Value, &'static str> {
    if !self::source_id(&source_id) || request_id.is_empty() || request_id.len() > 64 {
        return Err("query");
    }
    let base = self::endpoint(&endpoint)?.to_string();
    let (tx, mut rx) = oneshot::channel();
    {
        let mut pending = service.pending.lock().unwrap();
        if pending.len() >= 16 || pending.contains_key(&request_id) {
            return Err("busy");
        }
        pending.insert(request_id.clone(), tx);
    }
    let job = async {
        let _slot = service.slots.acquire().await.map_err(|_| "cancelled")?;
        load.await?;
        let token = service
            .keys
            .lock()
            .map_err(|_| "credential-read")?
            .get(&source_id)
            .filter(|(u, _)| *u == base)
            .map(|(_, k)| k.clone())
            .unwrap_or_default();
        let url = query_url(&endpoint, &token, &query)?;
        fetch(url, query.kind == "comments").await
    };
    let result = tokio::select! { _ = &mut rx => Err("cancelled"), r = tokio::time::timeout(Duration::from_secs(15), job) => r.unwrap_or(Err("timeout")) };
    service.pending.lock().unwrap().remove(&request_id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    #[cfg(windows)]
    #[test]
    fn credential_cache_limit_rejects_without_creating_a_file() {
        let root = crate::source_credentials::tests::Fixture::new();
        let service = Service::default();
        for id in 0..12 {
            service.keys.lock().unwrap().insert(
                format!("source-{id}"),
                (
                    "https://example.invalid/".into(),
                    uuid::Uuid::new_v4().to_string(),
                ),
            );
        }
        assert!(matches!(
            credential_action(
                &service,
                &root.store(),
                "extra",
                "https://example.invalid/",
                Some(uuid::Uuid::new_v4().to_string()),
                "save",
                None
            ),
            Err("size")
        ));
        assert!(root.store().load("extra").unwrap().is_none());
        assert!(service.credential_change.lock().unwrap().is_none());
    }
    #[tokio::test]
    async fn cancellation_during_credential_loading_never_starts_http() {
        let service = Service::default();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let result = run_with_key(
            &service,
            "custom".into(),
            base,
            query("search"),
            "loading".into(),
            async {
                service
                    .pending
                    .lock()
                    .unwrap()
                    .remove("loading")
                    .unwrap()
                    .send(())
                    .unwrap();
                std::future::pending::<Result<(), &'static str>>().await
            },
        )
        .await;
        assert!(matches!(result, Err("cancelled")));
        assert!(service.pending.lock().unwrap().is_empty());
        assert!(
            tokio::time::timeout(Duration::from_millis(20), listener.accept())
                .await
                .is_err()
        );
    }
    #[cfg(windows)]
    #[test]
    fn durable_key_actions_preserve_blank_update_rollback_and_delete() {
        let root = crate::source_credentials::tests::Fixture::new();
        let store = root.store();
        let service = Service::default();
        let base = "https://example.invalid/";
        let first = uuid::Uuid::new_v4().to_string();
        let saved = credential_action(
            &service,
            &store,
            "custom",
            base,
            Some(first.clone()),
            "save",
            None,
        )
        .unwrap();
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "finish",
            saved.transaction.as_deref(),
        )
        .unwrap();
        let kept = credential_action(&service, &store, "custom", base, None, "save", None).unwrap();
        assert!(store
            .load("custom")
            .unwrap()
            .is_some_and(|b| b.token == first));
        assert!(matches!(
            credential_action(
                &service,
                &store,
                "other",
                base,
                None,
                "rollback",
                kept.transaction.as_deref()
            ),
            Err("credential-stale")
        ));
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "finish",
            kept.transaction.as_deref(),
        )
        .unwrap();
        let replaced = credential_action(
            &service,
            &store,
            "custom",
            base,
            Some(uuid::Uuid::new_v4().to_string()),
            "save",
            None,
        )
        .unwrap();
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "rollback",
            replaced.transaction.as_deref(),
        )
        .unwrap();
        assert!(store
            .load("custom")
            .unwrap()
            .is_some_and(|b| b.token == first));
        let removed =
            credential_action(&service, &store, "custom", base, None, "delete", None).unwrap();
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "rollback",
            removed.transaction.as_deref(),
        )
        .unwrap();
        assert!(store.load("custom").unwrap().is_some());
        let cleared =
            credential_action(&service, &store, "custom", base, None, "clear", None).unwrap();
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "finish",
            cleared.transaction.as_deref(),
        )
        .unwrap();
        assert!(store.load("custom").unwrap().is_none());
        assert!(service.keys.lock().unwrap().is_empty());
    }
    #[cfg(windows)]
    #[test]
    fn legacy_session_key_migrates_only_on_explicit_save_and_rehydrates() {
        let root = crate::source_credentials::tests::Fixture::new();
        let store = root.store();
        let service = Service::default();
        let base = "https://example.invalid/";
        let token = uuid::Uuid::new_v4().to_string();
        service
            .keys
            .lock()
            .unwrap()
            .insert("custom".into(), (base.into(), token.clone()));
        assert!(
            credential_action(&service, &store, "custom", base, None, "status", None)
                .unwrap()
                .state
                == "session"
        );
        assert!(store.load("custom").unwrap().is_none());
        let receipt =
            credential_action(&service, &store, "custom", base, None, "save", None).unwrap();
        credential_action(
            &service,
            &store,
            "custom",
            base,
            None,
            "finish",
            receipt.transaction.as_deref(),
        )
        .unwrap();
        let restarted = Service::default();
        load_key(&restarted, &store, "custom", base).unwrap();
        assert!(restarted
            .keys
            .lock()
            .unwrap()
            .get("custom")
            .is_some_and(|(_, t)| t == &token));
        assert!(matches!(
            load_key(
                &Service::default(),
                &store,
                "custom",
                "https://other.invalid/"
            ),
            Err("credential-endpoint")
        ));
        assert!(matches!(
            credential_action(
                &restarted,
                &store,
                "custom",
                "https://other.invalid/",
                None,
                "save",
                None
            ),
            Err("credential-endpoint")
        ));
    }
    #[cfg(windows)]
    #[test]
    fn missing_keys_and_failed_disk_writes_leave_no_false_receipt() {
        let root = crate::source_credentials::tests::Fixture::new();
        let service = Service::default();
        let base = "https://example.invalid/";
        assert!(
            credential_action(
                &service,
                &root.store(),
                "custom",
                base,
                None,
                "status",
                None
            )
            .unwrap()
            .state
                == "missing"
        );
        assert!(matches!(
            credential_action(&service, &root.store(), "custom", base, None, "save", None),
            Err("credential-missing")
        ));
        std::fs::create_dir_all(&root.0).unwrap();
        let file = root.0.join("file");
        std::fs::write(&file, []).unwrap();
        assert!(credential_action(
            &service,
            &Store(file),
            "custom",
            base,
            Some(uuid::Uuid::new_v4().to_string()),
            "save",
            None
        )
        .is_err());
        assert!(service.credential_change.lock().unwrap().is_none());
        assert!(service.keys.lock().unwrap().is_empty());
    }
    fn query(kind: &str) -> Query {
        Query {
            kind: kind.into(),
            title: Some("Example".into()),
            episode: Some("3".into()),
            id: Some("12".into()),
        }
    }
    async fn fixture(response: String, delay: Duration) -> reqwest::Url {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = [0u8; 4096];
            let _ = stream.read(&mut request).await;
            tokio::time::sleep(delay).await;
            let _ = stream.write_all(response.as_bytes()).await;
        });
        reqwest::Url::parse(&format!("http://{addr}/")).unwrap()
    }
    #[test]
    fn endpoints_and_queries_are_strict_and_tokens_are_encoded_once() {
        for value in [
            "http://remote.example.com",
            "https://u:p@example.com",
            "https://example.com/?key=x",
            "file:///private",
            "https://example.com/api/v2",
            "https://example.com/\n",
        ] {
            assert!(endpoint(value).is_err());
        }
        assert!(endpoint("http://[::1]:9321").is_ok());
        assert_eq!(
            endpoint("https://example.com/proxy/").unwrap(),
            endpoint("https://example.com/proxy").unwrap()
        );
        let url = query_url(
            "https://example.com/proxy/",
            "unit/key?x",
            &query("comments"),
        )
        .unwrap();
        assert_eq!(url.path(), "/proxy/unit%2Fkey%3Fx/api/v2/comment/12");
        assert_eq!(url.query(), Some("format=json&duration=true"));
        assert!(query_url("https://example.com", "", &query("unknown")).is_err());
        let mut bad = query("search");
        bad.title = Some("https://private.invalid/video".into());
        assert!(query_url("https://example.com", "", &bad).is_err());
        assert!(!source_id("dandanplay"));
        assert!(!source_id("bad/id"));
    }
    #[tokio::test]
    async fn native_http_accepts_json_and_rejects_redirect_auth_and_invalid_body() {
        let url = fixture(
            "HTTP/1.1 200 OK\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"comments\":[]}"
                .into(),
            Duration::ZERO,
        )
        .await;
        assert_eq!(
            fetch(url, true).await.unwrap()["comments"],
            serde_json::json!([])
        );
        for (status, body, expected) in [
            (302, "", "provider"),
            (401, "", "auth"),
            (403, "", "auth"),
            (429, "", "rate-limit"),
            (503, "", "provider"),
            (200, "html", "format"),
        ] {
            let url = fixture(format!("HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nLocation: https://untrusted.invalid\r\nConnection: close\r\n\r\n{body}", body.len()), Duration::ZERO).await;
            assert_eq!(fetch(url, true).await.unwrap_err(), expected);
        }
    }
    #[tokio::test]
    async fn native_http_bounds_size_and_times_out_unresponsive_service() {
        let url = fixture(
            "HTTP/1.1 200 OK\r\nContent-Length: 9000000\r\nConnection: close\r\n\r\n".into(),
            Duration::ZERO,
        )
        .await;
        assert_eq!(fetch(url, true).await.unwrap_err(), "size");
        let url = fixture(String::new(), Duration::from_secs(1)).await;
        assert_eq!(
            fetch_timeout(url, true, Duration::from_millis(40))
                .await
                .unwrap_err(),
            "timeout"
        );
    }
    #[tokio::test]
    async fn cancellation_releases_pending_native_requests() {
        let service = Service::default();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let work = run(
            &service,
            "custom".into(),
            base,
            query("search"),
            "request".into(),
        );
        let cancel = async {
            let (_socket, _) = listener.accept().await.unwrap();
            service
                .pending
                .lock()
                .unwrap()
                .remove("request")
                .unwrap()
                .send(())
                .unwrap();
        };
        let (result, _) = tokio::join!(work, cancel);
        assert_eq!(result.unwrap_err(), "cancelled");
        assert!(service.pending.lock().unwrap().is_empty());
    }
    #[tokio::test]
    async fn keys_are_scoped_to_the_exact_source_endpoint() {
        let service = Service::default();
        service.keys.lock().unwrap().insert(
            "custom".into(),
            ("https://other.invalid/".into(), "synthetic-key".into()),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let work = run(
            &service,
            "custom".into(),
            base,
            query("search"),
            "request".into(),
        );
        let server = async {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = [0u8; 4096];
            let n = stream.read(&mut bytes).await.unwrap();
            let request = String::from_utf8_lossy(&bytes[..n]);
            assert!(!request.contains("synthetic-key"));
            assert!(request.contains("/api/v2/search/episodes?anime=Example&episode=3"));
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\n{\"animes\":[]}").await.unwrap();
        };
        let (result, _) = tokio::join!(work, server);
        assert!(result.is_ok());
    }
}
