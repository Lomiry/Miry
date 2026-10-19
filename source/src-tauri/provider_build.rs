//! Build inputs never travel through rustc-env or Cargo's environment fingerprints.
use serde::Deserialize;
use std::{fs, io::Read, path::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Identity {
    app_id: String,
    app_secret: String,
}

fn parse(bytes: &[u8]) -> Result<Identity, &'static str> {
    let identity: Identity = serde_json::from_slice(bytes)
        .map_err(|_| "OFFICIAL: invalid credential JSON (values withheld)")?;
    if identity.app_id.is_empty()
        || identity.app_id.len() > 128
        || !identity
            .app_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
        || !(8..=512).contains(&identity.app_secret.len())
        || !identity.app_secret.bytes().all(|b| b.is_ascii_graphic())
    {
        return Err("OFFICIAL: invalid credential format (values withheld)");
    }
    Ok(identity)
}

fn external(root: &Path, source: &Path) -> bool {
    root.is_absolute()
        && root.parent().is_some()
        && !root.starts_with(source)
        && !source.starts_with(root)
}

fn module(identity: Option<&Identity>) -> String {
    match identity {
        None => "pub fn identity() -> Option<(&'static str, &'static str)> { None }\n".into(),
        // Byte representation is NOT encryption and provides no client secret security.
        Some(i) => format!(
            "pub fn identity() -> Option<(&'static str, &'static str)> {{ Some((std::str::from_utf8(&{:?}).expect(\"identity encoding\"), std::str::from_utf8(&{:?}).expect(\"identity encoding\"))) }}\n",
            i.app_id.as_bytes(), i.app_secret.as_bytes()
        ),
    }
}

pub fn configure() -> Result<(), &'static str> {
    println!("cargo:rerun-if-changed=provider_build.rs");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-env-changed=MIRY_PROVIDER_BUILD_MODE");
    println!("cargo:rerun-if-env-changed=MIRY_PROVIDER_BUILD_ROOT");
    println!("cargo:rerun-if-env-changed=MIRY_PROVIDER_CREDENTIAL_FILE");
    println!("cargo:rustc-check-cfg=cfg(miry_official)");
    let mode = match std::env::var("MIRY_PROVIDER_BUILD_MODE") {
        Ok(value) => value,
        Err(std::env::VarError::NotPresent) => "PUBLIC".into(),
        Err(_) => return Err("Provider: invalid build mode encoding"),
    };
    let out = std::env::var_os("OUT_DIR").ok_or("Provider: missing build output directory")?;
    let out = Path::new(&out);
    let identity = match mode.as_str() {
        "PUBLIC" => None,
        "OFFICIAL" => {
            let root = std::env::var_os("MIRY_PROVIDER_BUILD_ROOT")
                .ok_or("OFFICIAL: isolated build root required")?;
            let root = fs::canonicalize(root).map_err(|_| "OFFICIAL: invalid build root")?;
            let source = fs::canonicalize("..").map_err(|_| "OFFICIAL: invalid source root")?;
            let target = std::env::var_os("CARGO_TARGET_DIR")
                .ok_or("OFFICIAL: external CARGO_TARGET_DIR required")?;
            let target =
                fs::canonicalize(target).map_err(|_| "OFFICIAL: invalid target directory")?;
            let output = fs::canonicalize(out).map_err(|_| "OFFICIAL: invalid output directory")?;
            let input = std::env::var_os("MIRY_PROVIDER_CREDENTIAL_FILE")
                .ok_or("OFFICIAL: complete credential file required")?;
            let input =
                fs::canonicalize(input).map_err(|_| "OFFICIAL: credential file unavailable")?;
            if !external(&root, &source)
                || !target.starts_with(&root)
                || !output.starts_with(&target)
                || !input.starts_with(&root)
            {
                return Err("OFFICIAL: credentials and target must be inside an external isolated build root");
            }
            // Only paths are recorded by Cargo; secret values are never environment inputs.
            let input_text = input.to_str().ok_or("OFFICIAL: invalid input path")?;
            if input_text.contains(['\r', '\n']) {
                return Err("OFFICIAL: invalid input path");
            }
            println!("cargo:rerun-if-changed={input_text}");
            let mut bytes = Vec::new();
            fs::File::open(input)
                .map_err(|_| "OFFICIAL: credential read failed")?
                .take(8193)
                .read_to_end(&mut bytes)
                .map_err(|_| "OFFICIAL: credential read failed")?;
            if bytes.len() > 8192 {
                return Err("OFFICIAL: credential input too large");
            }
            Some(parse(&bytes)?)
        }
        _ => return Err("Provider: build mode must be PUBLIC or OFFICIAL"),
    };
    let generated = module(identity.as_ref());
    let path = out.join("provider_identity.rs");
    fs::write(&path, generated.as_bytes()).map_err(|_| "Provider: identity injection failed")?;
    if fs::read(&path).map_err(|_| "Provider: identity verification failed")?
        != generated.as_bytes()
    {
        return Err("Provider: identity verification failed");
    }
    if identity.is_some() {
        println!("cargo:rustc-cfg=miry_official");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_inputs_fail_without_values() {
        for input in [
            b"{}".as_slice(),
            br#"{"appId":"bad id","appSecret":"synthetic-only"}"#,
            br#"{"appId":"test","appSecret":"short"}"#,
            br#"{"appId":"test","appSecret":"        "}"#,
            br#"{"appId":"test","appSecret":"synthetic-only","extra":true}"#,
        ] {
            let error = parse(input).err().unwrap();
            assert!(!error.contains("synthetic-only"));
        }
    }
    #[test]
    fn generated_public_module_contains_no_identity() {
        let public = module(None);
        assert!(public.contains("None"));
        assert!(!public.contains("Some(("));
        let identity = parse(br#"{"appId":"synthetic","appSecret":"synthetic-only"}"#).unwrap();
        assert!(module(Some(&identity)).contains("Some(("));
    }
    #[test]
    fn isolation_rejects_source_and_ancestors() {
        let source = std::env::current_dir().unwrap();
        assert!(!external(&source, &source));
        assert!(!external(&source.join("target"), &source));
        assert!(!external(source.parent().unwrap(), &source));
        assert!(!external(Path::new("relative"), &source));
    }
}
