# Miry v1.0.6 — unified third-party notice staging index

Scope: B1 and P2 G1–G6 only. This is an index to preserved original texts, not a replacement for them and not a complete application dependency inventory.

**SOURCE INTEGRATED / BUNDLE PATH ELIGIBLE**. Installer content, final linkage and normal installed-user visibility are **NOT VERIFIED**. No installer was built or inspected in I2.

The structured mapping is [THIRD-PARTY-COMPONENTS.json](THIRD-PARTY-COMPONENTS.json). Paths below are relative to this directory. Keep each linked original text with its original bytes.

Source and archive values are historical reviewed receipts. I2 re-read the specified review ZIPs and Git text blobs, not upstream source archives or runtime DLLs. QA receipt paths in the structured mapping are reviewer provenance; they are not installed-user source distribution promises.

The existing v1.0.1 source-part names and same-Release wording in the older parent notice are historical. They do not establish a v1.0.6 public source endpoint. P5 remains open.

The two WebView2 Rust crates share one Bill Avery MIT text. Microsoft SDK/Loader/Runtime authorization is a separate P3 review. ring keeps Apache-2.0 AND ISC and its independently authored third-party statements. Chromium is a conservative source/test exception for webpki, not verified production Chromium linkage. tao retains Apache-2.0 with the scoped W3C Key/KeyCode exception.

LERC Esri NOTICE identifies US patent 9,002,126 and Apache clause 3. LERC and AMR freedom to operate are NOT ASSESSED / LEGAL REVIEW REQUIRED. The AMR patent disclaimer is not a patent-rights grant. No unrestricted patent clearance is claimed.

## libass@0.17.5

Group: B1; license: ISC.

Runtime DLL mapping: `libass-9.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: NOT ASSESSED beyond reviewed notice staging.

Original texts:

- [libass/COPYING](libass/COPYING) — 755 bytes; SHA256 `f7e30699d02798351e7f839e3d3bfeb29ce65e44efa7735c225464c4fd7dfe9c`; copyright_license_disclaimer.

## libvorbis@1.3.7

Group: B1; license: BSD-3-Clause.

Runtime DLL mapping: `libvorbis-0.dll`, `libvorbisenc-2.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: NOT ASSESSED beyond reviewed notice staging.

Original texts:

- [libvorbis/COPYING](libvorbis/COPYING) — 1470 bytes; SHA256 `ec1815db59fcd302846df949d7424876cb2e2dc5ed1606c5fb0b36787b1cf43a`; copyright_license_disclaimer.

## libtheora@1.2.0

Group: B1; license: BSD-3-Clause.

Runtime DLL mapping: `libtheoradec-2.dll`, `libtheoraenc-2.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: PATENT APPLICABILITY NOT VERIFIED.

Original texts:

- [libtheora/COPYING](libtheora/COPYING) — 1470 bytes; SHA256 `8417fad7da775735564e209484a2e011e0fa201e94f01fdbee6e4977e478e6fc`; copyright_license_disclaimer.
- [libtheora/LICENSE](libtheora/LICENSE) — 960 bytes; SHA256 `2c902950c73a63cd285dc0c36573de9c5fefe66d49312949c51d941f33e92932`; patent_statement.

## libvpx@1.17.0

Group: B1; license: BSD-3-Clause.

Runtime DLL mapping: `libvpx-1.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: PATENT APPLICABILITY NOT VERIFIED.

Original texts:

- [libvpx/LICENSE](libvpx/LICENSE) — 1537 bytes; SHA256 `8267348d5af1262c11d1a08de2f5afc77457755f1ac658627dd9acf71011d615`; copyright_license_disclaimer.
- [libvpx/PATENTS](libvpx/PATENTS) — 1436 bytes; SHA256 `cc3273e0694ea5896145e0677699b53471b03ea43021ddc50e7923fbb9f5023c`; patent_statement.

## webview2-com@0.39.1

Group: G1; license: MIT.

Runtime DLL mapping: Rust dependency record; final retained code NOT VERIFIED.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: P3 OUT OF I2 SCOPE.

Original texts:

- [rust/webview2-rs-0.39.1/LICENSE](rust/webview2-rs-0.39.1/LICENSE) — 1067 bytes; SHA256 `0dcf41516e608bbcb6cdc5229feb7b86fe4a643b85e7df251133c93408fdac73`; copyright_license_disclaimer.

## webview2-com-sys@0.39.1

Group: G1; license: MIT.

Runtime DLL mapping: Rust dependency record; final retained code NOT VERIFIED.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: P3 OUT OF I2 SCOPE.

Original texts:

- [rust/webview2-rs-0.39.1/LICENSE](rust/webview2-rs-0.39.1/LICENSE) — 1067 bytes; SHA256 `0dcf41516e608bbcb6cdc5229feb7b86fe4a643b85e7df251133c93408fdac73`; copyright_license_disclaimer.

## ring@0.17.14

Group: G2; license: Apache-2.0 AND ISC.

Runtime DLL mapping: Rust dependency record; final retained code NOT VERIFIED.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: NOT ASSESSED beyond reviewed notice staging.

Original texts:

