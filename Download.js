const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Target directory paths required for your custom web layout setup
const IMAGE_DIR = path.join(__dirname, 'Motorola', 'images');

// Sample array containing your web extracted URL paths
const extractedUrls = [
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/PMMN4050ASP01.rsm01.png&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/products/RMN5052A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1357451745782339430/products/WGP02798C.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2447123821249084016/products/WGA00668.01.jpg",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1605535242988234636/products/WGP01475.01.jpg.png",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v7987840139770166646/products/WGP362.01.jpg.png",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/general/wave-whitepaper-tablet.png&height=500&width=500",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4725872571231011993/products/PMLN7157A.earpiece01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1249027925773412455/products/HKNN4013A.battery01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v8356469437406939903/products/PMLN7109A.charger01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v1186186327544627568/products/PMLN7190A.carry01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v2806255002869126823/products/32012144002.part01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v3249818337626738866/products/PMLN5958A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v5212608410539372169/products/32012144004.part01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v4477003457347045409/products/32012144003.part01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6466399034784361968/products/PMAE4094A.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v3770384757102843825/products/32012144001.part01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v479194336605430690/products/PMLN5957A.01.jpg&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v7504110565701666618/products/PMLN7159A.earpiece01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6746835233978328688/products/PMLN7101A.charger01.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v825207308333187475/products/PMLN7128A.carry02.JPG&height=300&width=300",
  "https://shop.motorolasolutions.com/ccstore/v1/images/?source=/file/v6094927747013465712/products/32012144005.part01.JPG&height=300&width=300"
]
	
	
	
	
    // You can paste or dynamically import your raw scraped array file data endpoints here


async function downloadAndFormatImages() {
    // Ensure the nested "Motorola/images" folders exist before downloading assets
    if (!fs.existsSync(IMAGE_DIR)) {
        fs.mkdirSync(IMAGE_DIR, { recursive: true });
        console.log(`📁 Created target asset directory at: ${IMAGE_DIR}`);
    }

    console.log(`Processing pipeline queue for ${extractedUrls.length} image elements...`);

    for (const url of extractedUrls) {
        try {
            const urlObj = new URL(url);
            const sourceParam = urlObj.searchParams.get('source');

            if (!sourceParam) {
                console.log(`⚠️ Skipping URL (No source parameter found): ${url}`);
                continue;
            }

            // Extract the filename from the path string
            const rawFileName = sourceParam.split('/').pop();

            // Match and isolate the true 9-character Motorola component identification block
            // Captures everything up to the first dot or special character extension block
const partMatch = rawFileName.split('.')[0]; 

if (!partMatch || partMatch.toLowerCase() === 'wave-whitepaper-tablet') {
    console.log(`⏩ Skipping layout graphics: ${rawFileName}`);
    continue;
}

// Convert match straight to a clean upper case string
const cleanPartNumber = partMatch.toUpperCase(); 

            
            if (!partMatch) {
                console.log(`⚠️ Skipping file (Does not match standard part number pattern): ${rawFileName}`);
                continue;
            }

            
            const destinationPath = path.join(IMAGE_DIR, `${cleanPartNumber}.png`);

            console.log(`📥 Downloading image payload asset for part: ${cleanPartNumber}...`);

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });

            // Write the raw binary stream data to disk using your requested schema mapping layout
            fs.writeFileSync(destinationPath, response.data);
            console.log(`  ✅ Saved clean asset to: Motorola/images/${cleanPartNumber}.png`);

            // Anti-blocking pause safety buffer sequence
            await new Promise(resolve => setTimeout(resolve, 1200));

        } catch (error) {
            console.error(`  ❌ Failed handling execution thread processing for URL context: ${url}`);
            console.error(`     Reason: ${error.message}`);
        }
    }

    console.log("\n🏁 Image asset processing pipeline complete!");
}

downloadAndFormatImages();
