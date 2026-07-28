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
    mode: "pdf",
    targetPath: "catalog.pdf",
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
You are an elite B2B radio communications catalog parser.
Analyze the raw text and extract products.

Return a valid JSON object with this structure:
{
  "products": [
    {
      "model": "string",
      "brand": "string",
      "type": "portable" or "mobile" or "accessory",
      "price": number,
      "image": "string",
      "includes": [],
      "features": [],
      "specLink": "string",
      "specTable": {},
      "compatibleModels": "string",
      "short-description": "string",
      "industry": [],
      "catalog-copy": "string"
    }
  ]
}

Rules:
- Expand grouped models (e.g. NX-1200/1300) into separate products
- Fill all fields for every product
- Do not invent data that is not present
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