- [rust/ring-0.17.14/LICENSE](rust/ring-0.17.14/LICENSE) — 499 bytes; SHA256 `b3d734001a94efff3579978d953391aa7115f877657d25eb54037a43875d078a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/LICENSE-BoringSSL](rust/ring-0.17.14/LICENSE-BoringSSL) — 14870 bytes; SHA256 `005fc765ddc5115da796cca915baa9557abae13ff35e0a47c47affc56f6c414d`; copyright_license_disclaimer.
- [rust/ring-0.17.14/LICENSE-other-bits](rust/ring-0.17.14/LICENSE-other-bits) — 731 bytes; SHA256 `f025ccfb7dfb6bdfedc75ca0f67acc69e6fb4998143d834f7c2f38a29989680f`; copyright_license_disclaimer.
- [rust/ring-0.17.14/src/polyfill/once_cell/LICENSE-APACHE](rust/ring-0.17.14/src/polyfill/once_cell/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`; copyright_license_disclaimer.
- [rust/ring-0.17.14/src/polyfill/once_cell/LICENSE-MIT](rust/ring-0.17.14/src/polyfill/once_cell/LICENSE-MIT) — 1022 bytes; SHA256 `6ee2ed6c77710de911761acd5fc1ad1da00f476beb1a7ef27e78c2d1858deafc`; copyright_license_disclaimer.
- [rust/ring-0.17.14/third_party/fiat/LICENSE](rust/ring-0.17.14/third_party/fiat/LICENSE) — 638 bytes; SHA256 `9eacbcb81be660840c714a560a9d65ba07913db98dd4baf969f78dd499fdd60f`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-armv4.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-armv4.pl.notice.txt) — 954 bytes; SHA256 `691b11e28f1ae5bc5cb68858779032c6ed3420279383c4a1f3f0649c06199357`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-armv8.pl.notice.txt) — 950 bytes; SHA256 `40872dc16a3e4418815dcdb9d55248e5033c69e639c0c7d9fd4b930f283ae548`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-x86.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-x86.pl.notice.txt) — 951 bytes; SHA256 `1adc8dacf22e9f08f763dfc68bb97b72008df22388819deaa8ffb9d5b90858ac`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/chacha/asm/chacha-x86_64.pl.notice.txt) — 1000 bytes; SHA256 `0a5109f96707cd549baae8a589424af16cf4b57b6f75ea9746cff7ddf779a50a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/cipher/asm/chacha20_poly1305_armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/cipher/asm/chacha20_poly1305_armv8.pl.notice.txt) — 606 bytes; SHA256 `cd3feeeda087b00383aa1a6d16bf7ef1fdfd84389a7640e41280df869c78eeec`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/cipher/asm/chacha20_poly1305_x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/cipher/asm/chacha20_poly1305_x86_64.pl.notice.txt) — 606 bytes; SHA256 `7bd88e1cb21f1463fc6d859d78314099fe3caecb7f7f0659641b2ff3b0d165ca`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/constant_time_test.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/constant_time_test.c.notice.txt) — 632 bytes; SHA256 `0794c420cea59bf58084d3d65f56c5ad92b089bdd870684b253124c185a71f15`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/cpu_intel.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/cpu_intel.c.notice.txt) — 632 bytes; SHA256 `e5df1a1e4be22b4b24531ad846438cb23883f0c98bb97d35158a113a411c503e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/crypto.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/crypto.c.notice.txt) — 599 bytes; SHA256 `388358f4a097d89594c39cc7b2cd475e517f6cb5f26216d81157bbf1c5dfca7d`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/curve25519/asm/x25519-asm-arm.S.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/curve25519/asm/x25519-asm-arm.S.notice.txt) — 863 bytes; SHA256 `6ec13dc27f5e5801b110d26a05c589fb9312e3581d98a5354fca8bf3e216aacc`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519.c.notice.txt) — 979 bytes; SHA256 `da1e1f288bc39ad27dc6775f03df49c440c3dec2111d255b4d10194626bda01f`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519_64_adx.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519_64_adx.c.notice.txt) — 599 bytes; SHA256 `86c60ce1d1aad14ef0d9f1d6f056dc640ff9c030f91f627a50eef66728eed29b`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519_tables.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/curve25519/curve25519_tables.h.notice.txt) — 687 bytes; SHA256 `d48ee1c19e5814d829c5fb05b8ddf677a5efc418451d4b85bf4f6e167bffa4b0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/curve25519/internal.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/curve25519/internal.h.notice.txt) — 599 bytes; SHA256 `16256ab70fb55a0f1383aa505862651ead7e380d81a592d5496e5304d031b15b`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/aes_nohw.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/aes_nohw.c.notice.txt) — 770 bytes; SHA256 `f7e8b07af5dbeb50435a8283b617a329028a042217132bde21658d8896bac6fd`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aes-gcm-avx2-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aes-gcm-avx2-x86_64.pl.notice.txt) — 608 bytes; SHA256 `e9774ca13624f8d40477caf1e9c4a98866ab7729dd75b79329b3404f8f871053`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-gcm-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-gcm-x86_64.pl.notice.txt) — 2143 bytes; SHA256 `47e3a3eb31aedf1f920e4c6778c964224d0d1fb54837a1257324c856454aaf7b`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-x86.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-x86.pl.notice.txt) — 1479 bytes; SHA256 `67775536dfb8213de72645e3544425cdb94c18e944b7aa0e7d00eac66122060e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesni-x86_64.pl.notice.txt) — 1590 bytes; SHA256 `ec7c7b7f958c082674a86e41f69b19c2d283a7a33e5880f5651b0316520acf42`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesv8-armx.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesv8-armx.pl.notice.txt) — 1712 bytes; SHA256 `7735e9f25aea03412bcf4bf62143657f8f7ea6c043757d3621b62ab95d4085de`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesv8-gcm-armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/aesv8-gcm-armv8.pl.notice.txt) — 600 bytes; SHA256 `2ebd0d325b73fe195668d13834078d274d69d3c867c5be392115cbfb9cc664b8`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/bsaes-armv7.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/bsaes-armv7.pl.notice.txt) — 2158 bytes; SHA256 `db79dccc333c1fb05669266200953dc1670eb9de723d10d9f2b0c5dd3aa793ed`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-armv4.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-armv4.pl.notice.txt) — 3774 bytes; SHA256 `04d068434f5c0101d6a35d0661183e6e3d88898810428eec6d6bf98da29d5dda`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-neon-armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-neon-armv8.pl.notice.txt) — 2451 bytes; SHA256 `9feb7dda07fd83c2bfa56edfa154197e5e5c645064db773f8dc28046bb0d193e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-x86.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-x86.pl.notice.txt) — 1475 bytes; SHA256 `b16a8ff7743213dea5fcb9b3a48fbf8ca868517b77fefc5cd9dcd79ce5691f18`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghash-x86_64.pl.notice.txt) — 1338 bytes; SHA256 `ddaac6f7ae8d90e1674c19864ddbc5d3059a5a101b655c19571e0b7e1378386e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghashv8-armx.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/ghashv8-armx.pl.notice.txt) — 1473 bytes; SHA256 `c1f9a526bf05e1c15f7a1f28895f1de36aa3447df39486126be26257012b0fcf`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-armv7.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-armv7.pl.notice.txt) — 640 bytes; SHA256 `e8f9f0245cb25739da34251afe4411e3345cef45b31170975566f7d1a0313f9a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-armv8.pl.notice.txt) — 640 bytes; SHA256 `e8f9f0245cb25739da34251afe4411e3345cef45b31170975566f7d1a0313f9a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-x86.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-x86.pl.notice.txt) — 640 bytes; SHA256 `a98a833c8cffcc1173979ce879df0ae91cd59e60c5520fa6b4949da83674f221`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/aes/asm/vpaes-x86_64.pl.notice.txt) — 640 bytes; SHA256 `a98a833c8cffcc1173979ce879df0ae91cd59e60c5520fa6b4949da83674f221`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/armv4-mont.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/armv4-mont.pl.notice.txt) — 2751 bytes; SHA256 `fcdfd32ecf56972ffbb7c66dc19701af95dedcd68db6201b7637416fb902d1d5`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/armv8-mont.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/armv8-mont.pl.notice.txt) — 2212 bytes; SHA256 `c38d14c641f8db33740166886255b271a94e35faca477f3c0c35dac0f41ceadc`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86-mont.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86-mont.pl.notice.txt) — 1752 bytes; SHA256 `e30135bd5d89fd56ffc53a3eadf8101b6147474457ff8c5c3dd6cb35cd83a241`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86_64-mont.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86_64-mont.pl.notice.txt) — 2021 bytes; SHA256 `b5e9f2b2e9b32f1b23259494cd3fc465537d2c62fa02e04a3df1d79f5a354d03`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86_64-mont5.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/asm/x86_64-mont5.pl.notice.txt) — 1573 bytes; SHA256 `abc159efa898cadacc657d17d559dbfc72bd801e7197e8e7c56d6f9eed0880b4`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/internal.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/internal.h.notice.txt) — 706 bytes; SHA256 `f126e3944c1566ef9983c6813f8fad671750e36edc82d409eb517832541a3b5a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/montgomery.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/montgomery.c.notice.txt) — 632 bytes; SHA256 `e5df1a1e4be22b4b24531ad846438cb23883f0c98bb97d35158a113a411c503e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/montgomery_inv.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/bn/montgomery_inv.c.notice.txt) — 766 bytes; SHA256 `82351809670eeb513c66903839555074cb6b86ab9049f399155aa9d2e96e502c`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/asm/p256-armv8-asm.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/asm/p256-armv8-asm.pl.notice.txt) — 1018 bytes; SHA256 `e973fb7b2b420ef555903c87b496bb2ae96b94e8181adc633eda3856e9bc7547`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/asm/p256-x86_64-asm.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/asm/p256-x86_64-asm.pl.notice.txt) — 1118 bytes; SHA256 `24227d22915d5d19067d1d6b6e6e15efeee1fcc8babcb989ce21130e00094df4`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz.c.notice.txt) — 777 bytes; SHA256 `a17cb5362d8fb958f29dfa2d7e9764b75672523acca6421b57678400305d58d0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz.h.notice.txt) — 770 bytes; SHA256 `5dd6bae8b7ee15b1234a4ec7c01d9413e050cb1102e52e4ccae8de26ef63e2aa`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz384.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/ecp_nistz384.h.notice.txt) — 777 bytes; SHA256 `a17cb5362d8fb958f29dfa2d7e9764b75672523acca6421b57678400305d58d0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/gfp_p256.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/gfp_p256.c.notice.txt) — 766 bytes; SHA256 `82351809670eeb513c66903839555074cb6b86ab9049f399155aa9d2e96e502c`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/gfp_p384.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/gfp_p384.c.notice.txt) — 766 bytes; SHA256 `82351809670eeb513c66903839555074cb6b86ab9049f399155aa9d2e96e502c`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz-table.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz-table.h.notice.txt) — 1511 bytes; SHA256 `c0084f5a16a2aa53ec6c8d94363baf5ec977384aae1952aed25607ff4b771d0e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz.c.notice.txt) — 1005 bytes; SHA256 `696cc66cf72629283bd8169f2f1f57761347846fbf4713d38359c36faee431a0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256-nistz.h.notice.txt) — 1005 bytes; SHA256 `696cc66cf72629283bd8169f2f1f57761347846fbf4713d38359c36faee431a0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256.c.notice.txt) — 800 bytes; SHA256 `46ce1664b431421fb8c3904cc8a4bdea5d0c0b83d77478d030220635c7516111`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256_shared.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256_shared.h.notice.txt) — 1005 bytes; SHA256 `696cc66cf72629283bd8169f2f1f57761347846fbf4713d38359c36faee431a0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256_table.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/p256_table.h.notice.txt) — 2081 bytes; SHA256 `78d2ef7f29e5ca1e10b81e7506fb20d22a81910d55ac8f2e3b01d9e5c5888df2`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/util.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/ec/util.h.notice.txt) — 599 bytes; SHA256 `8ca246cb5c323120e25c3ff9a3f8fe4de715c71441add4353b34116a494edccd`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha256-armv4.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha256-armv4.pl.notice.txt) — 1773 bytes; SHA256 `dd0121a1e1e4b6bb0f0fa738c9d58a3e6a6cb2fbe81cc7388d659d97d1b457c3`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-armv4.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-armv4.pl.notice.txt) — 2290 bytes; SHA256 `3075d8ebc555bdb86e733781011ea64ccf136cfe56b62d325a9c756f73257f11`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-armv8.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-armv8.pl.notice.txt) — 1005 bytes; SHA256 `21ef5ee2f055fc85f5aeacc18fe6228600ece50990ab93e50100d92b0afa3be6`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-x86_64.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/fipsmodule/sha/asm/sha512-x86_64.pl.notice.txt) — 4349 bytes; SHA256 `2a72ae1cd3daa3ce84b93a1ffaf474aab830298785d48521ec1b84a32a7b1f8f`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/internal.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/internal.h.notice.txt) — 632 bytes; SHA256 `e5df1a1e4be22b4b24531ad846438cb23883f0c98bb97d35158a113a411c503e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/limbs/limbs.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/limbs/limbs.c.notice.txt) — 771 bytes; SHA256 `025964b32a1f78d01558ec7800a3fde18acef43427d35641a22bba705d699f2d`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/limbs/limbs.h.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/limbs/limbs.h.notice.txt) — 766 bytes; SHA256 `82351809670eeb513c66903839555074cb6b86ab9049f399155aa9d2e96e502c`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/mem.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/mem.c.notice.txt) — 632 bytes; SHA256 `e5df1a1e4be22b4b24531ad846438cb23883f0c98bb97d35158a113a411c503e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/perlasm/arm-xlate.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/perlasm/arm-xlate.pl.notice.txt) — 640 bytes; SHA256 `e8f9f0245cb25739da34251afe4411e3345cef45b31170975566f7d1a0313f9a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86_64-xlate.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86_64-xlate.pl.notice.txt) — 3389 bytes; SHA256 `ca102f706607bf0d9b60a13cb02cd70b75d3d30d861d40e11f84bd0b8819bba8`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86asm.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86asm.pl.notice.txt) — 770 bytes; SHA256 `d8aa6a4651c6d8cf1b864501613d801a9450b47ede08ef7b56317f2a789c6730`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86gas.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86gas.pl.notice.txt) — 640 bytes; SHA256 `3ef15f79d7863560863fd4c6d14ff2597ca34d83a01100b1d1b4f67ca1f2619d`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86nasm.pl.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/perlasm/x86nasm.pl.notice.txt) — 640 bytes; SHA256 `bd63cf39ad5653167c25c869a2d4ca71dd5ff4964bbf3cb276aa9f3b8790253f`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/poly1305/poly1305.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/poly1305/poly1305.c.notice.txt) — 909 bytes; SHA256 `9bd0fc94c635f554d804cbda023db5573beb25aff01fcec3ad7bfcc2cf237f8a`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/crypto/poly1305/poly1305_arm.c.notice.txt](rust/ring-0.17.14/embedded-notices/crypto/poly1305/poly1305_arm.c.notice.txt) — 895 bytes; SHA256 `eea7725ad75a9c6320a7b36e6fe89f586bbb071ec12c409a81b69807aef69fa6`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/aes.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/aes.h.notice.txt) — 632 bytes; SHA256 `0a3a2968deee45bfbddf2bb9e7fdfee965ac86cd687af9c150a242944ae62e80`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/asm_base.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/asm_base.h.notice.txt) — 599 bytes; SHA256 `86c60ce1d1aad14ef0d9f1d6f056dc640ff9c030f91f627a50eef66728eed29b`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/base.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/base.h.notice.txt) — 632 bytes; SHA256 `a1f9499b1e8806e42ddfe0f6d94cd584127169aef60c3c3d4788f17ff7451ba0`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/check.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/check.h.notice.txt) — 763 bytes; SHA256 `99a07315c47a6c27e677a2a47e357217e12acabb89177deadae9e141696e7195`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/mem.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/mem.h.notice.txt) — 632 bytes; SHA256 `e5df1a1e4be22b4b24531ad846438cb23883f0c98bb97d35158a113a411c503e`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/target.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/target.h.notice.txt) — 599 bytes; SHA256 `86c60ce1d1aad14ef0d9f1d6f056dc640ff9c030f91f627a50eef66728eed29b`; copyright_license_disclaimer.
- [rust/ring-0.17.14/embedded-notices/include/ring-core/type_check.h.notice.txt](rust/ring-0.17.14/embedded-notices/include/ring-core/type_check.h.notice.txt) — 632 bytes; SHA256 `2a4d2dcf0ea50fd3ee028c9b816dca5fedc8718e23d5d67735f8d21fb8637856`; copyright_license_disclaimer.

## rustls-webpki@0.103.15

Group: G3; license: ISC.

Runtime DLL mapping: Rust dependency record; final retained code NOT VERIFIED.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: NOT ASSESSED beyond reviewed notice staging.

Original exception scope: {'upstream_directory': 'VERIFIED via tag and pinned LICENSE existence', 'crate_directory': 'ABSENT: complete 28-member archive enumerated', 'copied_test_cases': 'PRESENT: dns_name.rs explicitly identifies cases adapted from Chromium', 'test_data_reference': 'PRESENT: alg_tests.rs references absent Chromium data directory', 'normal_library_cfg': 'EXCLUDED BY cfg(test) for identified adapted tests/data users', 'production_copy_evidence': 'NOT FOUND by full member text search; behavioral comparison comments alone are not copy proof', 'source_notice_scope': 'CONSERVATIVE SOURCE/TEST ATTRIBUTION', 'runtime_linkage': 'NOT VERIFIED', 'exception_license_path': 'tools/mpv/licenses/rust/rustls-webpki-0.103.15/upstream-exceptions/third-party/chromium/LICENSE', 'status': 'VERIFIED SCOPED EXCEPTION; NOT A CLAIM OF RUNTIME CHROMIUM DISTRIBUTION'}.

Original texts:

- [rust/rustls-webpki-0.103.15/LICENSE](rust/rustls-webpki-0.103.15/LICENSE) — 916 bytes; SHA256 `5b698ca13897be3afdb7174256fa1574f8c6892b8bea1a66dd6469d3fe27885a`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/alg_tests.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/alg_tests.rs.notice.txt) — 764 bytes; SHA256 `b4c8c14a93fa9a7408aca93815780d925ac1fca8d40972271aa1182d084cfefb`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/crl/mod.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/crl/mod.rs.notice.txt) — 768 bytes; SHA256 `9ef9c18e5cee19599fa2cd605674497ec7c7a702ebbb8310903cb60c540d5c39`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/end_entity.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/end_entity.rs.notice.txt) — 769 bytes; SHA256 `baf9e2a528dd5202334bb6cd06c145b3c7c7c91f3fab874f39c9321d2e51ae07`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/dns_name.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/dns_name.rs.notice.txt) — 769 bytes; SHA256 `901ceddbd2aef755f41bd82c512e3cf9382d912a70342f77eff003df2dec67b5`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/mod.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/subject_name/mod.rs.notice.txt) — 777 bytes; SHA256 `46d267f8d09e95af7e4bdcdcc501458474e5ca4115a4de94c0db8083dff1f17a`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/embedded-notices/src/time.rs.notice.txt](rust/rustls-webpki-0.103.15/embedded-notices/src/time.rs.notice.txt) — 769 bytes; SHA256 `7abd9b6960dcf7d4d0a48606a5b71bfe37d472db68d70637f3a58a56785f1621`; copyright_license_disclaimer.
- [rust/rustls-webpki-0.103.15/upstream-exceptions/third-party/chromium/LICENSE](rust/rustls-webpki-0.103.15/upstream-exceptions/third-party/chromium/LICENSE) — 1559 bytes; SHA256 `845022e0c1db1abb41a6ba4cd3c4b674ec290f3359d9d3c78ae558d4c0ed9308`; copyright_license_disclaimer.

## tao@0.37.1

Group: G4; license: Apache-2.0.

Runtime DLL mapping: Rust dependency record; final retained code NOT VERIFIED.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: NOT ASSESSED beyond reviewed notice staging.

Original exception scope: {'supplemental_spdx': 'W3C-20150513', 'scope': 'Key and KeyCode enums, their variants and documentation attached to their variants; not the entire tao crate', 'key_source_uri': 'https://www.w3.org/TR/2017/CR-uievents-key-20170601/', 'keycode_source_uri': 'https://www.w3.org/TR/2017/CR-uievents-code-20170601/', 'specification_copyright_year': 2017, 'short_notice_copyright_year': 2021, 'short_notice_legacy_uri': 'http://www.w3.org/Consortium/Legal/copyright-software', 'license_text_authority': 'exact checksum-matched crate; not a newly generated W3C template'}.

Original texts:

- [rust/tao-0.37.1/LICENSE](rust/tao-0.37.1/LICENSE) — 11323 bytes; SHA256 `6dc0e068dcf3a5bc8e054205b85b7720e1d49265bbc64bf515d2cf79197df69a`; copyright_license_disclaimer.
- [rust/tao-0.37.1/W3C-UI-EVENTS-NOTICE](rust/tao-0.37.1/W3C-UI-EVENTS-NOTICE) — 3820 bytes; SHA256 `70a5be7959b95323fad7bbe18ad2018981c0443bfbb6367fb193ef327e80df98`; copyright_license_disclaimer, W3C_full_license_and_SHORT_NOTICE.

## LERC@4.1.1

Group: G5; license: Apache-2.0.

Runtime DLL mapping: `libLerc.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: LEGAL REVIEW REQUIRED / FTO NOT ASSESSED.

