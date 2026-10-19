$ErrorActionPreference = 'Stop'
$miryIconRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $miryIconRoot
$miryNode = Get-Command node.exe
$env:PATH = (Split-Path -Parent $miryNode.Source) + ';' + $env:PATH
& npm.cmd run tauri icon -- src/assets/miry-icon.svg -o src-tauri/icons
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run tauri icon -- src/assets/miry-icon.svg -o src-tauri/icons/windows -p 16 -p 20 -p 24 -p 32 -p 40 -p 48 -p 64 -p 128 -p 256
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node.exe scripts/complete-windows-icon.mjs
exit $LASTEXITCODE
