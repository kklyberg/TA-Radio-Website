const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse');
const { OpenAI } = require('openai');

// =========================================================================
// CONFIGURATION
// =========================================================================
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
// AI PARSER
// =========================================================================
async function processRawTextThroughAIBrain(extractedRawTextString, brandNameHint) {
    console.log("🧠 Sending to AI...");



  const promptInstructions = `
    You are an elite, highly precise automated B2B radio communications catalog parser. 
    Analyze the raw text content scraped from a manufacturer document or webpage.
    
    CRITICAL MULTI-MODEL UNIFICATION CONSTRAINTS:
    1. EXTRACT WHAT IS TRULY THERE: Do not hallucinate or use old template data. Scan the text to find the exact radio models or accessory suffixes physically printed on these pages.
    2. EXPAND GROUPED HEADERS: If a header contains grouped models (e.g., "NX-1200/1300"), you MUST generate a completely separate product object inside the "products" array for EACH individual radio model code variant.
    3. REPLICATE AND FILL DATA: For EACH expanded radio model object, you MUST completely fill out all 13 schema keys. Do not truncate fields or drop keys.
    4. COMPREHENSIVE ACCESSORY ROW GENERATION: Generate a standalone product object entry inside the "products" array for every unique accessory part number discovered.

    Generate a JSON array matching these 13 strict schema keys for EACH item (Radio or Accessory):
    1. "model": Standalone identifier string or accessory part number (e.g., "NX-1200K").
    2. "brand": Validated brand name detected or provided (e.g., "Kenwood" or "Icom").
    3. "type": lowercase "portable", "mobile", or "accessory".
    4. "price": MSRP dollar decimal number.
    5. "image": Auto-generate standard folder format matching its uppercase part number string (e.g., "[brand]/images/NX-1200K.png"). Do not leave blank.
    6. "includes": JSON array of strings for radios; empty array [] for accessories.
    7. "features": JSON array of technical feature strings. Do not return flat comma strings.
    8. "specLink": Auto-generate path tracking format (e.g., "[brand]/specs/brochure.pdf").
    9. "specTable": Dictionary of precise technical parameter keys and values for radios; empty object {} for accessories. Populate fields like "Frequency Range", "Number of Channels", "RF Power Output", etc.
    10. "compatibleModels": Comma-separated list of accessory part codes for radios; empty string "" for accessories.
    11. "short-description": Professional engineering overview summary sentences.
    12. "industry": Array containing target sectors ("Education", "Law Enforcement", "Public Safety", etc.).
    13. "catalog-copy": Technical 1-line summary statement.
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
// MAIN PIPELINE
// =========================================================================
async function executeBatchCatalogUpload() {
    console.log(`🚀 STARTING PIPELINE (MODE: ${CONTROLLER_CONFIG.mode})...`);

    const finalScrubbedProducts = [];
    const imageMap = new Map();

    try {
        // -------------------- PDF MODE --------------------
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

            // Simple split into sections
            const documentPagesArray = result.text
                ? result.text.split(/(\f|\n\s*\n{2,})/).filter(p => p.trim().length > 30)
                : [result.text || ""];

            console.log(`✓ Parsed ${documentPagesArray.length} page sections.`);

            for (let i = 0; i < documentPagesArray.length; i++) {
                const pageText = documentPagesArray[i].replace(/\s+/g, " ").trim();
                if (pageText.length < 30) continue;

                console.log(`⏳ Processing section ${i + 1}...`);
                const batch = await processRawTextThroughAIBrain(pageText, "Kenwood");
                if (batch && batch.length > 0) {
                    finalScrubbedProducts.push(...batch);
                }
            }
        }

        console.log(`📡 Found ${finalScrubbedProducts.length} products.`);

        // -------------------- PREPARE ACCESSORY LIST --------------------
        const masterAccessoryCodesList = finalScrubbedProducts
            .filter(p => String(p.type || "").toLowerCase() === "accessory")
            .map(p => String(p.model || "").trim().toUpperCase())
            .filter((val, idx, self) => val && self.indexOf(val) === idx)
            .join(", ");

        // -------------------- UPLOAD EACH PRODUCT --------------------
        for (const item of finalScrubbedProducts) {
            try {
                const model = String(item.model || "").trim().toUpperCase();
                const detectedBrand = String(item.brand || "Kenwood").trim().toLowerCase();

                // Image path (placeholder for now)
                item.image = `${detectedBrand}/images/${model.toLowerCase()}.png`;

                const flatPayload = {
                    action: "insertInventoryRow",
                    model: model,
                    brand: item.brand || "Kenwood",
                    type: item.type || "portable",
                    price: item.price || 0,
                    image: item.image,
                    specLink: item.specLink || "",
                    includes: Array.isArray(item.includes) ? JSON.stringify(item.includes) : "[]",
                    features: Array.isArray(item.features) ? JSON.stringify(item.features) : "[]",
                    specTable: typeof item.specTable === "object" ? JSON.stringify(item.specTable) : "{}",
                    compatibleModels: item.compatibleModels || masterAccessoryCodesList,
                    "short-description": item["short-description"] || "",
                    industry: Array.isArray(item.industry) ? JSON.stringify(item.industry) : "[]",
                    "catalog-copy": item["catalog-copy"] || ""
                };

                const formBodyString = Object.keys(flatPayload)
                    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(flatPayload[key]))
                    .join("&");

                const response = await fetch(APPS_SCRIPT_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0"
                    },
                    body: formBodyString,
                    redirect: "follow"
                });

                const rawSheetResponseText = await response.text();

                if (response.status === 200 && (rawSheetResponseText.includes("true") || rawSheetResponseText.includes("Success"))) {
                    console.log(`✅ Loaded: ${flatPayload.brand} ${flatPayload.model}`);
                } else {
                    console.error(`❌ Failed to upload: ${model}`);
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 800));

            } catch (itemErr) {
                console.error(`💥 Error processing item:`, itemErr.message);
            }
        }

        console.log("🎯 Pipeline finished!");

    } catch (err) {
        console.error("💥 Fatal Error:", err.message);
        console.error(err.stack);
    }
}

executeBatchCatalogUpload();