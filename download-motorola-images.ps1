# Change to the images folder
Set-Location "C:\Users\kklyb\OneDrive\Documents\TA Radio Website\Motorola\images"

# Load System.Drawing so we can convert to PNG
Add-Type -AssemblyName System.Drawing

$urls = @(
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/PMMN4050ASP01.rsm01.png&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/RMN5052A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1357451745782339430/products/WGP02798C.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2447123821249084016/products/WGA00668.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1605535242988234636/products/WGP01475.01.jpg.png",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v7987840139770166646/products/WGP362.01.jpg.png",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/general/wave-whitepaper-tablet.png&height=500&width=500",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1249027925773412455/products/HKNN4013A.battery01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4307734580880754112/products/AAM24X501.speakermic01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1938378066040446394/products/AAM18X501._-carryandattachments_.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1364327942556082254/products/AAE23X503.antenna01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4383639847382515549/products/AAM21X501.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4849002106044431031/products/VAC-6066.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2273300472882186426/products/AAM19X501.01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1441655164056630027/products/AAE23X502.antenna01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v7546422101776372499/products/AAM23X503.antenna01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1620071835046185402/products/AAM20X501.charger01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4173129568312122270/products/AAM28X504.antenna01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1077725327599010332/products/AAE23X501.antenna_ (2).jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4426572018918979653/products/AAM28X503.antenna01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v8424017557459938245/products/PMPN4009B.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v5419938618517970107/products/AAM23X502.jpg&height=300&width=300"
)

foreach ($u in $urls) {
    # Extract the source= path
    if ($u -match 'source=([^&]+)') {
        $sourcePath = [uri]::UnescapeDataString($Matches[1])
    } else {
        Write-Host "SKIPPED (no source= found): $u"
        continue
    }

    # Get the original filename
    $original = $sourcePath.Split('/')[-1]

    # Create a clean part number / base name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($original)
    $part = if ($base -match '\.') { $base.Split('.')[0] } else { $base }

    # Clean any remaining bad characters for a Windows filename
    $part = $part -replace '[\\/:*?"<>|]', '_'

    $temp = "__temp_$part"
    $out  = "$part.png"

    try {
        Write-Host "Downloading $part ..." -NoNewline

        Invoke-WebRequest -Uri $u -OutFile $temp -UseBasicParsing -TimeoutSec 30

        # Convert to PNG
        $img = [System.Drawing.Image]::FromFile((Resolve-Path $temp).Path)
        $img.Save((Join-Path (Get-Location) $out), [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()

        Remove-Item $temp -Force -ErrorAction SilentlyContinue
        Write-Host "  → Saved $out" -ForegroundColor Green
    }
    catch {
        Write-Host "  → FAILED: $_" -ForegroundColor Red
        if (Test-Path $temp) {
            Remove-Item $temp -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`nDone." -ForegroundColor Cyan