param([ValidateSet('dev', 'build')] [string]$Mode = 'dev')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskNode = Get-Command node.exe -ErrorAction SilentlyContinue
if (!$taskNode) { throw 'Install Node.js before running Miry.' }
$env:PATH = (Split-Path -Parent $taskNode.Source) + ';' + $env:PATH
if (!(Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    $taskCandidates = @(
        (Join-Path $taskRoot '../../work/toolchains'),
        (Join-Path $taskRoot '../../../work/toolchains')
    )
    foreach ($taskCandidate in $taskCandidates) {
        if (Test-Path -LiteralPath (Join-Path $taskCandidate 'cargo/bin/cargo.exe')) {
            $env:CARGO_HOME = (Resolve-Path -LiteralPath (Join-Path $taskCandidate 'cargo')).Path
            $env:RUSTUP_HOME = (Resolve-Path -LiteralPath (Join-Path $taskCandidate 'rustup')).Path
            $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
            break
        }
    }
}
if (!(Get-Command cargo.exe -ErrorAction SilentlyContinue)) { throw 'Install Rust MSVC, C++ Build Tools and the Windows SDK before running Miry.' }
if ($Mode -eq 'build') { & npm.cmd run tauri build -- --bundles nsis }
else { & npm.cmd run tauri dev }
exit $LASTEXITCODE
