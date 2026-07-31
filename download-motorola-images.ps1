cd "C:\Users\kklyb\OneDrive\Documents\TA Radio Website\Motorola\images"

Add-Type -AssemblyName System.Drawing

$urls = @(
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1170858102484173780/products/HKKN4027.jpg&height=300&width=300"
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4348445583414674338/products/HKLN4513A.01.jpg&height=300&width=300"
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2998094329351989186/products/HKLN4478B.01.jpg&height=300&width=300"
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6132878288489896628/products/HKLN4433A.01.jpg&height=300&width=300"
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1210014076444020767/products/HKLN4438B.01.jpg&height=300&width=300"
	"https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1060750003588696882/products/HKPN4007.01.jpg&height=300&width=300"
)

foreach ($u in $urls) {
  if ($u -match 'source=([^&]+)') {
    $sourcePath = [uri]::UnescapeDataString($Matches[1])
  } else { continue }

  $original = $sourcePath.Split('/')[-1]
  $base = [System.IO.Path]::GetFileNameWithoutExtension($original)
  $part = if ($base -match '\.') { $base.Split('.')[0] } else { $base }

  $temp = "__temp_$part"
  $out  = "$part.png"

  try {
    Invoke-WebRequest -Uri $u -OutFile $temp -UseBasicParsing

    $img = [System.Drawing.Image]::FromFile((Resolve-Path $temp))
    $img.Save((Join-Path (Get-Location) $out), [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()

    Remove-Item $temp -Force
    Write-Host "Saved $out"
  } catch {
    Write-Host "FAILED $part : $_"
    if (Test-Path $temp) { Remove-Item $temp -Force -ErrorAction SilentlyContinue }
  }
}