Original exception scope: {'notice': 'VERIFIED', 'number': '9,002,126', 'title': 'Limited Error Raster Compression (LERC)', 'assignee': 'Esri', 'inventors': ['Maurer, Thomas', 'Gao, Peng', 'Becker, Peter'], 'copyright': 'Copyright 2015-2026 Esri', 'grant_reference': 'Apache V2.0 License Agreement, Clause 3 - Grant of Patent License', 'freedom_to_operate': 'NOT ASSESSED', 'legal_review': 'REQUIRED', 'grant_scope': 'Apache-2.0 clause 3 terms only; no unconditional or unlimited guarantee', 'historical_fields_added_to_original': False}.

Original texts:

- [mingw-w64-ucrt-x86_64-lerc/lerc/LICENSE](mingw-w64-ucrt-x86_64-lerc/lerc/LICENSE) — 9198 bytes; SHA256 `77a8b761727c75e2167b15bfdf61b2c0bcf8792271228bebe80779106ad00671`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-lerc/lerc/NOTICE](mingw-w64-ucrt-x86_64-lerc/lerc/NOTICE) — 679 bytes; SHA256 `f222a70d24e261b9b4b238df4fe9132e669d7776f137753c6cbbc5be4701124d`; copyright_notice, patent_notice.

## opencore-amr@0.1.6:AMR-NB

