param(
    [string]$SevenZipPath,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'docs/runtime-manifest-1.0.3.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$runtimeRoot = Join-Path $repoRoot 'tools/mpv'

function Get-RuntimePath([string]$Root, [string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[/\\])\.\.([/\\]|$)' -or $Relative -match ':') {
        throw 'Unsafe path in runtime manifest.'
    }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $path = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (-not $path.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime path escapes destination.' }
    return $path
}

function Assert-Runtime([string]$Root) {
    foreach ($entry in $manifest.files) {
        $path = Get-RuntimePath $Root $entry.path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing runtime file: $($entry.path)" }
        if ((Get-Item -LiteralPath $path).Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
            throw "Runtime hash mismatch: $($entry.path)"
        }
    }
    if (@(Get-ChildItem -LiteralPath $Root -File -Recurse).Count -ne $manifest.fileCount) {
        throw 'Runtime contains unexpected files; preserve and review them before restoring.'
    }
}

if ($VerifyOnly) {
    Assert-Runtime $runtimeRoot
    Write-Output "Runtime verified: $($manifest.fileCount) files; mpv commit $($manifest.mpvCommit)."
    exit 0
}

if (-not $SevenZipPath) {
    $command = Get-Command '7z.exe' -ErrorAction SilentlyContinue
    if ($command) { $SevenZipPath = $command.Source }
    else { $SevenZipPath = Join-Path $env:ProgramFiles '7-Zip/7z.exe' }
}
if (-not (Test-Path -LiteralPath $SevenZipPath -PathType Leaf)) {
    throw 'Full 7-Zip with NSIS support is required. Install from https://www.7-zip.org/download.html, or pass -SevenZipPath.'
}

$cacheRoot = Join-Path $repoRoot '.cache/runtime-restore-v1.0.3'
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
$setup = Join-Path $cacheRoot $manifest.installer.name
if (-not (Test-Path -LiteralPath $setup -PathType Leaf)) {
    Invoke-WebRequest -Uri $manifest.installer.url -OutFile $setup -UseBasicParsing
}
if ((Get-Item -LiteralPath $setup).Length -ne $manifest.installer.bytes -or (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.installer.sha256) {
    throw 'Installer hash mismatch. Download retained for inspection; no runtime files changed.'
}

$stage = Join-Path $cacheRoot ('extract-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
& $SevenZipPath x $setup 'tools/mpv/*' "-o$stage" '-y' '-bso0' '-bsp0'
if ($LASTEXITCODE -ne 0) { throw 'NSIS extraction failed. Existing runtime was not changed.' }
$extracted = Join-Path $stage 'tools/mpv'
Assert-Runtime $extracted

# Preserve different existing bytes (including Git checkout line endings) before replacement.
# No files are deleted, no installer is run, and no user configuration is accessed.
$backupRoot = Join-Path $cacheRoot ('preserved-' + [Guid]::NewGuid().ToString('N'))
foreach ($entry in $manifest.files) {
    $destination = Get-RuntimePath $runtimeRoot $entry.path
    if ((Test-Path -LiteralPath $destination -PathType Leaf) -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
        $backup = Get-RuntimePath $backupRoot $entry.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
        Copy-Item -LiteralPath $destination -Destination $backup
    }
}
foreach ($entry in $manifest.files) {
    $destination = Get-RuntimePath $runtimeRoot $entry.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath (Get-RuntimePath $extracted $entry.path) -Destination $destination -Force
}
Assert-Runtime $runtimeRoot
Write-Output "Runtime restored: $($manifest.fileCount) files; mpv commit $($manifest.mpvCommit)."
Write-Output "Installer SHA256: $($manifest.installer.sha256)"
