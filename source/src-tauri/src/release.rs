use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{sync::LazyLock, time::Duration};
use tauri_plugin_http::reqwest;

#[derive(Deserialize)]
struct Source {
    owner: String,
    repository: String,
}
static SOURCE: LazyLock<Source> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../src/release-source.json"))
        .expect("valid release repository")
});
pub fn page_url() -> String {
    format!(
        "https://github.com/{}/{}/releases",
        SOURCE.owner, SOURCE.repository
    )
}
fn api_url() -> String {
    format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        SOURCE.owner, SOURCE.repository
    )
}

pub fn validate_page(value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|_| "发布页面无效")?;
    let base = reqwest::Url::parse(&page_url()).unwrap();
    let root = base.path();
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !(url.path() == root || url.path().starts_with(&format!("{root}/tag/")))
    {
        return Err("仅支持 Miry 官方 GitHub 发布页面".into());
    }
    Ok(())
}

#[derive(Serialize, Debug)]
pub struct Asset {
    name: String,
    size: u64,
    browser_download_url: String,
}
#[derive(Serialize, Debug)]
pub struct ReleaseInfo {
    version: String,
    tag_name: String,
    name: String,
    notes: String,
    url: String,
    published_at: Option<String>,
    newer: bool,
    assets: Vec<Asset>,
}
fn parse_release(data: Value) -> Result<ReleaseInfo, String> {
    let tag = data["tag_name"].as_str().ok_or("缺少发布版本")?;
    if tag.len() > 64
        || data["draft"].as_bool() == Some(true)
        || data["prerelease"].as_bool() == Some(true)
    {
        return Err("发布版本无效".into());
    }
    let version =
        Version::parse(tag.strip_prefix('v').unwrap_or(tag)).map_err(|_| "发布版本无效")?;
    if !version.pre.is_empty() {
        return Err("发布版本不是正式版".into());
    }
    let current = Version::parse(env!("CARGO_PKG_VERSION")).map_err(|_| "本机版本无效")?;
    let url = data["html_url"].as_str().ok_or("缺少发布页面")?;
    validate_page(url)?;
    let assets = data["assets"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .take(64)
                .filter_map(|item| {
                    let name = item["name"].as_str()?;
                    let size = item["size"].as_u64()?;
                    let link = item["browser_download_url"].as_str()?;
                    let parsed = reqwest::Url::parse(link).ok()?;
                    let prefix =
                        format!("/{}/{}/releases/download/", SOURCE.owner, SOURCE.repository);
                    if parsed.scheme() != "https"
                        || parsed.host_str() != Some("github.com")
                        || !parsed.username().is_empty()
                        || parsed.password().is_some()
                        || parsed.port().is_some()
                        || !parsed.path().starts_with(&prefix)
                        || parsed.query().is_some()
                        || parsed.fragment().is_some()
                    {
                        return None;
                    }
                    Some(Asset {
                        name: name.chars().take(256).collect(),
                        size,
                        browser_download_url: link.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(ReleaseInfo {
        version: version.to_string(),
        tag_name: tag.to_string(),
        name: data["name"]
            .as_str()
            .unwrap_or(tag)
            .chars()
            .take(256)
            .collect(),
        notes: data["body"]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(8192)
            .collect(),
        url: url.to_string(),
        published_at: data["published_at"]
            .as_str()
            .map(|v| v.chars().take(64).collect()),
        newer: version.cmp_precedence(&current).is_gt(),
        assets,
    })
}

async fn fetch_release(endpoint: &str, timeout: Duration) -> Result<ReleaseInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "暂时无法检查更新")?;
    let request = async {
        let mut response = client
            .get(endpoint)
            .header("User-Agent", concat!("Miry/", env!("CARGO_PKG_VERSION")))
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|error| {
                if error.is_timeout() {
                    "检查更新超时"
                } else {
                    "暂时无法检查更新"
                }
            })?;
        match response.status().as_u16() {
            403 | 429 => return Err("GitHub 访问受限，请稍后手动重试".into()),
            404 => return Err("尚无公开正式版本".into()),
            200 => {}
            _ => return Err("暂时无法检查更新".into()),
        }
        const LIMIT: usize = 512 * 1024;
        if response
            .content_length()
            .is_some_and(|size| size > LIMIT as u64)
        {
            return Err("发布响应过大".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "发布响应中断")? {
            if bytes.len() + chunk.len() > LIMIT {
                return Err("发布响应过大".into());
            }
            bytes.extend(chunk);
        }
        parse_release(serde_json::from_slice(&bytes).map_err(|_| "发布响应格式无效")?)
    };
    tokio::time::timeout(timeout, request)
        .await
        .map_err(|_| "检查更新超时")?
}
pub async fn check_latest() -> Result<ReleaseInfo, String> {
    fetch_release(&api_url(), Duration::from_secs(10)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    fn release(tag: &str) -> Value {
        json!({"tag_name":tag,"name":format!("Miry {tag}"),"body":"Notes","html_url":format!("{}/tag/{tag}",page_url()),"published_at":"2026-10-05T00:00:00Z","assets":[{"name":"Miry-Setup.exe","size":123,"browser_download_url":format!("https://github.com/{}/{}/releases/download/{tag}/Miry-Setup.exe", SOURCE.owner, SOURCE.repository)}]})
    }
    #[test]
    fn release_semver_and_metadata() {
        for (tag, newer) in [
            ("v1.0.3", false),
            ("v1.0.2", false),
            ("v1.0.1", false),
            ("v1.1.0", true),
            ("v2.0.0", true),
            ("v1.0.0", false),
            ("v0.9.9", false),
        ] {
            let info = parse_release(release(tag)).unwrap();
            assert_eq!(info.newer, newer);
            assert_eq!(info.tag_name, tag);
            assert_eq!(info.assets.len(), 1);
            assert_eq!(info.notes, "Notes");
            assert!(info.published_at.is_some());
        }
    }
    #[test]
    fn malformed_or_missing_tags_and_previews_are_rejected() {
        for tag in ["preview", "v1", "vv1.0.1", "v01.0.1", "v1.0.1-rc.1"] {
            assert!(parse_release(release(tag)).is_err());
        }
        assert!(parse_release(json!({"html_url":page_url()})).is_err());
        let mut data = release("v1.0.1");
        data["draft"] = json!(true);
        assert!(parse_release(data).is_err());
    }
    #[test]
    fn links_stay_on_the_configured_public_repository() {
        assert!(validate_page(&page_url()).is_ok());
        for link in [
            "file:///c:/test",
            "https://u:p@github.com/Lomiry/Miry/releases",
            "http://127.0.0.1:18196/qa/release",
            "https://github.com/other/repo/releases",
        ] {
            assert!(validate_page(link).is_err());
        }
    }
    async fn fixture(
        status: u16,
        body: String,
        delay: Duration,
        timeout: Duration,
    ) -> Result<ReleaseInfo, String> {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buffer = [0; 8192];
            let mut request = Vec::new();
            loop {
                let n = stream.read(&mut buffer).await.unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..n]);
                if request.windows(4).any(|v| v == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request).to_lowercase();
            assert!(request.contains(&format!("user-agent: miry/{}", env!("CARGO_PKG_VERSION"))));
            assert!(request.contains("accept: application/vnd.github+json"));
            assert!(!request.contains("authorization:") && !request.contains("cookie:"));
            tokio::time::sleep(delay).await;
            let header = format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());
            let _ = stream.write_all(format!("{header}{body}").as_bytes()).await;
        });
        let result = fetch_release(&format!("http://{address}/latest"), timeout).await;
        server.await.unwrap();
        result
    }
    #[tokio::test]
    async fn github_headers_and_success_response() {
        assert!(
            fixture(
                200,
                release("v1.1.0").to_string(),
                Duration::ZERO,
                Duration::from_secs(2)
            )
            .await
            .unwrap()
            .newer
        );
    }
    #[tokio::test]
    async fn github_404_is_not_latest() {
        assert!(
            fixture(404, "{}".into(), Duration::ZERO, Duration::from_secs(2))
                .await
                .unwrap_err()
                .contains("尚无公开")
        );
    }
    #[tokio::test]
    async fn github_403_and_rate_limit_do_not_retry() {
        for status in [403, 429] {
            assert!(
                fixture(status, "{}".into(), Duration::ZERO, Duration::from_secs(2))
                    .await
                    .unwrap_err()
                    .contains("访问受限")
            );
        }
    }
    #[tokio::test]
    async fn malformed_json_is_not_latest() {
        assert!(
            fixture(200, "{bad".into(), Duration::ZERO, Duration::from_secs(2))
                .await
                .unwrap_err()
                .contains("格式无效")
        );
    }
    #[tokio::test]
    async fn timeout_is_bounded() {
        assert!(fixture(
            200,
            release("v1.0.2").to_string(),
            Duration::from_millis(150),
            Duration::from_millis(30)
        )
        .await
        .unwrap_err()
        .contains("超时"));
    }
}
