// =========================================================================
// T.A. RADIO MASTER AUTOMATION PIPELINE (PART 1 - TARGETED CORE ENGINE)
// =========================================================================
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');
const cheerio = require('cheerio');
const axios = require('axios');
const OpenAI = require('openai');

// --- 1. CORE PIPELINE MASTER CONFIGBOARD SYSTEM ---
const CONTROLLER_CONFIG = {
    mode: "web", // Activated web scraping engine
    targetPath: "https://www.kenwood.com/usa/com/lmr/", // Your pristine web target asset link
    pageRange: null, // ← CHANGE THIS TO THE PAGES YOU WANT (e.g. "15", "20-25", "5-12")
    discountPercentage: 0 // Subtracts a precise 20% off listed MSRP
};

const OPENAI_API_KEY = "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";
const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- 2. COGNITIVE ENGINE PARSER BLOCKS ---
async function processRawTextThroughAIBrain(extractedRawTextString, brandNameHint) {
    console.log("🧠 TRANSMITTING DATA TO AI COGNITIVE BRAIN FOR STRUCTURAL CLEANUP...");
   
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
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptInstructions },
                { role: "user", content: extractedRawTextString }
            ],
            response_format: { type: "json_object" }
        });

        const parsedResult = JSON.parse(aiResponse.choices[0].message.content);
        return parsedResult.products || [];
    } catch (err) {
        console.error("❌ AI Parsing Loop Fault:", err.message);
        return [];
    }
}

