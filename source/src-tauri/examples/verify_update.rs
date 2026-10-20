//! Offline release preflight; MockRuntime never launches an installer or a WebView.
use std::{env, fs, process};
use tauri_plugin_updater::UpdaterExt;
fn verify() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args_os().skip(1).collect();
    if args.len() != 2 {
        return Err("expected manifest.json and installer.exe".into());
    }
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let key = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("official updater public key is not configured")?;
    let raw: serde_json::Value = serde_json::from_slice(&fs::read(&args[0])?)?;
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert("updater".into(), serde_json::json!({"pubkey":key,"requireSignedVersion":true,"endpoints":["https://example.invalid/latest.json"]}));
    let app = tauri::test::mock_builder().build(context)?;
    app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
    let update = app
        .updater_builder()
        .pubkey(key)
        .target("windows-x86_64")
        .executable_path("Miry.exe")
        .build()?
        .restore_update(raw)?
        .ok_or("invalid release version")?;
    update.verify(&fs::read(&args[1])?)?;
    Ok(())
}
fn main() {
    if verify().is_err() {
        eprintln!("Updater preflight failed: public key, signature, artifact or signed version is invalid.");
        process::exit(1);
    }
    println!("Updater artifact signature and signed version verified (offline, no installation).");
}
