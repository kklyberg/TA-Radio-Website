const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========== CONFIGURATION ==========
const TARGET_FOLDER = "motorolasolutions/images"; // Saves directly to your folder structure

// 1. Paste the clean, 8-character part numbers from your datasheet script here
const datasheetParts = [
  "PMNN4468", "PMLN7074", "PMLN7101", "PMLN7109", "CB000262A01",
  "PMAE4093", "PMAE4094", "PMAE4095", "PMAD4144", "PMAD4145",
  "PMAD4146", "PMLN7189", "PMLN7156", "PMLN7157", "PMLN7158",
  "PMLN7159", "RLN6242", "RLN6282", "PMLN6074", "PMLN7076",
  "PMLN7128", "PMLN7190"
];

// 2. Paste the raw, messy image URLs your URL extraction script grabbed here
const extractedMotorolaUrls = [
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

];

// 3. MANUAL OVERRIDE MAP (For sneaky items like PMLN7189 using the PMLN5958A image asset)
const specialOverrides = {
  "PMLN5958A": "PMLN7189",
  "PMLN7110A": "PMLN7109"
};
// ===================================

async function runSmartMergePipeline() {
    const outputDir = path.join(__dirname, TARGET_FOLDER);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`🚀 Starting Smart Merger Pipeline...`);
    console.log(`📋 Target sheet parts: ${datasheetParts.length} | 📡 Total extracted web links: ${extractedMotorolaUrls.length}`);

    let matchCount = 0;

    // Loop through each part number you need from your datasheet
    for (const targetPart of datasheetParts) {
        const cleanTarget = targetPart.trim().toUpperCase();
        const localDestPath = path.join(outputDir, `${cleanTarget}.png`);

        if (fs.existsSync(localDestPath)) {
            console.log(`  ⏭️ Asset [${cleanTarget}.png] already exists locally. Skipping.`);
            matchCount++;
            continue;
        }

        let matchingUrl = null;

        // Hunt through your extracted URLs to find a link containing this part number or an override match
        for (const rawUrl of extractedMotorolaUrls) {
            const urlObj = new URL(rawUrl);
            const sourceParam = urlObj.searchParams.get('source') || '';
            const upperSource = sourceParam.toUpperCase();

            // Check A: Does the URL contain the exact part number (e.g., PMNN4468)?
            if (upperSource.includes(cleanTarget)) {
                matchingUrl = rawUrl;
                break;
            }

            // Check B: Does the URL contain a root part that maps to our target via special overrides?
            for (const [rootPart, mapToTarget] of Object.entries(specialOverrides)) {
                if (mapToTarget === cleanTarget && upperSource.includes(rootPart)) {
                    matchingUrl = rawUrl;
                    break;
                }
            }
            if (matchingUrl) break;
        }

        // If a match is found among the extracted links, execute direct stream capture
        if (matchingUrl) {
            console.log(`🎯 Match Found! Downloading image for spreadsheet SKU: [${cleanTarget}]`);
            
            try {
                const response = await axios({
                    method: 'get',
                    url: matchingUrl.replace(/&amp;/g, '&'),
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });

                // FORCE SAVE: Saves exactly as your datasheet part name, completely safe from text clumping
                fs.writeFileSync(localDestPath, response.data);
                console.log(`  ✅ Successfully saved to: ${TARGET_FOLDER}/${cleanTarget}.png`);
                matchCount++;

            } catch (error) {
                console.log(`  ❌ Network error downloading link for ${cleanTarget}: ${error.message}`);
            }
        } else {
            console.log(`  ⚠️ Warning: No image found in the extracted URLs list containing the characters for: [${cleanTarget}]`);
        }

        // 500ms slight throttle spacing to keep array performance snappy
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n🏁 Done! Successfully matched and downloaded ${matchCount}/${datasheetParts.length} assets into your local directory cleanly.`);
}

runSmartMergePipeline().catch(console.error);