// --- 3. UNIFIED EXTRACTION EXECUTION MATRIX ---
async function executeBatchCatalogUpload() {
    console.log(`🚀 INITIALIZING UNIFIED AI SCRAPER (MODE: ${CONTROLLER_CONFIG.mode.toUpperCase()})...`);
    let rawExtractedText = "";
    let brandHint = "Kenwood";
    let sourceHtmlCode = "";
    const finalScrubbedProducts = [];
    const imageMap = new Map();

    try {
        if (CONTROLLER_CONFIG.mode === "pdf") {
            if (!fs.existsSync(CONTROLLER_CONFIG.targetPath)) {
                console.error(`❌ CRITICAL FILE NOT FOUND: "${CONTROLLER_CONFIG.targetPath}"`);
                return;
            }
            console.log(`📄 EXTRACTING CHARACTERS FROM LOCAL PDF: "${CONTROLLER_CONFIG.targetPath}"...`);
            const dataBuffer = fs.readFileSync(CONTROLLER_CONFIG.targetPath);
           
            const parsedPDF = await pdf(dataBuffer, {
                pagerender: function(pageData) {
                    return pageData.getTextContent().then(function(textContent) {
                        let lastY, text = '';
                        for (let item of textContent.items) {
                            if (lastY == item.transform || !lastY) {
                                text += item.str + ' ';
                            } else {
                                text += '\n' + item.str + ' ';
                            }
                            lastY = item.transform;
                        }
                        return '--- PAGE_SPLIT_MARKER ---' + text;
                    });
                }
            });
            const documentPagesArray = parsedPDF.text.split('--- PAGE_SPLIT_MARKER ---').filter(p => p.trim() !== '');
            console.log(`✓ FILE INGESTED: Isolated ${documentPagesArray.length} unique pages for processing.`);
            const globalTextLower = parsedPDF.text.toLowerCase();
            if (globalTextLower.includes("icom")) brandHint = "Icom";
            if (globalTextLower.includes("motorola")) brandHint = "Motorola";
            let pagesToProcess = [];
            if (CONTROLLER_CONFIG.pageRange) {
                const ranges = String(CONTROLLER_CONFIG.pageRange).split(',');
                ranges.forEach(range => {
                    range = range.trim();
                    if (range.includes('-')) {
                        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
                        for (let p = start; p <= end; p++) pagesToProcess.push(p);
                    } else {
                        pagesToProcess.push(parseInt(range.trim()));
                    }
                });
                console.log(`📍 Processing only pages: ${pagesToProcess.join(', ')}`);
            } else {
                pagesToProcess = Array.from({length: documentPagesArray.length}, (_, i) => i + 1);
            }
            for (let idx = 0; idx < documentPagesArray.length; idx++) {
                const pageNum = idx + 1;
                if (!pagesToProcess.includes(pageNum)) continue;
                const pageTextContent = documentPagesArray[idx].trim();
                if (pageTextContent.length < 50) {
                    console.log(`ℹ️ Skipping page ${pageNum} (too short)`);
                    continue;
                }
                console.log(`⏳ Processing page ${pageNum}...`);
                const partialProductBatchPool = await processRawTextThroughAIBrain(pageTextContent, brandHint);
                if (partialProductBatchPool && partialProductBatchPool.length > 0) {
                    finalScrubbedProducts.push(...partialProductBatchPool);
                }
            }
        }
        else if (CONTROLLER_CONFIG.mode === "web") {
            console.log(`🌐 CONNECTING TO LIVE WEBSITE URL: "${CONTROLLER_CONFIG.targetPath}"...`);
           
            const networkIdentityHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            };
            const response = await axios.get(CONTROLLER_CONFIG.targetPath, {
                headers: networkIdentityHeaders,
                timeout: 15000
            });
            sourceHtmlCode = response.data;
            let $ = cheerio.load(sourceHtmlCode);

            // Delay for dynamic content
            await new Promise(resolve => setTimeout(resolve, 2500));

            // YOUR WORKING SELECTOR FOR IMAGES
            $('tr, div.accessory-row, td, li, div.grid__item, div.product-card, product-item').each((i, rowElement) => {
                const imgElement = $(rowElement).find('img').first();
                if (imgElement.length > 0) {
                    const rawSrcAttribute = $(imgElement).attr('src') || $(imgElement).attr('data-src') || $(imgElement).attr('lazy-src') || '';
                    const altTextString = $(imgElement).attr('alt') || $(imgElement).attr('title') || '';
                   
                    if (rawSrcAttribute.trim() !== "") {
                        const isolatedFileName = rawSrcAttribute.split('/').pop().trim();
                        const cleanModelKey = altTextString.replace(/KENWOOD/gi, "").trim().toUpperCase();
                       
                        if (isolatedFileName !== "" && !isolatedFileName.includes("side-banner") && !isolatedFileName.includes("logo")) {
                            if (cleanModelKey !== "") {
                                imageMap.set(cleanModelKey, { filename: isolatedFileName, src: rawSrcAttribute });
                            }
                        }
                    }
                }
            });

            $('script, style, nav, footer').remove();
            rawExtractedText = $('body').text().replace(/\s+/g, ' ');

            if (CONTROLLER_CONFIG.targetPath.toLowerCase().includes("kenwood")) brandHint = "Kenwood";
            if (CONTROLLER_CONFIG.targetPath.toLowerCase().includes("icom")) brandHint = "Icom";
            if (CONTROLLER_CONFIG.targetPath.toLowerCase().includes("motorola")) brandHint = "Motorola";

            const webProductBatchPool = await processRawTextThroughAIBrain(rawExtractedText, brandHint);
            if (webProductBatchPool && webProductBatchPool.length > 0) {
                finalScrubbedProducts.push(...webProductBatchPool);
            }
        }

        console.log(`📡 STREAMING ${finalScrubbedProducts.length} AI-STRUCTURED PRODUCTS TO GOOGLE APPS TUNNEL...`);

        // === DOWNLOAD IMAGES (Respects targetPath) ===
        const imageDir = 'kenwood/images';
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }
        console.log(`📥 Downloading images from ${CONTROLLER_CONFIG.targetPath} for ${finalScrubbedProducts.length} items...`);

        for (const item of finalScrubbedProducts) {
            try {
                const model = String(item.model || item.Model || '').trim().toUpperCase();
                if (!model) continue;

                let imageInfo = imageMap.get(model);
                if (!imageInfo) {
                    for (const [key, info] of imageMap.entries()) {
                        if (model.includes(key) || key.includes(model)) {
                            imageInfo = info;
                            break;
                        }
                    }
                }

                if (imageInfo) {
                    let cleanFilename = imageInfo.filename.replace(/^kenwood-/i, '');
                    const baseName = cleanFilename.replace(/\.\w+$/, '');
                    const finalFilename = `${baseName}.png`;
                    const destPath = `${imageDir}/${finalFilename}`;

                    let targetUrl = imageInfo.src;
                    if (targetUrl && !targetUrl.startsWith('http')) {
                        // Use the origin from the targetPath
                        const origin = new URL(CONTROLLER_CONFIG.targetPath).origin;
                        targetUrl = `${origin}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                    }

                    try {
                        const imgRes = await axios.get(targetUrl, {
                            responseType: 'arraybuffer',
                            timeout: 15000,
                            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
                        });

                        fs.writeFileSync(destPath, imgRes.data);

                        console.log(`💾 Saved: ${finalFilename} → ${model}`);
                        item.image = `kenwood/images/${finalFilename}`;
                    } catch (dlErr) {
                        console.warn(`⚠️ Image download failed for ${model}:`, dlErr.message);
                        item.image = "images/radio-placeholder.png";
                    }
                } else {
                    item.image = "images/radio-placeholder.png";
                }
            } catch (itemErr) {
                console.error(`💥 Image processing fault for ${item.model}:`, itemErr.message);
            }
        }

        console.log("🎯 BATCH AUTOMATION PIPELINE RUN WRAPPED UP!");
    } catch (globalError) {
        console.error("💥 SYSTEM PIPELINE ERROR:", globalError.message);
    }
}

executeBatchCatalogUpload();