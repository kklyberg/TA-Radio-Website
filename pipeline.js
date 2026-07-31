require("dotenv").config();

const fs = require("fs");
const path = require("path"); // only if you use path later
const { OpenAI } = require("openai");
const { getDocumentProxy, extractText } = require("unpdf");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse');


// =========================================================================
// CONFIGURATION
// =========================================================================
const CONTROLLER_CONFIG = {
    mode: "web",
    targetPath: "https://shop.motorolasolutions.com/search/_/N-735920568+2267871375?_gl=1*wtce7b*_gcl_au*ODU5ODY1MjE2LjE3ODQ0NTM1MDg.*_ga*ODkwODA0MDE0LjE3ODQ0NTM1MDc.*_ga_23THW5EV9N*czE3ODU0MTYzNzUkbzUkZzEkdDE3ODU0NzA0MDkkajMyJGwwJGgzMTkwNTAzNjA.",
    pageRange: null
};

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";



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
    2. "brand": Validated brand name detected or provided (e.g., "Kenwood" or "Icom" or "Motorola").
    3. "type": lowercase "portable", "mobile", or "accessory".
    4. "price": MSRP dollar decimal number.
    5. "image": Extract and return the exact link found in the "ImageURL" metadata text block that corresponds to this item. If no explicit link is found, auto-generate standard folder format matching its uppercase part number string (e.g., "[brand]/images/PARTNUMBER.png").
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
// MAIN PIPELINE (FORCE UPDATE + SELECTOR PATCH)
// =========================================================================
async function executeBatchCatalogUpload() {
    console.log(`🚀 STARTING PIPELINE (MODE: ${CONTROLLER_CONFIG.mode})...`);

    const finalScrubbedProducts = [];

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

        // -------------------- WEB MODE (CONTEXTUAL CELL MAPPER) --------------------
        if (CONTROLLER_CONFIG.mode === "web") {
            console.log("🌐 Launching headless browser engine...");
            const { chromium } = require('playwright');
            const browser = await chromium.launch({ headless: true });
            
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            const page = await context.newPage();

            try {
                console.log(`📡 Connecting to target search catalog: ${CONTROLLER_CONFIG.targetPath}`);
                await page.goto(CONTROLLER_CONFIG.targetPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                console.log("⏳ Waiting for result layouts to populate...");
                await page.waitForTimeout(8000); 

                console.log("📸 Contextually pairing text records and matching image attributes inside the DOM...");
                const unifiedTextPayload = await page.evaluate(() => {
                    const structures = document.querySelectorAll('div, li, tr, [class*="product"], [class*="item"]');
                    const cleanDataBatches = [];

                    structures.forEach(node => {
                        const rawText = node.innerText || "";
                        const partRegex = /\b[A-Z0-9]{7,12}[A-Z0-9-]*\b/;
                        
                        if (partRegex.test(rawText) && (rawText.includes('$') || rawText.toLowerCase().includes('cart'))) {
                            const foundPart = rawText.match(partRegex);
                            
                            const imageEl = node.querySelector('img') || node.parentElement?.querySelector('img');
                            const imageLink = imageEl?.getAttribute('data-src') || imageEl?.src || "";

                            if (imageLink && imageLink.startsWith('http')) {
                                cleanDataBatches.push(`ProductPart: ${foundPart}\nSourceData: ${rawText.replace(/\s+/g, ' ')}\nImageURL: ${imageLink}\n---`);
                            }
                        }
                    });

                    if (cleanDataBatches.length === 0) {
                        return document.body.innerText;
                    }

                    return cleanDataBatches.join('\n');
                });

                await context.close();
                await browser.close();

                console.log("🧠 Forwarding structured matrix blocks directly to AI...");
                const batch = await processRawTextThroughAIBrain(unifiedTextPayload, "Motorola");
                if (batch && batch.length > 0) {
                    finalScrubbedProducts.push(...batch);
                }

            } catch (scrapeError) {
                console.error("❌ Headless Scraper Error:", scrapeError.message);
                await browser.close();
                return;
            }
        }

        console.log(`📡 Found ${finalScrubbedProducts.length} products to upload.`);

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
                
                let rawBrand = item.brand || "Motorola";
                if (!rawBrand || rawBrand.toLowerCase() === "unknown") {
                    rawBrand = "Motorola";
                }
                let detectedBrand = rawBrand.trim().toLowerCase();

                               // ✅ REPAIR: Converts relative paths to absolute domain URLs before uploading
                let finalizedImageValue = item.image || "";
                
                if (finalizedImageValue && finalizedImageValue.startsWith("/")) {
                    finalizedImageValue = `https://motorolasolutions.com${finalizedImageValue}`;
                } else if (!finalizedImageValue || finalizedImageValue.toLowerCase().includes('unknown')) {
                    finalizedImageValue = `${detectedBrand}/images/${model.toLowerCase()}.png`;
                }


                const flatPayload = {
                    action: "updateInventoryContent", 
                    model: model,
                    brand: rawBrand,
                    type: item.type || "accessory",
                    price: item.price || 0,
                    image: finalizedImageValue, 
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

                console.log(`📡 Shipping row data: ${flatPayload.brand} ${flatPayload.model}`);

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

                const isSuccess = response.status === 200 && (
                    rawSheetResponseText.includes("true") || 
                    rawSheetResponseText.includes("Success") || 
                    rawSheetResponseText.includes("created") || 
                    rawSheetResponseText.includes("updated")
                );

                if (isSuccess) {
                    console.log(`✅ Loaded into Google Sheets: ${flatPayload.brand} ${flatPayload.model} (${rawSheetResponseText})`);
                } else {
                    if (rawSheetResponseText.toLowerCase().includes("not found")) {
                        console.log(`⚠️ Row missing. Attempting fresh registration for: ${model}`);
                        flatPayload.action = "createAccessory";
                        const retryFormBody = Object.keys(flatPayload).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(flatPayload[k])).join("&");
                        const retryResponse = await fetch(APPS_SCRIPT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: retryFormBody, redirect: "follow" });
                        const retryText = await retryResponse.text();
                        console.log(`✨ Creation Fallback Result: ${retryText}`);
                    } else {
                        console.error(`❌ Failed to upload: ${model}. Response: ${rawSheetResponseText}`);
                    }
                }

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
