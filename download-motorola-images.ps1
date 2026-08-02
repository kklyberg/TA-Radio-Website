cd "C:\Users\kklyb\OneDrive\Documents\TA Radio Website\Motorola\images"

Add-Type -AssemblyName System.Drawing

$urls = @(
	

  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/RMN5052A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1357451745782339430/products/WGP02798C.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2447123821249084016/products/WGA00668.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/PMMN4050ASP01.rsm01.png&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v7987840139770166646/products/WGP362.01.jpg.png",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/general/wave-whitepaper-tablet.png&height=500&width=500",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6981896971282922432/products/PMLN8121A.01.png&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4484835018497059690/products/PMNN4486A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v8977717688652343759/products/PMLN8536AR.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v209405596421287100/products/PMNN4418AR.03.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4570657340366134751/products/PMLN5072A.01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v5962236487855000691/products/NNTN8383B.rsm01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4725872571231011993/products/PMLN7157A.earpiece01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2121386771435367529/products/NAG4000A.antenna01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v3235805537886725501/products/PMMN4128A.01.png&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v8214087744893485432/products/PMPN4174A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v266984397951578480/products/HLN6875A.carry01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6165495721455887280/products/PMKN4265A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2091840808137289870/products/0180300B02.cable01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1249027925773412455/products/HKNN4013A.battery01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v5966179377291198503/products/AN000296A01.png&height=300&width=300"

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