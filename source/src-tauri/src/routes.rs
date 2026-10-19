//! Explicit, bounded route samples. No persistent media bytes and no playback session.
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri_plugin_http::reqwest::{self, Client, Url};
use tokio::{
    sync::{watch, Mutex as AsyncMutex},
    time::{timeout, Instant},
};
const CAP: usize = 256 * 1024;
#[derive(Default)]
pub struct Probes {
    last: Mutex<HashMap<String, Instant>>,
    active: Mutex<HashMap<String, watch::Sender<bool>>>,
    cancelled: Mutex<HashMap<String, Instant>>,
    serial: AsyncMutex<()>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSample {
    item_id: String,
    source_id: String,
    container: Option<String>,
    token: String,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    dns_ms: Option<f64>,
    tcp_ms: Option<f64>,
    tls_ms: Option<f64>,
    connect_ms: Option<f64>,
    api_ttfb_ms: Option<f64>,
    api_total_ms: Option<f64>,
    small_object_ms: Option<f64>,
    jitter_ms: Option<f64>,
    throughput_mbps: Option<f64>,
    sample_bytes: usize,
    media_total_ms: Option<f64>,
    failure_rate: f64,
    samples: usize,
    identity_valid: bool,
    media_note: String,
}
fn server_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "线路地址无效。")?;
    if !["http", "https"].contains(&url.scheme())
        || url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("线路地址无效。".into());
    }
    Ok(url)
}
async fn bounded(response: &mut reqwest::Response, cap: usize) -> Result<Vec<u8>, String> {
    if response.content_length().is_some_and(|n| n > cap as u64) {
        return Err("响应超过测试上限。".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "测试响应中断。")? {
        if body.len() + chunk.len() > cap {
            return Err("响应超过测试上限。".into());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
fn median(values: &mut [f64]) -> Option<f64> {
    values.sort_by(f64::total_cmp);
    values.get(values.len() / 2).copied()
}
fn valid_range(value: &str) -> Option<usize> {
    let (range, total) = value.strip_prefix("bytes ")?.split_once('/')?;
    let (start, end) = range.split_once('-')?;
    let start = start.parse::<usize>().ok()?;
    let end = end.parse::<usize>().ok()?;
    if start == 0 && end < CAP && (total == "*" || end < total.parse::<usize>().ok()?) {
        Some(end + 1)
    } else {
        None
    }
}
async fn measure(
    server: String,
    expected: String,
    media: Option<MediaSample>,
) -> Result<Metrics, String> {
    let base = server_url(&server)?;
    if expected.is_empty() || expected.len() > 256 {
        return Err("缺少服务器身份，先验证线路。".into());
    }
    let origin = base.origin();
    let policy = reqwest::redirect::Policy::custom(move |a| {
        if a.previous().len() < 3 && a.url().origin() == origin {
            a.follow()
        } else {
            a.stop()
        }
    });
    let client = Client::builder()
        .redirect(policy)
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|_| "无法初始化线路测试。")?;
    let root = base
        .as_str()
        .trim_end_matches('/')
        .trim_end_matches("/emby");
    let mut api = Url::parse(&format!("{root}/System/Info/Public")).map_err(|_| "地址无效")?;
    let mut timings = vec![];
    let mut totals = vec![];
    let mut result = Metrics::default();
    for index in 0..3 {
        if index > 0 {
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        result.samples += 1;
        let start = Instant::now();
        let sample = async {
            let mut response = client
                .get(api.clone())
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|_| "API 请求失败。")?;
            if index == 0 && [404, 405].contains(&response.status().as_u16()) {
                api = Url::parse(&format!(
                    "{}/System/Info/Public",
                    base.as_str().trim_end_matches('/')
                ))
                .map_err(|_| "地址无效")?;
                response = client
                    .get(api.clone())
                    .send()
                    .await
                    .map_err(|_| "API 请求失败。")?;
            }
            if response.status() != 200 {
                return Err("API 请求未通过。".into());
            }
            let ttfb = start.elapsed().as_secs_f64() * 1000.;
            let data = bounded(&mut response, 16384).await?;
            let info: serde_json::Value =
                serde_json::from_slice(&data).map_err(|_| "API 返回格式无效。")?;
            if info["Id"] != expected {
                return Err("身份不匹配。".into());
            }
            Ok::<(f64, f64), String>((ttfb, start.elapsed().as_secs_f64() * 1000.))
        };
        match timeout(Duration::from_secs(4), sample).await {
            Ok(Ok((ttfb, total))) => {
                timings.push(ttfb);
                totals.push(total);
                result.identity_valid = true;
            }
            Ok(Err(e)) if e == "身份不匹配。" => {
                return Err("这条线路属于其他服务器，已阻止认证与媒体请求。".into())
            }
            _ => {}
        }
    }
    result.failure_rate = (result.samples - timings.len()) as f64 / result.samples as f64;
    result.jitter_ms = if timings.len() > 1 {
        Some(
            timings.iter().copied().fold(f64::NEG_INFINITY, f64::max)
                - timings.iter().copied().fold(f64::INFINITY, f64::min),
        )
    } else {
        None
    };
    result.api_ttfb_ms = median(&mut timings);
    result.api_total_ms = median(&mut totals);
    result.small_object_ms = result.api_total_ms;
    if let Some(media) = media {
        if !result.identity_valid {
            result.media_note = "API 未验证，未发送媒体认证。".into();
            return Ok(result);
        }
        if media.item_id.is_empty()
            || media.item_id.len() > 256
            || media.item_id.contains('/')
            || media.source_id.len() > 256
            || media.token.len() > 8192
            || media.token.contains(['\r', '\n'])
        {
            return Err("媒体测试参数无效。".into());
        }
        let mut url = base.clone();
        url.path_segments_mut()
            .map_err(|_| "线路地址无效")?
            .pop_if_empty()
            .extend(["Videos", &media.item_id]);
        let ext = media
            .container
            .filter(|s| s.len() < 17 && s.bytes().all(|b| b.is_ascii_alphanumeric()))
            .unwrap_or_default();
        url.path_segments_mut()
            .map_err(|_| "线路地址无效")?
            .push(&if ext.is_empty() {
                "stream".into()
            } else {
                format!("stream.{ext}")
            });
        url.query_pairs_mut()
            .append_pair("Static", "true")
            .append_pair("MediaSourceId", &media.source_id);
        let start = Instant::now();
        let sample = async {
            let mut response = client
                .get(url)
                .header("Range", format!("bytes=0-{}", CAP - 1))
                .header("Accept-Encoding", "identity")
                .header("X-Emby-Token", media.token)
                .send()
                .await
                .map_err(|_| "媒体小样本请求失败。")?;
            if response.status() != 206 {
                return Err("服务器未提供有效 Range，未读取媒体正文。".into());
            }
            let expected = response
                .headers()
                .get("content-range")
                .and_then(|v| v.to_str().ok())
                .and_then(valid_range)
                .ok_or("Range 超过测试上限，已取消。")?;
            let body = bounded(&mut response, CAP).await?;
            if body.len() != expected {
                return Err("媒体小样本长度不匹配。".into());
            }
            Ok::<usize, String>(body.len())
        };
        match timeout(Duration::from_secs(4), sample).await {
            Ok(Ok(bytes)) => {
                let ms = start.elapsed().as_secs_f64() * 1000.;
                result.sample_bytes = bytes;
                result.media_total_ms = Some(ms);
                if bytes >= 65536 && ms >= 20. {
                    result.throughput_mbps = Some(bytes as f64 * 8. / ms / 1000.);
                } else {
                    result.media_note = "样本过短，吞吐估计不可靠。".into();
                }
            }
            Ok(Err(e)) => result.media_note = e,
            Err(_) => result.media_note = "小样本超过 4 秒，已取消。".into(),
        }
    }
    Ok(result)
}
#[tauri::command]
pub async fn route_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Probes>,
    id: String,
    server: String,
    expected: String,
    media: Option<MediaSample>,
) -> Result<Metrics, String> {
    if window.label() != "main" || id.len() > 72 {
        return Err("线路测试由主窗口管理。".into());
    }
    server_url(&server)?;
    let _serial = state
        .serial
        .try_lock()
        .map_err(|_| "另一个线路测试正在运行。")?;
    {
        let mut last = state.last.lock().map_err(|_| "线路测试状态不可用")?;
        if last
            .get(&server)
            .is_some_and(|t| t.elapsed() < Duration::from_secs(60))
        {
            return Err("请至少间隔 60 秒再测试这条线路。".into());
        }
        last.retain(|_, v| v.elapsed() < Duration::from_secs(3600));
        last.insert(server.clone(), Instant::now());
    }
    let (cancel, mut cancelled) = watch::channel(false);
    state
        .active
        .lock()
        .map_err(|_| "测试状态不可用")?
        .insert(id.clone(), cancel);
    if state
        .cancelled
        .lock()
        .map_err(|_| "测试状态不可用")?
        .remove(&id)
        .is_some()
    {
        state
            .active
            .lock()
            .map_err(|_| "测试状态不可用")?
            .remove(&id);
        return Err("已取消线路测试。".into());
    }
    let result = tokio::select! {_ = cancelled.changed()=>Err("已取消线路测试。".into()),result=measure(server,expected,media)=>result};
    state
        .active
        .lock()
        .map_err(|_| "测试状态不可用")?
        .remove(&id);
    result
}
#[tauri::command]
pub fn cancel_route_probe(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Probes>,
    id: String,
) -> Result<(), String> {
    if window.label() != "main" || id.len() > 72 {
        return Err("测试由主窗口管理。".into());
    }
    if let Some(sender) = state.active.lock().map_err(|_| "状态不可用")?.get(&id) {
        let _ = sender.send(true);
    } else {
        let mut cancelled = state.cancelled.lock().map_err(|_| "状态不可用")?;
        cancelled.retain(|_, t| t.elapsed() < Duration::from_secs(60));
        if cancelled.len() < 64 {
            cancelled.insert(id, Instant::now());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };
    fn fixture(
        identity: &'static str,
        status: u16,
        range: &'static str,
    ) -> (String, std::thread::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/emby", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let mut requests = vec![];
            for _ in 0..if identity == "s" { 4 } else { 1 } {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut bytes = [0u8; 8192];
                let n = stream.read(&mut bytes).unwrap();
                let request = String::from_utf8_lossy(&bytes[..n]).to_string();
                let public = request.contains("/System/Info/Public");
                requests.push(request);
                if public {
                    let body = format!("{{\"Id\":\"{identity}\"}}");
                    write!(
                        stream,
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    )
                    .unwrap();
                } else {
                    write!(stream,"HTTP/1.1 {status} OK\r\nContent-Range: {range}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",CAP).unwrap();
                    if status == 206 && valid_range(range).is_some() {
                        std::thread::sleep(Duration::from_millis(30));
                        let _ = stream.write_all(&vec![0; CAP]);
                    }
                }
            }
            requests
        });
        (url, handle)
    }
    fn media() -> Option<MediaSample> {
        Some(MediaSample {
            item_id: "m".into(),
            source_id: "src".into(),
            container: Some("mkv".into()),
            token: "qa-private".into(),
        })
    }
    #[tokio::test]
    async fn real_range_is_bounded_and_metadata_is_unauthenticated() {
        let (url, server) = fixture("s", 206, "bytes 0-262143/1000000");
        let m = measure(url, "s".into(), media()).await.unwrap();
        assert_eq!(m.samples, 3);
        assert_eq!(m.sample_bytes, CAP);
        assert!(m.throughput_mbps.is_some());
        assert!(m.dns_ms.is_none());
        let requests = server.join().unwrap();
        assert!(requests[..3].iter().all(|r| !r.contains("qa-private")));
        assert!(requests[3].to_lowercase().contains("range: bytes=0-262143"));
    }
    #[tokio::test]
    async fn mismatched_server_gets_no_authentication_or_media() {
        let (url, server) = fixture("other", 206, "bytes 0-262143/1000000");
        assert!(measure(url, "s".into(), media()).await.is_err());
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(!requests[0].contains("qa-private"));
    }
    #[tokio::test]
    async fn ignored_or_oversized_range_never_reads_a_media_body() {
        for (status, range) in [
            (200, "bytes 0-262143/1000000"),
            (206, "bytes 0-999999/1000000"),
        ] {
            let (url, server) = fixture("s", status, range);
            let m = measure(url, "s".into(), media()).await.unwrap();
            assert_eq!(m.sample_bytes, 0);
            assert!(m.throughput_mbps.is_none());
            assert!(!m.media_note.is_empty());
            server.join().unwrap();
        }
    }
    #[test]
    fn bounded_range_rejects_a_whole_media_response() {
        assert_eq!(valid_range("bytes 0-262143/2000000"), Some(CAP));
        assert!(valid_range("bytes 0-9999999/20000000").is_none());
        assert!(valid_range("bytes 1-100/300").is_none());
        assert!(server_url("https://user:pass@server/").is_err());
    }
}
