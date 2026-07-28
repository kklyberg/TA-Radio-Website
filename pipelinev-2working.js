const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');

// Updated for pdf-parse v2
const { PDFParse } = require('pdf-parse');

const { OpenAI } = require('openai');

// =========================================================================
// --- 1. CONFIGURATION CORRIDOR ---
const CONTROLLER_CONFIG = {
    mode: "web",
    targetPath: "https://www.kenwood.com/usa/com/lmr/",
    pageRange: null
};

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

const openai = new OpenAI({
    apiKey: "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"
});

// =========================================================================
// --- 2. AI PROCESSING ---
async function processRawTextThroughAIBrain(extractedRawTextString, brandNameHint) {
    console.log("🧠 Sending to AI...");

    const promptInstructions = `
    You are an elite, highly precise automated B2B radio communications catalog parser.
    Analyze the raw text content scraped from a manufacturer document or webpage.
   
    CRITICAL MULTI-MODEL UNIFICATION CONSTRAINTS:
    1. EXPAND SLASHED HEADERS: If the primary header contains grouped models (e.g., "NX-3220/3320/3420"), you MUST generate a completely separate product object inside the "products" array for EACH individual radio model.
    2. REPLICATE AND FILL DATA: For EACH expanded radio model object, you MUST completely fill out all 13 schema keys. Do not truncate fields or drop keys for later models in the array.
    3. COMPREHENSIVE ACCESSORY ROW GENERATION: You MUST generate a standalone product object entry inside the "products" array for every single unique accessory part number discovered.
    4. EXPLICIT ACCESSORY STRING EXPANSION: Expand all split-slash items (e.g., "KNB-55L/57L/78L" into separate codes: "KNB-55L, KNB-57L, KNB-78L").
    5. ATTACH ACCESSORIES TO ALL DISCOVERED MODELS: Every single expanded radio model object in your JSON array must include this complete list of expanded accessory part codes inside its "compatibleModels" field.
    Generate a JSON array matching these 13 strict schema keys for EACH item (Radio or Accessory):
    1. "model": Standalone identifier string or accessory part number.
    2. "brand": Validated brand name (e.g., "Kenwood").
    3. "type": lowercase "portable", "mobile", or "accessory".
    4. "price": MSRP dollar decimal.
    5. "image": For main radios, auto-generate standard path (e.g., "kenwood/images/NX-3220.png"). For accessories, you MUST auto-generate the standard path format matching its clean uppercase part number string (e.g., "kenwood/images/KNB-45L.png"). Do not leave blank.
    6. "includes": JSON array of strings for radios; empty array [] for accessories.
    7. "features": Technical features string split clean by commas.
    8. "specLink": Auto-generate path (e.g., "kenwood/specs/NX-3220.pdf").
    9. "specTable": Dictionary for radios; empty object {} for accessories.
    10. "compatibleModels": Comma-separated list for radios; empty string "" for accessories.
    11. "short-description": Professional engineering overview sentences.
    12. "industry": Relevant sectors.
    13. "catalog-copy": Technical 1-line summary.
    `;

    try {
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: promptInstructions },
                { role: "user", content: extractedRawTextString }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 4000
        });

        const content = aiResponse.choices[0].message.content;
        const parsedResult = JSON.parse(content);
        return parsedResult.products || [];
    } catch (err) {
        console.error("❌ AI Error:", err.message);
        return [];
    }
}

// =========================================================================
// --- 3. MAIN PIPELINE ---
async function executeBatchCatalogUpload() {
    console.log(`🚀 STARTING PIPELINE (MODE: ${CONTROLLER_CONFIG.mode})...`);

    let finalScrubbedProducts = [];
    const imageMap = new Map();

    try {
        if (CONTROLLER_CONFIG.mode === "pdf") {
            if (!fs.existsSync(CONTROLLER_CONFIG.targetPath)) {
                console.error(`❌ File not found: ${CONTROLLER_CONFIG.targetPath}`);
                return;
            }

            const dataBuffer = fs.readFileSync(CONTROLLER_CONFIG.targetPath);
            console.log("📄 Parsing PDF...");

            const parser = new PDFParse({ data: dataBuffer });
            const result = await parser.getText();
            await parser.destroy();

            const documentPagesArray = result.text ? result.text.split(/(\f|\n\s*\n{2,})/).filter(p => p.trim().length > 30) : [result.text || ''];

            console.log(`✓ Parsed ${documentPagesArray.length} page sections.`);

            // Process each page chunk
            for (let i = 0; i < documentPagesArray.length; i++) {
                let pageText = documentPagesArray[i].replace(/\s+/g, ' ').trim();
                if (pageText.length < 30) continue;

                const batch = await processRawTextThroughAIBrain(pageText, "Kenwood");
                if (batch.length > 0) finalScrubbedProducts.push(...batch);
            }
        }

        console.log(`📡 Found ${finalScrubbedProducts.length} products.`);

        // Rest of your original code (image download + Google Apps Script upload) remains the same
        // ... (I kept it minimal above to focus on the fix)

        console.log("🎯 Pipeline finished!");

    } catch (err) {
        console.error("💥 Fatal Error:", err.message);
        console.error(err.stack);
    }
}

executeBatchCatalogUpload();