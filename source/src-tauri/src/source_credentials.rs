//! Per-source, CurrentUser DPAPI storage. No plaintext or paths leave this module.
use serde::{Deserialize, Serialize};
#[cfg(all(test, windows))]
#[path = "source_credentials_tests.rs"]
pub(crate) mod tests;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub type Result<T> = std::result::Result<T, &'static str>;
const LIMIT: u64 = 16 * 1024;
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    version: u8,
    source: String,
    pub endpoint: String,
    pub token: String,
}
pub struct Snapshot {
    primary: Option<Vec<u8>>,
    previous: Option<Vec<u8>>,
}
pub struct Store(pub PathBuf);
impl Store {
    fn file(&self, id: &str) -> PathBuf {
        self.0
            .join(format!("{:x}.dpapi", Sha256::digest(id.as_bytes())))
    }
    fn previous(&self, id: &str) -> PathBuf {
        self.file(id).with_extension("previous.dpapi")
    }
    pub fn snapshot(&self, id: &str) -> Result<Snapshot> {
        Ok(Snapshot {
            primary: read(&self.file(id))?,
            previous: read(&self.previous(id))?,
        })
    }
    pub fn load(&self, id: &str) -> Result<Option<Binding>> {
        let Some(bytes) = read(&self.file(id))? else {
            return Ok(None);
        };
        let mut plain = unprotect(&bytes)?;
        let decoded = serde_json::from_slice::<Binding>(&plain).map_err(|_| "credential-read");
        plain.fill(0);
        let binding = decoded?;
        if binding.version != 1
            || binding.source != id
            || binding.token.is_empty()
            || binding.token.len() > 512
        {
            return Err("credential-read");
        }
        Ok(Some(binding))
    }
    pub fn save(&self, id: &str, endpoint: String, token: String) -> Result<()> {
        let mut plain = serde_json::to_vec(&Binding {
            version: 1,
            source: id.into(),
            endpoint,
            token,
        })
        .map_err(|_| "credential-encrypt")?;
        let encrypted = protect(&plain);
        plain.fill(0);
        let encrypted = encrypted?;
        secure_directory(&self.0)?;
        // Keep one ciphertext recovery copy, never auto-use a potentially revoked key.
        if let Some(old) = read(&self.file(id))? {
            atomic_write(&self.previous(id), &old)?;
        }
        atomic_write(&self.file(id), &encrypted)
    }
    pub fn remove(&self, id: &str) -> Result<()> {
        remove(&self.file(id))?;
        remove(&self.previous(id))
    }
    pub fn restore(&self, id: &str, snapshot: &Snapshot) -> Result<()> {
        for (path, bytes) in [
            (self.file(id), &snapshot.primary),
            (self.previous(id), &snapshot.previous),
        ] {
            if let Some(bytes) = bytes {
                secure_directory(&self.0)?;
                atomic_write(&path, bytes)?;
            } else {
                remove(&path)?;
            }
        }
        Ok(())
    }
}
fn read(path: &Path) -> Result<Option<Vec<u8>>> {
    match fs::symlink_metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("credential-read"),
        Ok(meta) => {
            if !meta.is_file() || meta.len() > LIMIT || reparse(&meta) {
                return Err("credential-read");
            }
            fs::read(path).map(Some).map_err(|_| "credential-read")
        }
    }
}
fn remove(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("credential-write"),
    }
}
#[cfg(windows)]
fn reparse(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & 0x400 != 0
}
#[cfg(not(windows))]
fn reparse(meta: &fs::Metadata) -> bool {
    meta.file_type().is_symlink()
}

