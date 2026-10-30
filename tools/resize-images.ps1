# Skalerer originalene fra tools/generate-images.mjs til filene siden bruker i icons/.
#   powershell -ExecutionPolicy Bypass -File tools/resize-images.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'tools/image-originals'
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Save-Resized($inFile, $outFile, $w, $h, $cropY = 0, $cropH = 0, $jpegQuality = 0) {
  $img = [System.Drawing.Image]::FromFile($inFile)
  if ($cropH -le 0) { $cropH = $img.Height }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $srcRect = New-Object System.Drawing.Rectangle 0, $cropY, $img.Width, $cropH
  $dstRect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  if ($jpegQuality -gt 0) {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters 1
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$jpegQuality)
    $bmp.Save($outFile, $codec, $params)
  } else {
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Output ("{0} {1}x{2} {3} kB" -f (Split-Path -Leaf $outFile), $w, $h, [math]::Round((Get-Item $outFile).Length / 1KB))
}

$icon = Join-Path $src 'icon.png'
Save-Resized $icon (Join-Path $out 'favicon-32.png') 32 32
Save-Resized $icon (Join-Path $out 'apple-touch-icon.png') 180 180
Save-Resized $icon (Join-Path $out 'icon-192.png') 192 192
Save-Resized $icon (Join-Path $out 'icon-512.png') 512 512

# Delingsbildet: 1536x864 beskjæres til 1200x630 (1,905:1). Beholder toppen der tittelen står.
$share = Join-Path $src 'share.png'
Save-Resized $share (Join-Path $out 'og-image.jpg') 1200 630 20 806 85
