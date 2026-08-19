const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');
const axios = require('axios');

const PDF_PATH = "LMR_List_May_2026.pdf";

async function downloadImage(url, destPath) {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 15000
        });

        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log("Extracting models from Kenwood price book...");

    const dataBuffer = fs.readFileSync(PDF_PATH);
    const parsed = await pdf(dataBuffer);
    const text = parsed.text;

    const modelMatches = text.match(/\b(NX|TK|TKR|NXR|KCH|KMC|KNB|KRA)-\w+\b/g) || [];
    const uniqueModels = [...new Set(modelMatches)];

    console.log(`Found ${uniqueModels.length} models.`);

    const imageDir = "kenwood/images";
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

    let successCount = 0;

    for (const model of uniqueModels) {
        const cleanModel = model.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const destPath = path.join(imageDir, `${cleanModel}.png`);

        // Try main product image
        let imageUrl = `https://www.gotoess.com/include/shared-images/kenwood-products/kenwood-${cleanModel}.webp`;

        console.log(`Trying: ${model}`);
        let success = await downloadImage(imageUrl, destPath);

        if (!success) {
            // Try accessory folder
            imageUrl = `https://www.gotoess.com/include/shared-images/kenwood-products/accessories/kenwood-${cleanModel}.webp`;
            success = await downloadImage(imageUrl, destPath);
        }

        if (success) successCount++;

        await new Promise(r => setTimeout(r, 800)); // Be respectful
    }

    console.log(`Done! Successfully downloaded ${successCount} images.`);
}

main().catch(console.error);