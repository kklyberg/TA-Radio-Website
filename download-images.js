const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // Pure local vector-to-PNG renderer

// Target folder configuration
const TARGET_DIR = path.join(__dirname, 'Motorola', 'images');

// Ensure the local target folder structure physically exists on your drive
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

/**
 * Creates a clean, pristine, native PNG file locally without hitting any websites
 */
async function generateLocalAccessoryImage(partNumber, displayName) {
    const fileName = `${partNumber.toLowerCase()}.png`;
    const localFilePath = path.join(TARGET_DIR, fileName);

    console.log(`⏳ Constructing clean hardware graphic for: ${partNumber}...`);

    // Complete, flush flat string format to guarantee perfect rendering
    const pureSvgString = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><rect x="20" y="20" width="360" height="360" fill="#ffffff" stroke="#e5e7eb" stroke-width="2" rx="12"/><circle cx="200" cy="150" r="50" fill="#eff6ff" stroke="#3b82f6" stroke-width="3" stroke-dasharray="6,4"/><path d="M185 150 L215 150 M200 135 L200 165" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/><rect x="120" y="235" width="160" height="24" fill="#dbeafe" rx="6"/><text x="200" y="251" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">MOTOROLA ACCESSORY</text><text x="200" y="300" font-family="sans-serif" font-size="26" font-weight="bold" fill="#1e3a8a" text-anchor="middle">${partNumber}</text><text x="200" y="330" font-family="sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">${displayName}</text></svg>`;

    try {
        // Convert the raw vector layout straight into a physical .png file binary stream
        await sharp(Buffer.from(pureSvgString))
            .png()
            .toFile(localFilePath);

        console.log(`✅ Successfully generated pure local PNG: ${localFilePath}`);
    } catch (err) {
        console.error(`💥 Local File Generation Failure for ${partNumber}:`, err.message);
    }
}

// =========================================================================
// RUNNER BATCH RUNNER
// =========================================================================
async function runLocalAssetGeneration() {
    console.log("🚀 Starting Local PNG Image Asset Generation Engine...");

    const localProductQueue = [
        { part: "BDN6773A", name: "Lightweight Headset" },
        { part: "HKLN4608A", name: "Swivel Earpiece" },
        { part: "PMLN7136A", name: "Surveillance Kit" },
        { part: "PMPN4529A", name: "Single Unit Charger" },
        { part: "HKKN4027A", name: "Business Radio Cable" },
        { part: "HKKN4028A", name: "Programming Cable" }
    ];

    for (const item of localProductQueue) {
        await generateLocalAccessoryImage(item.part, item.name);
    }

    console.log("\n🎯 All 6 PNG graphics successfully saved offline! Loop broken.");
}

runLocalAssetGeneration();
