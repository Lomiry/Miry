use super::*;

#[test]
fn frontend_and_native_share_all_endpoint_policy_cases() {
    #[derive(Deserialize)]
    struct Case {
        url: String,
        lan: bool,
        valid: bool,
    }
    let cases: Vec<Case> =
        serde_json::from_str(include_str!("../../src/danmaku/endpoint-policy-cases.json")).unwrap();
    assert_eq!(cases.len(), 47);
    for case in cases {
        assert_eq!(
            authorized_endpoint(&case.url, case.lan).is_ok(),
            case.valid,
            "endpoint classification mismatch"
        );
    }
}

#[test]
fn approved_lan_paths_are_preserved_and_targets_never_escape_to_public_http() {
    let base = authorized_endpoint("http://192.168.50.1:9321/proxy/base/", true).unwrap();
    assert_eq!(
        base,
        authorized_endpoint("http://192.168.50.1:9321/proxy/base", true).unwrap()
    );
    let q = Query {
        kind: "health".into(),
        title: None,
        episode: None,
        id: None,
    };
    let token = uuid::Uuid::new_v4().to_string();
    let url = query_url(base.as_str(), &token, &q).unwrap();
    assert_eq!(url.host_str(), base.host_str());
    assert_eq!(url.port(), base.port());
    assert!(url.path().starts_with("/proxy/base/"));
    assert!(url.path().ends_with("/api/v2/search/anime"));
    assert!(!url.path().contains("/emby"));
    assert!(query_url(&format!("http://192.168.50.1:9321/{token}"), &token, &q).is_err());
    assert!(authorized_endpoint("http://public.example.test", true).is_err());
    assert!(authorized_endpoint(base.as_str(), false).is_err());
}

#[cfg(windows)]
#[test]
fn lan_credentials_survive_a_new_process_with_exact_endpoint_binding() {
    use sha2::{Digest, Sha256};
    let base = "http://192.168.50.1:9321/proxy";
    if let Some(directory) = std::env::var_os("MIRY_LAN_TEST_DIRECTORY") {
        let store = Store(directory.into());
        let service = Service::default();
        let normalized = authorized_endpoint(&format!("{base}/"), true)
            .unwrap()
            .to_string();
        load_key(&service, &store, "lan-fixture", &normalized).unwrap();
        let status =
            credential_action(&service, &store, "lan-fixture", base, None, "status", None).unwrap();
        assert_eq!(status.state, "saved");
        let binding = store.load("lan-fixture").unwrap().unwrap();
        let actual = format!("{:x}", Sha256::digest(binding.token.as_bytes()));
        assert!(actual == std::env::var("MIRY_LAN_TEST_DIGEST").unwrap());
        assert!(load_key(
            &service,
            &store,
            "lan-fixture",
            "http://192.168.50.2:9321/proxy"
        )
        .is_err());
        return;
    }
    let root = crate::source_credentials::tests::Fixture::new();
    let store = root.store();
    let service = Service::default();
    authorized_endpoint(base, true).unwrap();
    let token = uuid::Uuid::new_v4().to_string();
    let digest = format!("{:x}", Sha256::digest(token.as_bytes()));
    let receipt = credential_action(
        &service,
        &store,
        "lan-fixture",
        base,
        Some(token.clone()),
        "save",
        None,
    )
    .unwrap();
    credential_action(
        &service,
        &store,
        "lan-fixture",
        base,
        None,
        "finish",
        receipt.transaction.as_deref(),
    )
    .unwrap();
    for file in std::fs::read_dir(&store.0).unwrap() {
        let bytes = std::fs::read(file.unwrap().path()).unwrap();
        assert!(!bytes
            .windows(token.len())
            .any(|part| part == token.as_bytes()));
    }
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "danmaku_sources::http_tests::lan_credentials_survive_a_new_process_with_exact_endpoint_binding"])
        .env("MIRY_LAN_TEST_DIRECTORY", &store.0)
        .env("MIRY_LAN_TEST_DIGEST", digest)
        .output().unwrap();
    assert!(
        output.status.success(),
        "isolated child credential reader failed"
    );
    assert!(!output
        .stdout
        .windows(token.len())
        .any(|part| part == token.as_bytes()));
    assert!(!output
        .stderr
        .windows(token.len())
        .any(|part| part == token.as_bytes()));
}
