# Exact runtime sources for this candidate

The retained [source index](THIRD-PARTY-SOURCES.json) records the same mpv revision, 138 runtime-file hashes and binary package versions as this candidate. [Verification](VERIFICATION.json) records the three fixed volume hashes, 1,281 indexed source members and 108 package/recipe associations in that retained index. Source/patch/recipe bytes have been recovered and checked; this is not a new runtime rebuild or a legal clearance.

Save all three separate source volumes, available without an account:

- [Source volume 1](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-1.zip)
- [Source volume 2](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-2.zip)
- [Source volume 3](https://github.com/Lomiry/Miry/releases/download/v1.0.1/Miry-v1.0.1-third-party-sources-3.zip)

Each is a complete independent ZIP. The source index identifies each member's volume, bytes and SHA256. `msys2-sources/` contains the retained original source packages, PKGBUILD, patches and payloads; `mpv/` contains the exact mpv source archive. The separate private review delivery preserves these same volumes in `runtime-sources/`. The 4 GB source volumes are separate from the installer; they are not represented as embedded installer members.

[Historical build instructions](HISTORICAL-SOURCES.md) are preserved unchanged from v1.0.1. Their application licensing/closed-source statements and packaging-state notes describe that historical release. The current Miry candidate's MIT scope is in [LICENSE-SCOPE.json](../../LICENSE-SCOPE.json); the original historical document does not override it. The old v1.0.3 source-index asset URL returned 404 during this task; use the supplied offline index or the [verified v1.0.1 index](https://github.com/Lomiry/Miry/releases/download/v1.0.1/THIRD-PARTY-SOURCES.json).

The candidate remains NOT RELEASED. Historical holder, Unicode, patent/AMR/LERC and provenance questions remain pending; delivery of exact source bytes does not decide those questions. Final public release packaging and placement require separate owner authorization.
