mod provider_build;

fn main() {
    provider_build::configure().unwrap_or_else(|message| panic!("{message}"));
    tauri_build::build();
    // Library test executables also link TaskDialogIndirect and require comctl32 v6.
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        // The desktop binary already embeds Tauri's manifest through resource.lib.
        println!("cargo:rustc-link-arg-bin=miry-emby=/MANIFEST:NO");
    }
}