Group: G6; license: Apache-2.0.

Runtime DLL mapping: `libopencore-amrnb-0.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: LEGAL REVIEW REQUIRED / FTO NOT ASSESSED.

Original exception scope: {'copyright_license': 'DOCUMENTED', 'third_party_patent_freedom_to_operate': 'NOT ASSESSED', 'legal_review': 'REQUIRED', 'unconditional_patent_grant': False, 'patent_fee_requirement': 'NOT DETERMINED'}.

Original texts:

- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/LICENSE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/LICENSE) — 10271 bytes; SHA256 `8b3f1762349248d444ab9acbafe73941254e36e1064954da56bb9ddbd5873ddb`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-2009-OPENCORE-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-2009-OPENCORE-NOTICE) — 740 bytes; SHA256 `05fe8a63dad83fe03493506e16fab91de244b148baa9d16caa06e16872bd9c99`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/MARTIN-STORSJO-2009-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/MARTIN-STORSJO-2009-NOTICE) — 743 bytes; SHA256 `c165ca206bfe3f466637646662e8a18232a7e508dbae50aa509c9546d865fcd3`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-NB-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-NB-NOTICE) — 1332 bytes; SHA256 `85d29787e9fad6aa925d3f8d87c989636829058ae4652886afbe5c8b3d81e03e`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2010-3GPP-NB-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2010-3GPP-NB-NOTICE) — 1332 bytes; SHA256 `9ad160f0f0f35bfeb997be97a52e96f17add2ae083898868312cad2eba59b9b5`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-COMMON-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-COMMON-NOTICE) — 745 bytes; SHA256 `5579d4bbd71395be7a2893d308bbe1f4d66fcbdfba7b14048d0f82caf5523915`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-NB-NEGATE-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-NB-NEGATE-NOTICE) — 1307 bytes; SHA256 `6da526b6919df30cd6409a014225d0ba98795853e45d52014498bade3a2b6051`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/OPENCORE-AMR-NB-3GPP-ATTRIBUTION](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/OPENCORE-AMR-NB-3GPP-ATTRIBUTION) — 568 bytes; SHA256 `6c053611fc96d93c18c7f60addc65eddbd7718d959e7941893d0a9a8c6133318`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PATENT-DISCLAIMER](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PATENT-DISCLAIMER) — 424 bytes; SHA256 `f91a72705d38de34a9749c214a4cbc6ffa1da753b34b2cd11f3d6798f24ae59f`; patent_statement.

## opencore-amr@0.1.6:AMR-WB

Group: G6; license: Apache-2.0.

Runtime DLL mapping: `libopencore-amrwb-0.dll`.

Final linkage: NOT VERIFIED; installer inclusion: NOT VERIFIED; user visibility: NOT VERIFIED.

Legal review: LEGAL REVIEW REQUIRED / FTO NOT ASSESSED.

Original exception scope: {'copyright_license': 'DOCUMENTED', 'third_party_patent_freedom_to_operate': 'NOT ASSESSED', 'legal_review': 'REQUIRED', 'unconditional_patent_grant': False, 'patent_fee_requirement': 'NOT DETERMINED'}.

Original texts:

- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/LICENSE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/LICENSE) — 10271 bytes; SHA256 `8b3f1762349248d444ab9acbafe73941254e36e1064954da56bb9ddbd5873ddb`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-2009-OPENCORE-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-2009-OPENCORE-NOTICE) — 740 bytes; SHA256 `05fe8a63dad83fe03493506e16fab91de244b148baa9d16caa06e16872bd9c99`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/MARTIN-STORSJO-2009-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/MARTIN-STORSJO-2009-NOTICE) — 743 bytes; SHA256 `c165ca206bfe3f466637646662e8a18232a7e508dbae50aa509c9546d865fcd3`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-WB-WRAPPER-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-WB-WRAPPER-NOTICE) — 742 bytes; SHA256 `82a8c7e81f3fe0852927468d64fc239b3db44027ffcd3968d3b1a13e61b93d33`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-COMMON-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-COMMON-NOTICE) — 745 bytes; SHA256 `5579d4bbd71395be7a2893d308bbe1f4d66fcbdfba7b14048d0f82caf5523915`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-WB-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2009-3GPP-WB-NOTICE) — 1346 bytes; SHA256 `73c9c1b13df449a84bd8e2424619e0b100823957c08d1a7a4729a6c5c6186ecf`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2010-3GPP-WB-NOTICE](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PACKETVIDEO-1998-2010-3GPP-WB-NOTICE) — 1346 bytes; SHA256 `226f43796a1ded91a3c809cd4cab0ae02ffc62627319a77e26b03ec01b5f9e43`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/OPENCORE-AMR-WB-3GPP-ATTRIBUTION](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/OPENCORE-AMR-WB-3GPP-ATTRIBUTION) — 582 bytes; SHA256 `fce2e6ca231809d2bd526ae0c07481e23df3e403e53a7e6fad5bd13e27dcbb1c`; copyright_license_disclaimer.
- [mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PATENT-DISCLAIMER](mingw-w64-ucrt-x86_64-opencore-amr/opencore-amr/PATENT-DISCLAIMER) — 424 bytes; SHA256 `f91a72705d38de34a9749c214a4cbc6ffa1da753b34b2cd11f3d6798f24ae59f`; patent_statement.

## R1.1-B UNIC / Unicode 10 candidate supplement

This versioned supplement adds five candidate component records. The preceding 12 I2 partitions and 113 original legal paths remain the approved B1 + G1–G6 base; their scope and text are unchanged.

R1.1-B NOTICE REMEDIATION CANDIDATE / INDEPENDENT REVIEW REQUIRED / LEGAL INTERPRETATION REQUIRED / NOT RELEASED.

UNIC implementation: upstream MIT OR Apache-2.0; the candidate elects MIT for implementation and retains both original texts. This choice does not replace Unicode data terms.

Readable notice: [UNIC / Unicode data notice](rust/unic-0.9.0/NOTICE.md). Full source and table mapping: [SOURCE-MAP.json](rust/unic-0.9.0/SOURCE-MAP.json).

Unicode data legal notice preserves the 2017-06-20 title and PRE contents, including the original 1991–2017 copyright, permission and disclaimers. Its plain-text file is an explicitly recorded byte composition, not the original full HTML or an independently published upstream file. Complete historical HTML stays in QA only.

No Windows production feature, final retained code, new installer content or normal installed-user access was verified in this candidate. P3–P5 and broader compliance gates remain open.

### unic-char-property@0.9.0

Implementation grant: MIT OR Apache-2.0; selected implementation path: MIT.

Archive SHA256 / Cargo checksum: `a8c57a407d9b6fa02b4795eb81c5b6652060a15a7903ea981f3d723e6c0be221`. Source commit: `5878605364af97a3358368a6eaef02104af2e016`.

Source: https://static.crates.io/crates/unic-char-property/unic-char-property-0.9.0.crate.

Original legal texts:

- [rust/unic-0.9.0/COPYRIGHT.md](rust/unic-0.9.0/COPYRIGHT.md) — 608 bytes; SHA256 `f5c342c49f3ac804f3e8e7bb62a8040a44c50d47bb36902b1abd13f66a1adf8b`.
- [rust/unic-0.9.0/LICENSE-MIT](rust/unic-0.9.0/LICENSE-MIT) — 1023 bytes; SHA256 `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.
- [rust/unic-0.9.0/LICENSE-APACHE](rust/unic-0.9.0/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`.
- [rust/unic-0.9.0/AUTHORS](rust/unic-0.9.0/AUTHORS) — 664 bytes; SHA256 `2748c1a1fba7616917c61d455e8d715ab952671ead63f2026ad0124410596b09`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017.txt) — 429 bytes; SHA256 `9c4fabf0f5d0e420aac5d4034fd4ea6ba829f7613533d44c596a28978fdce864`.

Copyright header applicability follows the exact file-level source_headers mapping; optional/test files are not asserted to be retained in Miry.exe.

### unic-char-range@0.9.0

Implementation grant: MIT OR Apache-2.0; selected implementation path: MIT.

Archive SHA256 / Cargo checksum: `0398022d5f700414f6b899e10b8348231abf9173fa93144cbc1a43b9793c1fbc`. Source commit: `5878605364af97a3358368a6eaef02104af2e016`.

Source: https://static.crates.io/crates/unic-char-range/unic-char-range-0.9.0.crate.

Original legal texts:

- [rust/unic-0.9.0/COPYRIGHT.md](rust/unic-0.9.0/COPYRIGHT.md) — 608 bytes; SHA256 `f5c342c49f3ac804f3e8e7bb62a8040a44c50d47bb36902b1abd13f66a1adf8b`.
- [rust/unic-0.9.0/LICENSE-MIT](rust/unic-0.9.0/LICENSE-MIT) — 1023 bytes; SHA256 `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.
- [rust/unic-0.9.0/LICENSE-APACHE](rust/unic-0.9.0/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`.
- [rust/unic-0.9.0/AUTHORS](rust/unic-0.9.0/AUTHORS) — 664 bytes; SHA256 `2748c1a1fba7616917c61d455e8d715ab952671ead63f2026ad0124410596b09`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017.txt) — 429 bytes; SHA256 `9c4fabf0f5d0e420aac5d4034fd4ea6ba829f7613533d44c596a28978fdce864`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2018.txt](rust/unic-0.9.0/SOURCE-NOTICE-2018.txt) — 429 bytes; SHA256 `74dedb5058c59f9212e5a65acb84bc9e8daa3541436c1d4c19bcc1ade1d75e51`.

Copyright header applicability follows the exact file-level source_headers mapping; optional/test files are not asserted to be retained in Miry.exe.

### unic-common@0.9.0

Implementation grant: MIT OR Apache-2.0; selected implementation path: MIT.

Archive SHA256 / Cargo checksum: `80d7ff825a6a654ee85a63e80f92f054f904f21e7d12da4e22f9834a4aaa35bc`. Source commit: `5878605364af97a3358368a6eaef02104af2e016`.

Source: https://static.crates.io/crates/unic-common/unic-common-0.9.0.crate.

Original legal texts:

- [rust/unic-0.9.0/COPYRIGHT.md](rust/unic-0.9.0/COPYRIGHT.md) — 608 bytes; SHA256 `f5c342c49f3ac804f3e8e7bb62a8040a44c50d47bb36902b1abd13f66a1adf8b`.
- [rust/unic-0.9.0/LICENSE-MIT](rust/unic-0.9.0/LICENSE-MIT) — 1023 bytes; SHA256 `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.
- [rust/unic-0.9.0/LICENSE-APACHE](rust/unic-0.9.0/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`.
- [rust/unic-0.9.0/AUTHORS](rust/unic-0.9.0/AUTHORS) — 664 bytes; SHA256 `2748c1a1fba7616917c61d455e8d715ab952671ead63f2026ad0124410596b09`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017.txt) — 429 bytes; SHA256 `9c4fabf0f5d0e420aac5d4034fd4ea6ba829f7613533d44c596a28978fdce864`.

Copyright header applicability follows the exact file-level source_headers mapping; optional/test files are not asserted to be retained in Miry.exe.

### unic-ucd-ident@0.9.0

Implementation grant: MIT OR Apache-2.0; selected implementation path: MIT.

Archive SHA256 / Cargo checksum: `e230a37c0381caa9219d67cf063aa3a375ffed5bf541a452db16e744bdab6987`. Source commit: `8a6ce83063d90b91ae2ce59eddb803edd393fca9`.

Source: https://static.crates.io/crates/unic-ucd-ident/unic-ucd-ident-0.9.0.crate.

Original legal texts:

- [rust/unic-0.9.0/COPYRIGHT.md](rust/unic-0.9.0/COPYRIGHT.md) — 608 bytes; SHA256 `f5c342c49f3ac804f3e8e7bb62a8040a44c50d47bb36902b1abd13f66a1adf8b`.
- [rust/unic-0.9.0/LICENSE-MIT](rust/unic-0.9.0/LICENSE-MIT) — 1023 bytes; SHA256 `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.
- [rust/unic-0.9.0/LICENSE-APACHE](rust/unic-0.9.0/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`.
- [rust/unic-0.9.0/AUTHORS](rust/unic-0.9.0/AUTHORS) — 664 bytes; SHA256 `2748c1a1fba7616917c61d455e8d715ab952671ead63f2026ad0124410596b09`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017.txt) — 429 bytes; SHA256 `9c4fabf0f5d0e420aac5d4034fd4ea6ba829f7613533d44c596a28978fdce864`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017-2019.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017-2019.txt) — 434 bytes; SHA256 `6d22cfbf9bbcc99e4305e1bfdb3cf450ad0d80f84fe9eb66803fd246a3c8359f`.
- [rust/unic-0.9.0/UNICODE-2017-DATA-LICENSE.txt](rust/unic-0.9.0/UNICODE-2017-DATA-LICENSE.txt) — 2847 bytes; SHA256 `b1e77f690c2819db24ebc22356a6ad70909ddaa9d84bc41a10714428b73d1847`.

Copyright header applicability follows the exact file-level source_headers mapping; optional/test files are not asserted to be retained in Miry.exe.

### unic-ucd-version@0.9.0

Implementation grant: MIT OR Apache-2.0; selected implementation path: MIT.

Archive SHA256 / Cargo checksum: `96bd2f2237fe450fcd0a1d2f5f4e91711124f7857ba2e964247776ebeeb7b0c4`. Source commit: `5878605364af97a3358368a6eaef02104af2e016`.

Source: https://static.crates.io/crates/unic-ucd-version/unic-ucd-version-0.9.0.crate.

Original legal texts:

- [rust/unic-0.9.0/COPYRIGHT.md](rust/unic-0.9.0/COPYRIGHT.md) — 608 bytes; SHA256 `f5c342c49f3ac804f3e8e7bb62a8040a44c50d47bb36902b1abd13f66a1adf8b`.
- [rust/unic-0.9.0/LICENSE-MIT](rust/unic-0.9.0/LICENSE-MIT) — 1023 bytes; SHA256 `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.
- [rust/unic-0.9.0/LICENSE-APACHE](rust/unic-0.9.0/LICENSE-APACHE) — 10847 bytes; SHA256 `a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2`.
- [rust/unic-0.9.0/AUTHORS](rust/unic-0.9.0/AUTHORS) — 664 bytes; SHA256 `2748c1a1fba7616917c61d455e8d715ab952671ead63f2026ad0124410596b09`.
- [rust/unic-0.9.0/SOURCE-NOTICE-2017.txt](rust/unic-0.9.0/SOURCE-NOTICE-2017.txt) — 429 bytes; SHA256 `9c4fabf0f5d0e420aac5d4034fd4ea6ba829f7613533d44c596a28978fdce864`.

Copyright header applicability follows the exact file-level source_headers mapping; optional/test files are not asserted to be retained in Miry.exe.

Data transformation facts: [DATA-PROVENANCE-AND-TRANSFORMATION.md](rust/unic-0.9.0/DATA-PROVENANCE-AND-TRANSFORMATION.md). This explanatory document does not invent a statutory modified-data notice obligation.

## D0.6-B2 — brotli-decompressor 6.0.1 / src/context.rs

Component ID: `brotli-decompressor@6.0.1`. Original Cargo declaration: `BSD-3-Clause/MIT` (retained literally; no SPDX OR/AND interpretation). This is a file-level notice engineering candidate, not final legal approval.

The following original source header applies specifically to `src/context.rs`:

```text
// Copyright 2013 Google Inc. All Rights Reserved.
//
// Distributed under MIT license.
// See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
//

```

- [Google MIT full text](rust/brotli-9.0.0/LICENSE.MIT), SHA256 `3d180008e36922a4e8daec11c34c7af264fed5962d07924aea928c38e8663c94`. Existing exact bytes reused for this file; component identity remains brotli-decompressor 6.0.1.
- [Dropbox 2016 BSD-3-Clause original](rust/brotli-decompressor-6.0.1/LICENSE), SHA256 `c0c56f26d9c051cac4d200c34c84e7ae9aaa853e01a982a1df08b09931e518ae`. Preserved separately; it does not replace the Google file attribution.
- [Versioned file/source mapping](rust/brotli-decompressor-6.0.1/SOURCE-MAP-D0.6-B2.json): fixed source revisions, exact header slice, B1 evidence cross-references and original-resource paths.

Dropbox initial direct-port commit: `3c32e43b16ee0b2736685c2b6ebfdc0db0cd7dc7`. Dropbox 2018 table extension: `8234c4931cc2682fc3ad07adb83e194d94b352b7`; matching Google 2018 witness: `35e69fc7cf9421ab04ffc9d52cb36d07fa12984a`. A unique Google donor SHA is **NOT CONFIRMED**.

Historical copyright lines remain distinct:

- `Copyright (c) 2009, 2010, 2013-2015 by the Brotli Authors.` — Google `23934731f55d06e5b83701bf82c2f53bb9ddf56d`, B1-05; exact historical full text retained in the B1 evidence package, SHA256 `6e86408ccace4d14d2a9116cb81fe9fbab65f51fb01e123596e1ff5f010abe0c`.
- `Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.` — Google 2018 witness, B1-07; exact full text is the shared resource linked above.

These two historical originals are not merged or rewritten. Whether the 2015 full text must also ship separately, contribution boundaries and final notice sufficiency remain **LEGAL_REVIEW_REQUIRED**. Other crate files are **NOT VERIFIED** by this patch. Static Tauri resource eligibility does not establish installer inclusion or user visibility. Full D0.6-B coverage remains pending; **NOT RELEASED**.

## Miry v1.0.6 R1.3 complete candidate resources

[Full NOTICE](rust-v106/NOTICE.txt), [INDEX](rust-v106/INDEX.json), [Original resources](rust-v106/RESOURCE-MANIFEST.json).

Original bytes and file grants are preserved. Independent review and final artifact/source/data acceptance remain required.
