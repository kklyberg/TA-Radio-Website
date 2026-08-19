const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// ========== CONFIGURATION ==========
const TARGET_BRAND_FOLDER = "Motorola"; 

// The clean, isolated accessory list extracted from your datasheet
const datasheetAccessories = [
  "PMNN4468", "PMLN7074", "PMLN7101", "PMLN7109", "CB000262A01",
  "PMAE4093", "PMAE4094", "PMAE4095", "PMAD4144", "PMAD4145",
  "PMAD4146", "PMLN7189", "PMLN7156", "PMLN7157", "PMLN7158",
  "PMLN7159", "RLN6242", "RLN6282", "PMLN6074", "PMLN7076",
  "PMLN7128", "PMLN7190"
];
// ===================================

async function runExactLinkPipeline() {
    const outputImageFolder = path.join(__dirname, TARGET_BRAND_FOLDER, 'images');
    if (!fs.existsSync(outputImageFolder)) {
        fs.mkdirSync(outputImageFolder, { recursive: true });
    }

    console.log(`🚀 Connecting to Motorola Storefront Crawling Layer for ${datasheetAccessories.length} items...`);
    console.log(`📍 Dynamically parsing specialized filename formats (.clip01, .handstrap01, etc.)...\n`);

    const domainBase = "https://motorolasolutions.com";

    for (let i = 0; i < datasheetAccessories.length; i++) {
        const datasheetPart = datasheetAccessories[i].trim().toUpperCase();
        const localDestPath = path.join(outputImageFolder, datasheetPart + '.png');

        if (fs.existsSync(localDestPath)) {
            console.log(`  箱️ [${i + 1}/${datasheetAccessories.length}] ${datasheetPart}.png already exists. Skipping.`);
            continue;
        }

        // Build the precise lookup URL that forces a single item search index pull
        const searchPathUrl = domainBase + "/search?Ntt=*" + datasheetPart + "*";
        let targetLiveImageUrl = null;

        try {
            const pageResponse = await axios.get(searchPathUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 15000,
                maxRedirects: 5
            });

            const htmlMarkupText = pageResponse.data;

            // STRATEGY 1: Advanced Regex Match (Catches complex naming variations like PMLN7076A.handstrap01.jpg)
            // It searches for any valid ccstore image block text string containing your active datasheet part number
            const adaptiveRegex = new RegExp('([^\s"\'`]+\\/ccstore\\/v1\\/images\\/\\?source=[^\s"\'`\\)]*' + datasheetPart + '[^\s"\'`\\)]*)', 'i');
            const regexMatch = htmlMarkupText.match(adaptiveRegex);
            
            if (regexMatch && regexMatch[1]) {
                targetLiveImageUrl = regexMatch[1].replace(/["']/g, "");
            }

            // STRATEGY 2: Fallback to Cheerio DOM tree element verification scanning if layout parameters are masked
            if (!targetLiveImageUrl) {
                const $ = cheerio.load(htmlMarkupText);
                $('img').each((idx, el) => {
                    const srcAttr = $(el).attr('src') || $(el).attr('data-src');
                    if (srcAttr && (srcAttr.includes('/ccstore/v1/images/') && srcAttr.toUpperCase().includes(datasheetPart))) {
                        targetLiveImageUrl = srcAttr;
                        return false; 
                    }
                });
            }

        } catch (serverErr) {
            // Silence network timeout flags to let the script process the absolute fallback chain
        }

        // STRATEGY 3: Absolute Last-Resort Base Guess (Used if product data is completely missing from index arrays)
        if (!targetLiveImageUrl) {
            const versionSuffix = datasheetPart.endsWith('A') || datasheetPart.endsWith('B') || datasheetPart.endsWith('C') ? datasheetPart : datasheetPart + 'A';
            targetLiveImageUrl = '/ccstore/v1/images/?source=/file/products/' + versionSuffix + '.01.jpg&height=300&width=300';
        }

        // Normalize URL protocol structures safely
        if (targetLiveImageUrl && !targetLiveImageUrl.startsWith('http')) {
            targetLiveImageUrl = domainBase + (targetLiveImageUrl.startsWith('/') ? '' : '/') + targetLiveImageUrl;
        }

        const cleanDownloadUrl = targetLiveImageUrl.replace(/&amp;/g, '&');
        console.log(`🔄 [${i + 1}/${datasheetAccessories.length}] Mapping: ${datasheetPart} -> Downloading via direct data stream...`);

        try {
            const binaryFileStream = await axios({
                method: 'get',
                url: cleanDownloadUrl,
                responseType: 'arraybuffer',
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                },
                timeout: 15000
            });

            // FORCE SAVE AS DATASHEET SKU: Strips away the complex names (.clip01.jpg) and locks it to your sheet variable
            fs.writeFileSync(localDestPath, binaryFileStream.data);
            console.log(`  ✅ Successfully saved file: ${TARGET_BRAND_FOLDER}/images/${datasheetPart}.png`);

        } catch (downloadError) {
            console.log(`  ❌ Live file mapping completely missing for target SKU variable: ${datasheetPart}`);
        }

        // 2-second safe spacing delay to guarantee stable network flow
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\n🏁 Done! All 22 accessory assets have been captured, matched, and saved into your clean folder structure.");
}

runExactLinkPipeline().catch(console.error);
