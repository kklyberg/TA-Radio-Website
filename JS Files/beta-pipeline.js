const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const { PDFParse } = require('pdf-parse');
const { OpenAI } = require('openai');

// =========================================================================
// --- 1. CONFIGURATION ---
// =========================================================================
const CONTROLLER_CONFIG = {
    mode: "pdf",                 // "web" or "pdf"
    targetPath: "catalog.pdf",
    pageRange: null              // null = all pages, or "63-64"
};

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

const openai = new OpenAI({
    apiKey: "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"
});

// =========================================================================
// --- 2. AI PARSER (Strengthened prompt) ---
// =========================================================================
async function processRawTextThroughAIBrain(extractedRawTextString, brandNameHint) {
    console.log("🧠 TRANSMITTING DATA TO AI COGNITIVE BRAIN...");

const promptInstructions = `
You are an elite, highly precise automated B2B radio communications catalog parser.
Analyze the raw text content scraped from a manufacturer document or webpage.

CRITICAL RULES:
1. EXTRACT ONLY WHAT IS TRULY IN THE TEXT. Do not invent models, features, or specifications.
2. EXPAND GROUPED MODELS: If you see "NX-1200DV/1300DU" or similar, create a SEPARATE product object for EACH model (NX-1200DV and NX-1300DU).
3. For EVERY product you MUST fill all 13 fields. Never leave important fields empty when the information exists in the text.
4. Create a separate product entry for every unique accessory part number found.

SPECIAL INSTRUCTIONS FOR SPECIFICATIONS:
- Look carefully for specification tables or comparison tables.
- Put ALL technical parameters into the "specTable" object as key-value pairs.
- Common keys include: Frequency Range, Channel Spacing, Number of Channels, RF Power Output, Battery Life, Dimensions, Weight, Operating Temperature, IP Rating, MIL-STD, etc.
- If two models are shown side-by-side (e.g. NX-1200DV vs NX-1300DU), create separate objects and put the correct values for each model.

SPECIAL INSTRUCTIONS FOR FEATURES:
- Convert every bullet point under Features, Digital – DMR Mode, Analog – FM, Digital – NXDN Mode into individual strings in the "features" array.
- Do not summarize or shorten the feature list. Keep them detailed.

SPECIAL INSTRUCTIONS FOR INCLUDES:
- For radios, look for standard package contents if mentioned. If not clearly stated, leave as empty array [].

Required JSON structure:
{
  "products": [
    {
      "model": "string (exact model or part number)",
      "brand": "Kenwood",
      "type": "portable" | "mobile" | "accessory",
      "price": number or 0 if not shown,
      "image": "kenwood/images/MODEL.png",
      "includes": [],
      "features": ["detailed feature 1", "detailed feature 2", ...],
      "specLink": "kenwood/specs/brochure.pdf",
      "specTable": {
        "Frequency Range": "...",
        "Channel Spacing": "...",
        "Number of Channels": "...",
        "RF Power Output": "...",
        "Battery Life": "...",
        "Dimensions": "...",
        "Weight": "...",
        "Operating Temperature": "...",
        "IP Rating": "...",
        "MIL-STD": "..."
      },
      "compatibleModels": "",
      "short-description": "2-3 professional sentences based on the introduction text",
      "industry": ["Public Safety", "Business", "Education"],
      "catalog-copy": "One technical summary line"
    }
  ]
}
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
        console.error("❌ AI Parsing Loop Fault:", err.message);
        return [];
    }
}

// =========================================================================
// --- 3. MAIN PIPELINE ---
// =========================================================================
async function executeBatchCatalogUpload() {
    console.log(`🚀 INITIALIZING UNIFIED AI SCRAPER (MODE: ${CONTROLLER_CONFIG.mode.toUpperCase()})...`);

    let rawExtractedText = "";
    let brandHint = "Kenwood";
    let sourceHtmlCode = "";
    const finalScrubbedProducts = [];
    const imageMap = new Map();

    try {
        // -------------------- PDF MODE --------------------
        if (CONTROLLER_CONFIG.mode === "pdf") {
            if (!fs.existsSync(CONTROLLER_CONFIG.targetPath)) {
                console.error(`❌ CRITICAL FILE NOT FOUND: "${CONTROLLER_CONFIG.targetPath}"`);
                return;
            }

            console.log(`📄 MOUNTING MASTER PDF PROXY: "${CONTROLLER_CONFIG.targetPath}"...`);
            const dataBuffer = fs.readFileSync(CONTROLLER_CONFIG.targetPath);

            console.log(`📄 Parsing PDF with pdf-parse v2...`);
            const parser = new PDFParse({ data: dataBuffer });
            const result = await parser.getText();
            await parser.destroy();

            // Better page splitting (combines methods from both versions)
            const documentPagesArray = result.text
                ? result.text.split(/(\f|\n\s*\n{2,})/).map(p => p.trim()).filter(p => p.length > 30)
                : [result.text || ""];

            console.log(`✓ Proxy loaded. Total sections: ${documentPagesArray.length}`);

            // Page range support
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
                console.log(`📍 Page isolation locked: [${pagesToProcess.join(', ')}]`);
            } else {
                pagesToProcess = Array.from({ length: documentPagesArray.length }, (_, i) => i + 1);
            }

            for (const pageNum of pagesToProcess) {
                if (pageNum > documentPagesArray.length || pageNum < 1) continue;

                console.log(`⏳ Parsing page/section ${pageNum}...`);
                let pageTextContent = documentPagesArray[pageNum - 1] || "";
                pageTextContent = pageTextContent.replace(/\s+/g, ' ').trim();
                if (pageTextContent.length < 30) continue;

                const partialProductBatchPool = await processRawTextThroughAIBrain(pageTextContent, brandHint);
                if (partialProductBatchPool && partialProductBatchPool.length > 0) {
                    finalScrubbedProducts.push(...partialProductBatchPool);
                }
            }
        }

        // -------------------- WEB MODE --------------------
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

            // Image map scanner
            $('tr, div.accessory-row, td, li, div.grid__item, div.product-card, product-item').each((i, rowElement) => {
                const imgElement = $(rowElement).find('img').first();
                if (imgElement.length > 0) {
                    const rawSrcAttribute = $(imgElement).attr('src') || $(imgElement).attr('data-src') || '';
                    const altTextString = $(imgElement).attr('alt') || $(imgElement).attr('title') || '';

                    if (rawSrcAttribute.trim() !== "") {
                        const isolatedFileName = rawSrcAttribute.split('/').pop().trim();
                        const cleanModelKey = altTextString.replace(/KENWOOD|ICOM/gi, "").trim().toUpperCase();

                        if (isolatedFileName !== "" && !isolatedFileName.includes("logo") && cleanModelKey !== "") {
                            imageMap.set(cleanModelKey, { filename: isolatedFileName, src: rawSrcAttribute });
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

        console.log(`📡 PIPELINE PROCESSING: Streaming ${finalScrubbedProducts.length} inventory items...`);

        // Collect accessory codes for cross-reference
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

        // -------------------- UPLOAD + IMAGE HANDLING --------------------
        for (const item of finalScrubbedProducts) {
            try {
                const model = String(item.model || '').trim().toUpperCase();
                const detectedBrand = String(item.brand || "Kenwood").trim().toLowerCase();

                const imageDir = `${detectedBrand}/images`;
                if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

                let imageInfo = imageMap.get(model);
                if (imageInfo) {
                    const finalFilename = `${model.toLowerCase()}.png`;
                    const destPath = `${imageDir}/${finalFilename}`;

                    let targetAbsoluteDownloadSrc = imageInfo.src;
                    if (targetAbsoluteDownloadSrc.startsWith("//")) targetAbsoluteDownloadSrc = `https:${targetAbsoluteDownloadSrc}`;
                    else if (!targetAbsoluteDownloadSrc.startsWith("http")) {
                        targetAbsoluteDownloadSrc = `${parsedOriginUrl}/${targetAbsoluteDownloadSrc.replace(/^\/+/, "")}`;
                    }

                    try {
                        const imgRes = await axios.get(targetAbsoluteDownloadSrc, { responseType: 'stream', timeout: 10000 });
                        const writer = fs.createWriteStream(destPath);
                        imgRes.data.pipe(writer);
                        await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                        console.log(`💾 Saved: ${finalFilename}`);
                        item.image = `${detectedBrand}/images/${finalFilename}`;
                    } catch (dlErr) {
                        item.image = "images/radio-placeholder.png";
                    }
                } else {
                    item.image = `${detectedBrand}/images/${model.toLowerCase()}.png`;
                }

                // Build payload
                const flatPayload = {
                    action: "insertInventoryRow",
                    model: model,
                    brand: item.brand || "Kenwood",
                    type: item.type || "portable",
                    price: item.price || 0,
                    image: item.image,
                    specLink: item.specLink || "",
                    includes: Array.isArray(item.includes) ? JSON.stringify(item.includes) : (item.includes || "[]"),
                    features: Array.isArray(item.features) ? JSON.stringify(item.features) : (item.features || "[]"),
                    specTable: typeof item.specTable === "object" ? JSON.stringify(item.specTable) : (item.specTable || "{}"),
                    compatibleModels: String(item.compatibleModels || "").trim() !== "" ? item.compatibleModels : masterAccessoryCodesList,
                    "short-description": item["short-description"] || "",
                    industry: Array.isArray(item.industry) ? JSON.stringify(item.industry) : (item.industry || "[]"),
                    "catalog-copy": item["catalog-copy"] || ""
                };

                const formBodyString = Object.keys(flatPayload)
                    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(flatPayload[key]))
                    .join('&');

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
                    console.log(`✅ DATABASE LOADED: [${flatPayload.brand} ${flatPayload.model}]`);
                } else {
                    console.error(`❌ TRANSMISSION DROPPED FOR: ${model}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (itemErr) {
                console.error(`💥 Error on item:`, itemErr.message);
            }
        }

        console.log("🎯 ALL AUTOMATION CATALOG MATRICES FULLY PROCESSED!");

    } catch (globalError) {
        console.error("💥 SYSTEM RUN ENCOUNTERED FATAL BLOCK:", globalError.message);
        console.error(globalError.stack);
    }
}

executeBatchCatalogUpload();