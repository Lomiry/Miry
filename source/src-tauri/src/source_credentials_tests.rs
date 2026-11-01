use super::*;
pub struct Fixture(pub PathBuf);
impl Fixture {
    pub fn new() -> Self {
        Self(std::env::temp_dir().join(format!("miry-source-vault-test-{}", uuid::Uuid::new_v4())))
    }
    pub fn store(&self) -> Store {
        Store(self.0.clone())
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        assert!(self.0.parent() == Some(std::env::temp_dir().as_path()));
        assert!(self
            .0
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("miry-source-vault-test-"));
        let _ = fs::remove_dir_all(&self.0);
    }
}
#[test]
fn current_user_dpapi_survives_reopen_replaces_and_removes_without_plaintext() {
    let root = Fixture::new();
    let store = root.store();
    let token = uuid::Uuid::new_v4().to_string();
    store
        .save("source", "https://example.invalid/".into(), token.clone())
        .unwrap();
    let raw = fs::read(store.file("source")).unwrap();
    assert!(!raw.windows(token.len()).any(|w| w == token.as_bytes()));
    assert!(!raw.windows(8).any(|w| w == b"endpoint"));
    assert!(root
        .store()
        .load("source")
        .unwrap()
        .is_some_and(|v| v.token == token));
    let next = uuid::Uuid::new_v4().to_string();
    store
        .save("source", "https://example.invalid/".into(), next.clone())
        .unwrap();
    assert!(root
        .store()
        .load("source")
        .unwrap()
        .is_some_and(|v| v.token == next));
    assert!(store.previous("source").exists());
    store.remove("source").unwrap();
    assert!(store.load("source").unwrap().is_none());
    assert!(!store.previous("source").exists());
}
#[test]
fn corrupted_ciphertext_fails_closed_and_explicit_replacement_preserves_backup() {
    let root = Fixture::new();
    let store = root.store();
    secure_directory(&root.0).unwrap();
    let corrupt = uuid::Uuid::new_v4().as_bytes().to_vec();
    fs::write(store.file("source"), &corrupt).unwrap();
    assert!(matches!(store.load("source"), Err("credential-read")));
    assert!(fs::read(store.file("source")).unwrap() == corrupt);
    store
        .save(
            "source",
            "https://example.invalid/".into(),
            uuid::Uuid::new_v4().to_string(),
        )
        .unwrap();
    assert!(fs::read(store.previous("source")).unwrap() == corrupt);
    assert!(store.load("source").unwrap().is_some());
}
#[test]
fn encrypted_source_identity_and_snapshot_rollback_are_enforced() {
    let root = Fixture::new();
    let store = root.store();
    let token = uuid::Uuid::new_v4().to_string();
    store
        .save("first", "https://example.invalid/".into(), token.clone())
        .unwrap();
    let snapshot = store.snapshot("first").unwrap();
    fs::copy(store.file("first"), store.file("second")).unwrap();
    assert!(matches!(store.load("second"), Err("credential-read")));
    store
        .save(
            "first",
            "https://example.invalid/".into(),
            uuid::Uuid::new_v4().to_string(),
        )
        .unwrap();
    store.restore("first", &snapshot).unwrap();
    assert!(store
        .load("first")
        .unwrap()
        .is_some_and(|v| v.token == token));
    assert!(!store.previous("first").exists());
}
#[test]
fn unwritable_path_and_oversized_file_fail_without_success_or_token_errors() {
    let root = Fixture::new();
    fs::create_dir_all(&root.0).unwrap();
    let blocker = root.0.join("not-a-directory");
    fs::write(&blocker, []).unwrap();
    let token = uuid::Uuid::new_v4().to_string();
    let error = Store(blocker)
        .save("source", "https://example.invalid/".into(), token.clone())
        .unwrap_err();
    assert!(!error.contains(&token));
    let store = root.store();
    fs::write(store.file("source"), vec![0; LIMIT as usize + 1]).unwrap();
    assert!(matches!(store.load("source"), Err("credential-read")));
}
#[test]
fn a_fresh_native_process_reads_current_user_ciphertext() {
    let root = Fixture::new();
    let store = root.store();
    let token = uuid::Uuid::new_v4().to_string();
    store
        .save("restart", "https://example.invalid/".into(), token.clone())
        .unwrap();
    let child = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "source_credentials::tests::child_read_fixture",
            "--nocapture",
        ])
        .env("MIRY_TEST_VAULT_DIRECTORY", &root.0)
        .env(
            "MIRY_TEST_VAULT_DIGEST",
            format!("{:x}", Sha256::digest(token.as_bytes())),
        )
        .output()
        .unwrap();
    assert!(
        child.status.success(),
        "isolated child verification failed (output withheld)"
    );
}
#[test]
fn child_read_fixture() {
    let Some(root) = std::env::var_os("MIRY_TEST_VAULT_DIRECTORY") else {
        return;
    };
    let root = PathBuf::from(root);
    assert!(root.parent() == Some(std::env::temp_dir().as_path()));
    assert!(root
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("miry-source-vault-test-"));
    let binding = Store(root).load("restart").unwrap().unwrap();
    assert!(
        format!("{:x}", Sha256::digest(binding.token.as_bytes()))
            == std::env::var("MIRY_TEST_VAULT_DIGEST").unwrap()
    );
}
#[test]
fn directory_dacl_is_protected_and_excludes_other_user_groups() {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Authorization::{
            ConvertSecurityDescriptorToStringSecurityDescriptorW, GetNamedSecurityInfoW,
            SE_FILE_OBJECT,
        },
        Security::DACL_SECURITY_INFORMATION,
    };
    let root = Fixture::new();
    secure_directory(&root.0).unwrap();
    let mut descriptor = std::ptr::null_mut();
    let code = unsafe {
        GetNamedSecurityInfoW(
            wide(&root.0).as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut descriptor,
        )
    };
    assert!(code == 0);
    let mut text = std::ptr::null_mut();
    assert!(
        unsafe {
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                descriptor,
                1,
                DACL_SECURITY_INFORMATION,
                &mut text,
                std::ptr::null_mut(),
            )
        } != 0
    );
    let sddl = unsafe {
        let mut n = 0;
        while *text.add(n) != 0 {
            n += 1;
        }
        let s = String::from_utf16_lossy(std::slice::from_raw_parts(text, n));
        LocalFree(text.cast());
        LocalFree(descriptor);
        s
    };
    assert!(sddl.starts_with("D:P"));
    assert!(sddl.contains(&current_sid().unwrap()));
    assert!(sddl.matches("(A;").count() == 2);
    assert!(!sddl.contains(";;;WD)") && !sddl.contains(";;;BU)"));
}
