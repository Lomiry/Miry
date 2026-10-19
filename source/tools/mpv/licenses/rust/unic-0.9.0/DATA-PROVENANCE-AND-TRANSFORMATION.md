# Unicode 10.0 data provenance and transformation facts

This is a project-authored explanation, separate from the preserved upstream legal text. It does not assert a statutory modified-data notice duty or determine the legal classification of transformed tables.

Unicode version: 10.0.0. UNIC generator commit: `8a6ce83063d90b91ae2ce59eddb803edd393fca9`.

The pinned open-i18n data mirror is unofficial. Its historical gitlink commit is `2a2044479b3c4915ef4213adf1dfd6236dba24c8`. Official Unicode input hashes and mirror provenance are recorded separately; mirror hosting is not a separate rights grant.

The generation process selects the indicated properties, parses character intervals, sorts/coalesces scalar ranges, and emits Rust range-table syntax. R1 independently reconstructed six table byte streams; that is a historical automated result. Neither the generator nor the reconstruction was rerun for this notice-only candidate. No source or data tables were edited.

| Crate table | Unicode input / property | Table SHA256 | Compile condition in crate |
|---|---|---|---|
| tables/id_start.rsv | DerivedCoreProperties.txt / ID_Start | `6970896f4c4f7145e918435c07756585ead65f67007016ebdb7169a3dd4da5d3` | id (optional) |
| tables/id_continue.rsv | DerivedCoreProperties.txt / ID_Continue | `9d9ece7d9bf899756b3556861e5cd66ebd6ca3afb128f7cec235d4c4067c6917` | id (optional) |
| tables/xid_start.rsv | DerivedCoreProperties.txt / XID_Start | `4b8bc5ef14ee67842dfaeda5bad56527f61789881aa59611599e31b2df5f55b4` | xid (crate default) |
| tables/xid_continue.rsv | DerivedCoreProperties.txt / XID_Continue | `c32d3408d51272db0a78d70e328d8805ef1593e8e2479526aec6a11b61ad8c97` | xid (crate default) |
| tables/pattern_syntax.rsv | PropList.txt / Pattern_Syntax | `381a11d21247cab907401b49d1f2326e34d090cea9e438d8c36462485aa96ee6` | pattern (optional) |
| tables/pattern_white_space.rsv | PropList.txt / Pattern_White_Space | `46ea34ac91437824629ef28ff96e933e55063ac1f577a21b3894da29b4faeb4a` | pattern (optional) |

Official inputs:

- https://www.unicode.org/Public/10.0.0/ucd/ReadMe.txt — 507 bytes; SHA256 `7e9ff2ef4828f9119eea17ada0b35697106ed2885521bfa854b126cea910802e`.
- https://www.unicode.org/Public/10.0.0/ucd/DerivedCoreProperties.txt — 960758 bytes; SHA256 `e6ca152259189ec4bc2297e93c6c88f86e162cc52814198263497f3c9b46cbe9`.
- https://www.unicode.org/Public/10.0.0/ucd/PropList.txt — 119340 bytes; SHA256 `58dbf8fedbd5bf67a3bd5c10eda2f2acf2eae59df5f77884a6f158e98f75cf8c`.

The ReadMe and two unicode_version.rsv files identify 10.0.0; version facts are not treated here as a resolved copyrightability question.

Archive bytes and source/table hashes were read in earlier R1/A2 evidence. This candidate reads frozen evidence only, not crates.io archives. Cargo dependency reachability and source presence do not establish production feature activation, final object retention, final EXE contents or installer inclusion.

The 2017 data-license PRE has no independent modified-data notice clause. General Terms of Use, temporal applicability and transformed-table classification remain LEGAL INTERPRETATION REQUIRED. The full historical webpage is held only in QA and is not a production resource.
