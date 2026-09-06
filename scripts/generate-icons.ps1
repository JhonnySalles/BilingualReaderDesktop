Add-Type -AssemblyName System.Drawing

$sourcePath = "f:\Projetos\BilingualReaderDesktop\original\BilingualReader\src\main\res\mipmap-xxxhdpi\ico_launcher_adaptive_fore.png"

$appIconsDir = "f:\Projetos\BilingualReaderDesktop\app\assets\icons"
$publicIconsDir = "f:\Projetos\BilingualReaderDesktop\public\assets\icons"
$publicDir = "f:\Projetos\BilingualReaderDesktop\public"

if (-not (Test-Path $appIconsDir)) { New-Item -ItemType Directory -Force -Path $appIconsDir }
if (-not (Test-Path $publicIconsDir)) { New-Item -ItemType Directory -Force -Path $publicIconsDir }

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image($image, $width, $height) {
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $destImage = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $destImage.SetResolution($image.HorizontalResolution, $image.VerticalResolution)

    $graphics = [System.Drawing.Graphics]::FromImage($destImage)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $wrapMode = New-Object System.Drawing.Imaging.ImageAttributes
    $wrapMode.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $graphics.DrawImage($image, $destRect, 0, 0, $image.Width, $image.Height, [System.Drawing.GraphicsUnit]::Pixel, $wrapMode)
    $graphics.Dispose()
    $wrapMode.Dispose()

    return $destImage
}

function Image-To-PngBytes($bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    return $bytes
}

# Create ICO file from list of (width, height, pngBytes)
function Create-IcoFile($entries, $outputPath) {
    $fs = [System.IO.File]::Create($outputPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    # ICONDIR
    $bw.Write([uint16]0) # Reserved
    $bw.Write([uint16]1) # Type 1 = ICO
    $bw.Write([uint16]$entries.Count) # Count of images

    # Calculate offset after header & directory entries
    # Header = 6 bytes, Directory entry = 16 bytes each
    $offset = 6 + (16 * $entries.Count)

    foreach ($entry in $entries) {
        $w = if ($entry.Width -ge 256) { [byte]0 } else { [byte]$entry.Width }
        $h = if ($entry.Height -ge 256) { [byte]0 } else { [byte]$entry.Height }
        $bytes = $entry.Bytes

        $bw.Write($w) # Width
        $bw.Write($h) # Height
        $bw.Write([byte]0) # Color Count
        $bw.Write([byte]0) # Reserved
        $bw.Write([uint16]1) # Color Planes
        $bw.Write([uint16]32) # Bits per pixel
        $bw.Write([uint32]$bytes.Length) # Image size in bytes
        $bw.Write([uint32]$offset) # Image offset

        $offset += $bytes.Length
    }

    foreach ($entry in $entries) {
        [byte[]]$rawBytes = $entry.Bytes
        $bw.Write($rawBytes, 0, $rawBytes.Length)
    }

    $bw.Flush()
    $bw.Dispose()
    $fs.Dispose()
}

$sizes = @(256, 128, 64, 48, 32, 24, 16)
$icoEntries = @()

foreach ($s in $sizes) {
    $resized = Resize-Image $srcImg $s $s
    $pngBytes = Image-To-PngBytes $resized
    $icoEntries += [PSCustomObject]@{
        Width = $s
        Height = $s
        Bytes = $pngBytes
    }

    if ($s -eq 256) {
        $resized.Save((Join-Path $appIconsDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Save((Join-Path $publicIconsDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    if ($s -eq 32) {
        $resized.Save((Join-Path $appIconsDir "tray-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Save((Join-Path $publicIconsDir "tray-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $resized.Dispose()
}

$srcImg.Dispose()

# Save icon.ico and favicon.ico
Create-IcoFile $icoEntries (Join-Path $appIconsDir "icon.ico")
Create-IcoFile $icoEntries (Join-Path $publicDir "favicon.ico")

Write-Host "Icons generated successfully in $appIconsDir and $publicIconsDir"
