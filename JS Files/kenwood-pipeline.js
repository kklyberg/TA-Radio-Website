const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');
const axios = require('axios');

const SPEC_SHEET = "kenwood-nx-3220-3320-brochure.pdf";
const PRODUCTS_FILE = "kenwood-products.json";

async function searchImageForModel(model) {
    const cleanModel = model.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Primary source: gotoess.com
    const directUrl = `https://www.gotoess.com/include/shared-images/kenwood-products/kenwood-${cleanModel}.webp`;
    
    try {
        const res = await axios.head(directUrl, { timeout: 5000 });
        if (res.status === 200) {
            console.log(`✓ Found official image for ${model}`);
            return directUrl;
        }
    } catch (e) {}

    // Fallback for accessories or other models
    const accessoryUrl = `https://www.gotoess.com/include/shared-images/kenwood-products/accessories/kenwood-${cleanModel}.webp`;
    try {
        const res = await axios.head(accessoryUrl, { timeout: 5000 });
        if (res.status === 200) {
            console.log(`✓ Found accessory image for ${model}`);
            return accessoryUrl;
        }
    } catch (e) {}

    // Final fallback
    console.log(`⚠️ No image found for ${model}, using placeholder`);
    return "images/radio-placeholder.png";
}

async function downloadImage(url, destPath) {
    try {
        console.log(`Attempting download from: ${url}`);
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 15000
        });

        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✓ Saved: ${destPath}`);
                resolve(true);
            });
            writer.on('error', reject);
        });
        return true;
    } catch (e) {
        console.warn(`✗ Download failed for ${destPath}:`, e.message);
        return false;
    }
}

async function main() {
    console.log("Loading products from price book...");
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));

    console.log(`Loaded ${products.length} products.`);

    const dataBuffer = fs.readFileSync(SPEC_SHEET);
    const parsed = await pdf(dataBuffer);

    console.log(`Extracted spec sheet (${parsed.numpages} pages).`);

    const imageDir = "kenwood/images";
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

    let success = 0;

    for (let i = 0; i < Math.min(30, products.length); i++) {
        const item = products[i];
        const model = item.model;

        const cleanModel = model.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const destPath = path.join(imageDir, `${cleanModel}.png`);

        console.log(`Processing: ${model}`);
        const imageUrl = await searchImageForModel(model);
        const ok = await downloadImage(imageUrl, destPath);

        if (ok) {
            item.image = `kenwood/images/${cleanModel}.png`;
            success++;
        }

        await new Promise(r => setTimeout(r, 1200)); // Longer delay
    }

    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    console.log(`Spec stage complete! Successfully downloaded ${success} images.`);
}

main().catch(console.error);