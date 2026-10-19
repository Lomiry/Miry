use serde::Serialize;
use serde_json::Value;
use std::{
    error::Error,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri_plugin_http::reqwest;

pub fn redact_detail(text: &str, server: &str, token: &str) -> String {
    static URLS: OnceLock<regex::Regex> = OnceLock::new();
    let urls = URLS.get_or_init(|| regex::Regex::new(r#"https?://[^\s<>"')]+"#).unwrap());
    let mut safe = urls.replace_all(text, "[URL]").into_owned();
    static HEADERS: OnceLock<regex::Regex> = OnceLock::new();
    safe = HEADERS
        .get_or_init(|| {
            regex::Regex::new(
                r"(?im)(?:X-Emby-Token|Authorization|Cookie|Set-Cookie)\s*[:=][^\r\n]*",
            )
            .unwrap()
        })
        .replace_all(&safe, "[credential header omitted]")
        .into_owned();
    if let Ok(url) = reqwest::Url::parse(server) {
        if let Some(host) = url.host_str() {
            safe = safe.replace(host, "[host]");
        }
    }
    if !token.is_empty() {
        safe = safe.replace(token, "[redacted]");
    }
    safe.chars().take(1500).collect()
}
pub fn error_chain(error: &reqwest::Error, server: &str) -> Vec<String> {
    let mut result = vec![redact_detail(&error.to_string(), server, "")];
    let mut source = error.source();
    while let Some(error) = source {
        result.push(redact_detail(&error.to_string(), server, ""));
        source = error.source();
        if result.len() == 8 {
            break;
        }
    }
    result
}
fn category(error: &reqwest::Error, chain: &[String]) -> &'static str {
    if error.is_timeout() {
        return "timeout";
    }
    let text = chain.join(" ").to_lowercase();
    if ["dns", "resolve", "lookup", "11001", "11004"]
        .iter()
        .any(|v| text.contains(v))
    {
        "dns"
    } else if ["tls", "ssl", "certificat", "renegoti"]
        .iter()
        .any(|v| text.contains(v))
    {
        "tls"
    } else if error.is_connect() {
        "tcp"
    } else {
        "network"
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkReport {
    pub stage: String,
    pub backend: String,
    pub url: String,
    pub status: Option<u16>,
    pub redirect_statuses: Vec<u16>,
    pub content_type: Option<String>,
    pub elapsed_ms: u128,
    pub category: String,
    pub errors: Vec<String>,
    pub valid_server_info: bool,
    pub body_preview: String,
}
fn backend() -> &'static str {
    "reqwest / rustls"
}

pub async fn probe(server: String) -> Result<NetworkReport, String> {
    let mut url = reqwest::Url::parse(&server).map_err(|_| "服务器地址无效")?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("服务器地址只支持无凭据的 HTTP(S) 地址".into());
    }
    url.set_path(&format!(
        "{}/System/Info/Public",
        url.path().trim_end_matches('/').trim_end_matches("/emby")
    ));
    let safe_url = format!(
        "{}://[server]{}/System/Info/Public",
        url.scheme(),
        url.port().map(|p| format!(":{p}")).unwrap_or_default()
    );
    let redirects = Arc::new(Mutex::new(vec![]));
    let steps = redirects.clone();
    let policy = reqwest::redirect::Policy::custom(move |attempt| {
        steps.lock().unwrap().push(attempt.status().as_u16());
        if attempt.previous().len() >= 10 {
            attempt.error("redirect limit reached")
        } else {
            attempt.follow()
        }
    });
    let began = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(policy)
        .build()
        .map_err(|_| "无法初始化网络诊断")?;
    let mut report = NetworkReport {
        stage: "native-probe".into(),
        backend: backend().into(),
        url: safe_url,
        status: None,
        redirect_statuses: vec![],
        content_type: None,
        elapsed_ms: 0,
        category: "network".into(),
        errors: vec![],
        valid_server_info: false,
        body_preview: String::new(),
    };
    match client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
    {
        Err(error) => {
            report.errors = error_chain(&error, &server);
            report.category = category(&error, &report.errors).into();
        }
        Ok(mut response) => {
            report.status = Some(response.status().as_u16());
            report.content_type = response
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.split(';').next())
                .filter(|v| {
                    v.len() < 80
                        && v.chars()
                            .all(|c| c.is_ascii_alphanumeric() || "/.+-_".contains(c))
                })
                .map(String::from);
            let mut body = Vec::new();
            loop {
                match response.chunk().await {
                    Ok(Some(chunk)) if body.len() + chunk.len() <= 65536 => {
                        body.extend_from_slice(&chunk)
                    }
                    Ok(Some(_)) => {
                        report.category = "format".into();
                        report
                            .errors
                            .push("ServerInfo response exceeds 64 KiB".into());
                        break;
                    }
                    Ok(None) => {
                        let value = serde_json::from_slice::<Value>(&body).ok();
                        report.valid_server_info = value.as_ref().is_some_and(|v| {
                            ["Id", "ServerName", "Version"]
                                .iter()
                                .all(|key| v[key].as_str().is_some_and(|s| !s.trim().is_empty()))
                        });
                        report.body_preview = format!(
                            "{} ({} bytes; string values omitted)",
                            if value.is_some() { "JSON" } else { "Non-JSON" },
                            body.len()
                        );
                        report.category = if !(200..300).contains(&report.status.unwrap_or(0)) {
                            "http"
                        } else if report.valid_server_info {
                            "ok"
                        } else {
                            "format"
                        }
                        .into();
                        break;
                    }
                    Err(error) => {
                        report.stage = "native-read-body".into();
                        report.errors = error_chain(&error, &server);
                        report.category = category(&error, &report.errors).into();
                        break;
                    }
                }
            }
        }
    }
    report.redirect_statuses = redirects.lock().unwrap().clone();
    report.elapsed_ms = began.elapsed().as_millis();
    Ok(report)
}
#[tauri::command]
pub async fn diagnose_server(server: String) -> Result<NetworkReport, String> {
    probe(server).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn removes_addresses_and_tokens_from_native_error_messages() {
        let message = redact_detail("TLS failed for https://media.example.com:8443/stream?token=secret; media.example.com secret", "https://media.example.com:8443/emby", "secret");
        assert!(!message.contains("media.example.com"));
        assert!(!message.contains("secret"));
        assert!(!message.contains("/stream"));
    }
    #[tokio::test]
    async fn refuses_credentials_and_non_http_probe_urls() {
        for server in [
            "file:///tmp/test",
            "https://u:p@media.example.com",
            "https://media.example.com/?token=secret",
        ] {
            assert!(probe(server.into()).await.is_err());
        }
    }
    #[test]
    fn capability_scope_allows_user_selected_ports_for_login_and_playback() {
        use urlpattern::{UrlPattern, UrlPatternInit, UrlPatternMatchInput};
        let config: Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let http = config["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["identifier"] == "http:default")
            .unwrap();
        let patterns: Vec<UrlPattern> = http["allow"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| {
                let mut init = UrlPatternInit::parse_constructor_string::<regex::Regex>(
                    entry["url"].as_str().unwrap(),
                    None,
                )
                .unwrap();
                for field in [&mut init.pathname, &mut init.search, &mut init.hash] {
                    if field.as_ref().is_none_or(|s| s.is_empty() || s == "/") {
                        *field = Some("*".into());
                    }
                }
                UrlPattern::parse(init, Default::default()).unwrap()
            })
            .collect();
        for address in [
            "https://media.example.com/System/Info/Public",
            "https://media.example.com:8443/emby/Users/AuthenticateByName",
            "https://media.example.com:8443/emby/Items/movie/PlaybackInfo",
            "http://127.0.0.1:8096/emby/System/Info/Public",
            "http://[::1]:8096/emby/Items",
            "https://198.18.0.1:8443/emby/Items",
        ] {
            let url: reqwest::Url = address.parse().unwrap();
            assert!(
                patterns.iter().any(|pattern| pattern
                    .test(UrlPatternMatchInput::Url(url.clone()))
                    .unwrap()),
                "user-selected HTTP(S) port must be allowed"
            );
        }
        let file: reqwest::Url = "file:///C:/secret.txt".parse().unwrap();
        assert!(!patterns.iter().any(|pattern| pattern
            .test(UrlPatternMatchInput::Url(file.clone()))
            .unwrap()));
    }
}