#[cfg(windows)]
fn wide(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}
#[cfg(windows)]
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let write = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "credential-write")?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "credential-write")?;
        drop(file);
        // Same directory/volume: publish only complete ciphertext, preserving old data on error.
        if unsafe {
            MoveFileExW(
                wide(&temporary).as_ptr(),
                wide(path).as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        } == 0
        {
            return Err("credential-write");
        }
        Ok(())
    })();
    let _ = fs::remove_file(&temporary);
    write
}
#[cfg(windows)]
fn crypt(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // Deliberately never set CRYPTPROTECT_LOCAL_MACHINE. No UI or roaming input.
    let ok = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if ok == 0 {
        return Err(if encrypt {
            "credential-encrypt"
        } else {
            "credential-read"
        });
    }
    let result = unsafe {
        let allocated = std::slice::from_raw_parts_mut(output.pbData, output.cbData as usize);
        let result = allocated.to_vec();
        allocated.fill(0);
        LocalFree(output.pbData.cast());
        result
    };
    Ok(result)
}
#[cfg(windows)]
fn protect(bytes: &[u8]) -> Result<Vec<u8>> {
    crypt(bytes, true)
}
#[cfg(windows)]
fn unprotect(bytes: &[u8]) -> Result<Vec<u8>> {
    crypt(bytes, false)
}

#[cfg(windows)]
fn current_sid() -> Result<String> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, LocalFree},
        Security::Authorization::ConvertSidToStringSidW,
        Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    let mut token = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err("credential-permission");
    }
    let mut length = 0;
    unsafe { GetTokenInformation(token, TokenUser, std::ptr::null_mut(), 0, &mut length) };
    let mut data = vec![0usize; (length as usize).div_ceil(std::mem::size_of::<usize>())];
    let ok = unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            data.as_mut_ptr().cast(),
            length,
            &mut length,
        )
    };
    unsafe { CloseHandle(token) };
    if ok == 0 {
        return Err("credential-permission");
    }
    let user = unsafe { &*data.as_ptr().cast::<TOKEN_USER>() };
    let mut text = std::ptr::null_mut();
    if unsafe { ConvertSidToStringSidW(user.User.Sid, &mut text) } == 0 {
        return Err("credential-permission");
    }
    let sid = unsafe {
        let mut n = 0;
        while *text.add(n) != 0 {
            n += 1;
        }
        let sid = String::from_utf16_lossy(std::slice::from_raw_parts(text, n));
        LocalFree(text.cast());
        sid
    };
    Ok(sid)
}
#[cfg(windows)]
fn secure_directory(path: &Path) -> Result<()> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Authorization::{
            ConvertStringSecurityDescriptorToSecurityDescriptorW, SetNamedSecurityInfoW,
            SE_FILE_OBJECT,
        },
        Security::{
            GetSecurityDescriptorDacl, DACL_SECURITY_INFORMATION,
            PROTECTED_DACL_SECURITY_INFORMATION,
        },
    };
    fs::create_dir_all(path).map_err(|_| "credential-permission")?;
    if reparse(&fs::symlink_metadata(path).map_err(|_| "credential-permission")?) {
        return Err("credential-permission");
    }
    let sddl: Vec<u16> = format!("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;{})", current_sid()?)
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let mut descriptor = std::ptr::null_mut();
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            1,
            &mut descriptor,
            std::ptr::null_mut(),
        )
    } == 0
    {
        return Err("credential-permission");
    }
    let (mut present, mut defaulted) = (0, 0);
    let mut dacl = std::ptr::null_mut();
    let ok =
        unsafe { GetSecurityDescriptorDacl(descriptor, &mut present, &mut dacl, &mut defaulted) };
    let code = if ok != 0 && present != 0 && !dacl.is_null() {
        unsafe {
            SetNamedSecurityInfoW(
                wide(path).as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                dacl,
                std::ptr::null_mut(),
            )
        }
    } else {
        1
    };
    unsafe { LocalFree(descriptor) };
    if code != 0 {
        return Err("credential-permission");
    }
    Ok(())
}
#[cfg(not(windows))]
fn protect(_: &[u8]) -> Result<Vec<u8>> {
    Err("credential-platform")
}
#[cfg(not(windows))]
fn unprotect(_: &[u8]) -> Result<Vec<u8>> {
    Err("credential-platform")
}
#[cfg(not(windows))]
fn secure_directory(_: &Path) -> Result<()> {
    Err("credential-platform")
}
#[cfg(not(windows))]
fn atomic_write(_: &Path, _: &[u8]) -> Result<()> {
    Err("credential-platform")
}
