# P2-G3 rustls-webpki 0.103.15 NOTICE staging

This is Miry's scoped index, not an upstream NOTICE or replacement license.
rustls-webpki is ISC, not ring's Apache-2.0 AND ISC expression.
Root ISC copyright: Copyright 2015 Brian Smith.
Preserve the original per-file Daniel McCarney / Rafael Fernández López and
Brian Smith notices below, including permission conditions and disclaimers.

Source: https://static.crates.io/crates/rustls-webpki/rustls-webpki-0.103.15.crate
Repository: https://github.com/rustls/webpki
Tag: v/0.103.15; commit c14836d8de33c0ad0ac7dcb28fe9aade20831a4d

Chromium scope: the crate omits third-party/chromium/ but includes explicitly
adapted test cases in dns_name.rs and test-data references in alg_tests.rs.
Identified test users are excluded by cfg(test) in normal library builds.
The unchanged upstream Chromium BSD-3-Clause license is retained conservatively
for source/test attribution; no runtime Chromium library inclusion is asserted.
This is not an unqualified NOT APPLICABLE exception or a final linker proof.

FINAL LINKAGE NOT VERIFIED / CURRENT INSTALLER INCLUSION NOT VERIFIED
G4-G6, P3-P5 and unified B1/G1/G2/G3 integration remain outside this task.
No official EXE/NSIS was built. Existing installer has not gained these files.
Future install-relative path: tools/mpv/licenses/rust/rustls-webpki-0.103.15/.

| Original scope/member(s) | Resource | SPDX | Bytes | SHA256 |
|---|---|---|---:|---|
| `LICENSE` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/LICENSE` | ISC | 916 | `5b698ca13897be3afdb7174256fa1574f8c6892b8bea1a66dd6469d3fe27885a` |
| `src/alg_tests.rs; src/cert.rs; src/der.rs; src/error.rs; src/lib.rs; src/ring_algs.rs; src/signed_data.rs; src/verify_cert.rs; src/x509.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/alg_tests.rs.notice.txt` | ISC | 764 | `b4c8c14a93fa9a7408aca93815780d925ac1fca8d40972271aa1182d084cfefb` |
| `src/crl/mod.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/crl/mod.rs.notice.txt` | ISC | 768 | `9ef9c18e5cee19599fa2cd605674497ec7c7a702ebbb8310903cb60c540d5c39` |
| `src/end_entity.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/end_entity.rs.notice.txt` | ISC | 769 | `baf9e2a528dd5202334bb6cd06c145b3c7c7c91f3fab874f39c9321d2e51ae07` |
| `src/subject_name/dns_name.rs; src/subject_name/ip_address.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/dns_name.rs.notice.txt` | ISC | 769 | `901ceddbd2aef755f41bd82c512e3cf9382d912a70342f77eff003df2dec67b5` |
| `src/subject_name/mod.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/mod.rs.notice.txt` | ISC | 777 | `46d267f8d09e95af7e4bdcdcc501458474e5ca4115a4de94c0db8083dff1f17a` |
| `src/time.rs` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/embedded-notices/src/time.rs.notice.txt` | ISC | 769 | `7abd9b6960dcf7d4d0a48606a5b71bfe37d472db68d70637f3a58a56785f1621` |
| `upstream third-party/chromium/LICENSE (source/test attribution)` | `tools/mpv/licenses/rust/rustls-webpki-0.103.15/upstream-exceptions/third-party/chromium/LICENSE` | BSD-3-Clause | 1559 | `845022e0c1db1abb41a6ba4cd3c4b674ec290f3359d9d3c78ae558d4c0ed9308` |
