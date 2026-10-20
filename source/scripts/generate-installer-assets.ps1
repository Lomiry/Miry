$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$miryRoot = Split-Path -Parent $PSScriptRoot
$miryOutput = Join-Path $miryRoot 'src-tauri/installer'
$miryLogo = [Drawing.Image]::FromFile((Join-Path $miryRoot 'src-tauri/icons/128x128.png'))

function Write-InstallerBitmap([string]$Name, [int]$Width, [int]$Height, [Drawing.Color]$Background, [Drawing.Rectangle]$LogoRect) {
    $bitmap = [Drawing.Bitmap]::new($Width, $Height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear($Background)
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($miryLogo, $LogoRect)
        $bitmap.Save((Join-Path $miryOutput $Name), [Drawing.Imaging.ImageFormat]::Bmp)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    New-Item -ItemType Directory -Path $miryOutput -Force | Out-Null
    # Native MUI sizes. Reuse the existing logo; do not introduce a new brand.
    Write-InstallerBitmap 'header.bmp' 150 57 ([Drawing.Color]::White) ([Drawing.Rectangle]::new(93, 4, 48, 48))
    Write-InstallerBitmap 'sidebar.bmp' 164 314 ([Drawing.ColorTranslator]::FromHtml('#173a34')) ([Drawing.Rectangle]::new(18, 42, 128, 128))
} finally {
    $miryLogo.Dispose()
}
