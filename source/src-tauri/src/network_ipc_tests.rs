use serde_json::{json, Value};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    webview::InvokeRequest,
};

fn app() -> tauri::App<tauri::test::MockRuntime> {
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = format!("com.miry.network-test.{}", uuid::Uuid::new_v4());
    tauri::test::mock_builder()
        .plugin(tauri_plugin_http::init())
        .build(context)
        .expect("isolated plugin test app")
}
fn ipc(
    window: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    command: &str,
    data: Value,
) -> Result<Value, String> {
    tauri::test::get_ipc_response(
        window,
        InvokeRequest {
            cmd: command.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: InvokeBody::Json(data),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
    .map(|body| body.deserialize::<Value>().unwrap())
    .map_err(|error| error.to_string())
}
fn fetch_public(
    window: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    address: String,
) -> Result<(u16, Value), String> {
    fetch_json(
        window,
        "GET",
        address,
        vec![["Accept".into(), "application/json".into()]],
        None,
    )
}
fn fetch_json(
    window: &tauri::WebviewWindow<tauri::test::MockRuntime>,
    method: &str,
    address: String,
    headers: Vec<[String; 2]>,
    body: Option<Value>,
) -> Result<(u16, Value), String> {
    let data = body.map(|value| serde_json::to_vec(&value).unwrap());
    let rid = ipc(
        window,
        "plugin:http|fetch",
        json!({"clientConfig":{"method":method, "url":address, "headers":headers, "data":data, "maxRedirections":10, "connectTimeout":10000}}),
    )?;
    let response = ipc(window, "plugin:http|fetch_send", json!({"rid":rid}))?;
    let status = response["status"]
        .as_u64()
        .ok_or("missing response status")? as u16;
    let mut bytes = vec![];
    if status == 204 {
        let _ = ipc(
            window,
            "plugin:http|fetch_cancel_body",
            json!({"rid":response["rid"]}),
        );
        return Ok((status, Value::Null));
    }
    for _ in 0..16 {
        let packet = ipc(
            window,
            "plugin:http|fetch_read_body",
            json!({"rid":response["rid"]}),
        )?;
        let mut data: Vec<u8> =
            serde_json::from_value(packet).map_err(|_| "invalid body packet")?;
        let end = data.pop().ok_or("empty body packet")? == 1;
        bytes.extend(data);
        if end {
            return Ok((
                status,
                if bytes.is_empty() {
                    Value::Null
                } else {
                    serde_json::from_slice(&bytes).map_err(|_| "invalid JSON response")?
                },
            ));
        }
    }
    Err("too many body packets".into())
}
#[test]
fn actual_plugin_ipc_accepts_a_nonstandard_port_and_reads_server_info() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let address = format!(
        "http://{}/System/Info/Public",
        listener.local_addr().unwrap()
    );
    let server = std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
        while std::time::Instant::now() < deadline {
            if let Ok((mut stream, _)) = listener.accept() {
                stream
                    .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                    .unwrap();
                let mut buffer = [0u8; 4096];
                let _ = stream.read(&mut buffer);
                let body = r#"{"Id":"s","ServerName":"Fixture","Version":"4.9"}"#;
                let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len());
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    });
    let app = app();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let result = fetch_public(&window, address);
    assert!(
        result.is_ok(),
        "native plugin scope and send must both succeed: {}",
        result.as_ref().err().unwrap_or(&String::new())
    );
    let (status, body) = result.unwrap();
    assert_eq!(status, 200);
    assert_eq!(body["ServerName"], "Fixture");
    server.join().unwrap();
}
#[test]
#[ignore = "requires authorized network targets via MIRY_NETWORK_TARGETS; metadata only"]
fn authorized_public_apis_through_actual_plugin_ipc() {
    let file = std::env::var("MIRY_NETWORK_TARGETS").expect("set MIRY_NETWORK_TARGETS");
    let targets: Vec<Value> =
        serde_json::from_str(&std::fs::read_to_string(file).unwrap()).unwrap();
    let app = app();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for target in targets {
        let base = target["server"].as_str().unwrap().trim_end_matches('/');
        let result = fetch_public(&window, format!("{base}/System/Info/Public"));
        assert!(
            result.is_ok(),
            "authorized public API failed through plugin IPC; private endpoint omitted"
        );
        let (status, body) = result.unwrap();
        assert_eq!(status, 200, "public API HTTP status");
        assert!(
            ["Id", "ServerName", "Version"]
                .iter()
                .all(|key| body[key].as_str().is_some()),
            "public API shape"
        );
        println!(
            "{}",
            json!({"label":target["label"],"status":status,"serverNameMatches":body["ServerName"]=="OkEmby","serverVersion":body["Version"].as_str().filter(|s|s.chars().all(|c|c.is_ascii_digit()||c=='.')),"validServerInfo":true,"transport":"actual plugin-http IPC / rustls"})
        );
        if let Some(auth) = target.get("auth") {
            let mut headers=vec![["Content-Type".into(),"application/json".into()],["X-Emby-Authorization".into(),format!("Emby Client=\"Miry\", Device=\"Windows\", DeviceId=\"miry-network-metadata-regression\", Version=\"{}\"",env!("CARGO_PKG_VERSION"))]];
            let authenticated = fetch_json(
                &window,
                "POST",
                format!("{base}/emby/Users/AuthenticateByName"),
                headers.clone(),
                Some(auth.clone()),
            );
            assert!(
                authenticated.is_ok(),
                "authorized login transport failed; private details omitted"
            );
            let (login_status, session) = authenticated.unwrap();
            assert_eq!(login_status, 200, "authorized login status");
            let token = session["AccessToken"].as_str().expect("valid test session");
            let user = session["User"]["Id"].as_str().expect("valid test user");
            headers.push(["X-Emby-Token".into(), token.into()]);
            let libraries = fetch_json(
                &window,
                "GET",
                format!("{base}/emby/Users/{user}/Views"),
                headers.clone(),
                None,
            );
            let items=fetch_json(&window,"GET",format!("{base}/emby/Users/{user}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Limit=3"),headers.clone(),None);
            let logout = fetch_json(
                &window,
                "POST",
                format!("{base}/emby/Sessions/Logout"),
                headers,
                Some(json!({})),
            );
            assert!(
                libraries.is_ok() && items.is_ok() && logout.is_ok(),
                "authorized metadata regression and logout must succeed; private details omitted"
            );
            let (views_status, views) = libraries.unwrap();
            let (items_status, items) = items.unwrap();
            assert_eq!(views_status, 200);
            assert_eq!(items_status, 200);
            println!(
                "{}",
                json!({"label":target["label"],"login":true,"libraries":views["Items"].as_array().map(Vec::len),"items":items["Items"].as_array().map(Vec::len),"logout":true,"mediaRequests":0})
            );
        }
    }
}
