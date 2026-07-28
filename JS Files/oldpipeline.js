const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');

const { PDFParse } = require('pdf-parse');  // Updated to v2

const { OpenAI } = require('openai');

// =========================================================================
// --- 1. CONFIGURATION CORRIDOR (YOUR MASTER CONTROL PORTS) ---
// =========================================================================
const CONTROLLER_CONFIG = {
    mode: "web",                 // 🌐 "web" or 📄 "pdf"
    targetPath: "https://www.icomamerica.com/lineup/products/IC-FR5300_NXDN/",    // Live URL string or local document path text
    pageRange: null              // Set to null for ALL pages, or isolate pages like "63-64"
};

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

const openai = new OpenAI({
    apiKey: "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" // 🔑 Keep your active OpenAI key saved here!
});
// =========================================================================
// --- 2. COGNITIVE ENGINE PARSER BLOCKS (EXHAUSTIVE SCHEMATIC BLUEPRINT) ---
// =========================================================================
async function processRawTextThroughAIBrain(extractedRawTextString, brandNameHint) {
    console.log("🧠 TRANSMITTING DATA TO AI COGNITIVE BRAIN FOR STRUCTURAL CLEANUP...");
    
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
            model: "gpt-4o-mini", // Compact high-efficiency processing engine
            messages: [
                { role: "system", content: promptInstructions },
                { role: "user", content: extractedRawTextString }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 4000
        });

        const parsedResult = JSON.parse(aiResponse.choices[0].message.content);
        return parsedResult.products || [];
    } catch (err) {
        console.error("❌ AI Parsing Loop Fault:", err.message);
        return [];
    }
}
// =========================================================================
// --- 3. UNIFIED EXTRACTION EXECUTION MATRIX (THE ENGINE CORRIDOR) ---
// =========================================================================
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
            console.log(`📄 MOUNTING MASTER PDF PROXY: "${CONTROLLER_CONFIG.targetPath}"...`);
            const dataBuffer = fs.readFileSync(CONTROLLER_CONFIG.targetPath);
            
            console.log(`📄 Parsing PDF with pdf-parse v2...`);

            // === v2 PARSER ===
            const parser = new PDFParse({ data: dataBuffer });
            const result = await parser.getText();
            await parser.destroy();

            // Keep original page-split style as close as possible
            const documentPagesArray = result.text
                ? result.text.split(/\f/).map(p => p.trim()).filter(p => p.length > 0)
                : [result.text || ""];

            console.log(`✓ Proxy loaded. Total file size span: ${documentPagesArray.length} pages.`);

            // RESOLVE TARGET PAGE CHUNKS CHOSEN BY CONTROLLER CONFIG NATIVELY
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
                console.log(`📍 Page isolation matrix locked: [${pagesToProcess.join(', ')}]`);
            } else {
                pagesToProcess = Array.from({length: documentPagesArray.length}, (_, i) => i + 1);
            }

            // Iterate down chosen pages individually to keep context clean
            for (const pageNum of pagesToProcess) {
                if (pageNum > documentPagesArray.length || pageNum < 1) continue;
                console.log(`⏳ Parsing text strings locally from page node ${pageNum}...`);
                
                // Pulls text via your original index array offset natively [INDEX]
                let pageTextContent = documentPagesArray[pageNum - 1] || "";
                
                // Clean excessive internal whitespace junk to keep payload safe
                pageTextContent = pageTextContent.replace(/\s+/g, ' ').trim();
                if (pageTextContent.length < 30) continue;

                // Fire page chunk directly through the cognitive prompts engine
                const partialProductBatchPool = await processRawTextThroughAIBrain(pageTextContent, brandHint);
                if (partialProductBatchPool && partialProductBatchPool.length > 0) {
                    finalScrubbedProducts.push(...partialProductBatchPool);
                }
            }
        } 
        else if (CONTROLLER_CONFIG.mode === "web") {
            console.log(`🌐 CONNECTING TO LIVE WEBSITE URL: "${CONTROLLER_CONFIG.targetPath}"...`);
            
            const networkIdentityHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            };

            const response = await axios.get(CONTROLLER_CONFIG.targetPath, { 
                headers: networkIdentityHeaders,
                timeout: 15000
            });
            sourceHtmlCode = response.data;

            let $ = cheerio.load(sourceHtmlCode);

            // ACCORDION SCANNER LOOKS FOR IMAGE MAPS NATIVELY [INDEX]
            $('tr, div.accessory-row, td, li, div.grid__item, div.product-card, product-item').each((i, rowElement) => {
                const imgElement = $(rowElement).find('img').first();
                if (imgElement.length > 0) {
                    const rawSrcAttribute = $(imgElement).attr('src') || $(imgElement).attr('data-src') || '';
                    const altTextString = $(imgElement).attr('alt') || $(imgElement).attr('title') || '';
                    
                    if (rawSrcAttribute.trim() !== "") {
                        const isolatedFileName = rawSrcAttribute.split('/').pop().trim();
                        const cleanModelKey = altTextString.replace(/KENWOOD|ICOM/gi, "").trim().toUpperCase();
                        
                        if (isolatedFileName !== "" && !isolatedFileName.includes("logo")) {
                            if (cleanModelKey !== "") {
                                imageMap.set(cleanModelKey, { filename: isolatedFileName, src: rawSrcAttribute });
                            }
                        }
                    }
                }
            });

            $('script, style, nav, footer').remove(); 
            rawExtractedText = $('body').text().replace(/\s+/g, ' '); 

            const webProductBatchPool = await processRawTextThroughAIBrain(rawExtractedText, brandHint);
            if (webProductBatchPool && webProductBatchPool.length > 0) {
                finalScrubbedProducts.push(...webProductBatchPool);
            }
        }
        console.log(`📡 PIPELINE PROCESSING: Streaming ${finalScrubbedProducts.length} true inventory items...`);

        // PRE-COLLECT ALL ACCESSORY MODEL CODES FOR CROSS-REFERENCE COUPLING LINKS
        const masterAccessoryCodesList = finalScrubbedProducts
            .filter(p => String(p.type || "").toLowerCase().trim() === "accessory")
            .map(p => String(p.model || "").trim().toUpperCase())
            .filter((val, idx, self) => val !== "" && self.indexOf(val) === idx)
            .join(", ");

        let parsedOriginUrl = "https://gotoess.com";
        try {
            if (CONTROLLER_CONFIG.targetPath.startsWith("http")) {
                parsedOriginUrl = new URL(CONTROLLER_CONFIG.targetPath).origin;
            }
        } catch (e) {}

        // =========================================================================
        // --- 4. THE ASSET DOWNLOADER & FORMAT COMPRESSOR ENGINE ---
        // =========================================================================
        for (const item of finalScrubbedProducts) {
            try {
                const model = String(item.model || '').trim().toUpperCase();
                const detectedBrand = String(item.brand || "Kenwood").trim().toLowerCase();
                
                // Establish dynamic image folder target path loops natively [INDEX]
                const imageDir = `${detectedBrand}/images`;
                if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

                let imageInfo = imageMap.get(model);
                if (imageInfo) {
                    const finalFilename = `${model.toLowerCase()}.png`;
                    const destPath = `${imageDir}/${finalFilename}`;

                    let targetAbsoluteDownloadSrc = imageInfo.src;
                    if (targetAbsoluteDownloadSrc.startsWith("//")) targetAbsoluteDownloadSrc = `https:${targetAbsoluteDownloadSrc}`;
                    else if (!targetAbsoluteDownloadSrc.startsWith("http")) targetAbsoluteDownloadSrc = `${parsedOriginUrl}/${targetAbsoluteDownloadSrc.replace(/^\/+/, "")}`;

                    try {
                        const imgRes = await axios.get(targetAbsoluteDownloadSrc, { responseType: 'stream', timeout: 10000 });
                        const writer = fs.createWriteStream(destPath);
                        imgRes.data.pipe(writer);
                        await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                        console.log(`💾 Saved local asset conversion: ${finalFilename} → ${model}`);
                        item.image = `${detectedBrand}/images/${finalFilename}`;
                    } catch (dlErr) {
                        item.image = "images/radio-placeholder.png";
                    }
                } else {
                    item.image = `${detectedBrand}/images/${model.toLowerCase()}.png`;
                }

                // =========================================================================
                // --- 5. SECURE NATIVE STREAM TRANSMITTER (CLEARS ALL REDIRECTS) ---
                // =========================================================================
                const flatPayload = {
                    action: "insertInventoryRow",
                    model: model,
                    brand: item.brand || "Kenwood",
                    type: item.type || "portable",
                    price: item.price || 0,
                    image: item.image,
                    specLink: item.specLink || "",
                    includes: typeof item.includes === 'object' ? JSON.stringify(item.includes) : (item.includes || "[]"),
                    features: typeof item.features === 'object' ? JSON.stringify(item.features) : (item.features || "[]"),
                    specTable: typeof item.specTable === 'object' ? JSON.stringify(item.specTable) : (item.specTable || "{}"),
                    compatibleModels: String(item.compatibleModels || "").trim() !== "" ? item.compatibleModels : masterAccessoryCodesList,
                    "short-description": item["short-description"] || "",
                    industry: typeof item.industry === 'object' ? JSON.stringify(item.industry) : (item.industry || "[]"),
                    "catalog-copy": item["catalog-copy"] || ""
                };

                const formBodyString = Object.keys(flatPayload)
                    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(flatPayload[key]))
                    .join('&');

                // Native fetch handles Google redirects natively without losing data strings [INDEX]
                const response = await fetch(APPS_SCRIPT_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
                    body: formBodyString,
                    redirect: "follow"
                });

                const rawSheetResponseText = await response.text();

                if (response.status === 200 && (rawSheetResponseText.includes("true") || rawSheetResponseText.includes("Success"))) {
                    console.log(`✅ DATABASE LOADED: [${flatPayload.brand} ${flatPayload.model}] safely populated!`);
                } else {
                    console.error(`❌ TRANSMISSION DROPPED FOR: ${model}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (itemErr) {
                console.error(`💥 Loop iteration processing error on item:`, itemErr.message);
            }
        }
        console.log("🎯 ALL AUTOMATION CATALOG MATRICES FULLY PROCESSED!");
    } catch (globalError) {
        console.error("💥 SYSTEM RUN ENCOUNTERED FATAL BLOCK:", globalError.message);
    }
}

executeBatchCatalogUpload();