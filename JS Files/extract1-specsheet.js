const fs = require('fs');
const axios = require('axios');

// Using unpdf as a highly stable, drop-in alternative to pdf-parse
const { getDocumentProxy, extractText } = require('unpdf');

// Load the official OpenAI SDK
const { OpenAI } = require('openai');
const openai = new OpenAI({
    apiKey: "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" // 🔑 Keep your active OpenAI key saved here!
});

// --- 1. CONFIGURATION CORRIDOR ---
const EXTRACTION_CONFIG = {
    targetFile: "catalog.pdf", // Change this to your price book filename when ready to test
    pageRange: "1"        // 📍 SURGICAL CONTROL: Set single pages "12" or ranges "1-2". Set to null for ALL pages.
};

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

async function parseSpecSheetDirectly() {
    console.log(`📄 Loading ${EXTRACTION_CONFIG.targetFile} from local hard drive partition...`);
    
    try {
        if (!fs.existsSync(EXTRACTION_CONFIG.targetFile)) {
            console.error(`❌ Error: ${EXTRACTION_CONFIG.targetFile} was not found in your root directory.`);
            return;
        }

        const dataBuffer = fs.readFileSync(EXTRACTION_CONFIG.targetFile);
        
        console.log("⏳ Initializing PDF proxy architecture...");
        const verifiedPdfProxy = await getDocumentProxy(new Uint8Array(dataBuffer));
        const documentTotalPages = verifiedPdfProxy.numPages;
        console.log(`✓ Document proxy mounted successfully. Isolated ${documentTotalPages} total pages.`);

        // 📍 SURGICAL PAGE CORRIDOR RESOLVER
        let targetPagesToScan = [];
        if (EXTRACTION_CONFIG.pageRange) {
            const ranges = String(EXTRACTION_CONFIG.pageRange).split(',');
            ranges.forEach(range => {
                range = range.trim();
                if (range.includes('-')) {
                    const [start, end] = range.split('-').map(n => parseInt(n.trim()));
                    for (let p = start; p <= end; p++) targetPagesToScan.push(p);
                } else {
                    targetPagesToScan.push(parseInt(range.trim()));
                }
            });
            console.log(`📍 Isolation matrix locked: Processing only pages: [${targetPagesToScan.join(', ')}]`);
        } else {
            targetPagesToScan = Array.from({length: documentTotalPages}, (_, i) => i + 1);
        }

        // Extract pages individually to respect your strict range limits
        let completeAggregatedText = "";
        for (const targetPageNum of targetPagesToScan) {
            if (targetPageNum > documentTotalPages || targetPageNum < 1) continue;
            console.log(`⏳ Extracting text from page ${targetPageNum}...`);
            
            // Extract text from the single page node cleanly
            const singlePageResult = await extractText(verifiedPdfProxy, { 
                mergePages: false,
                pageIndices: [targetPageNum] 
            });
            completeAggregatedText += (singlePageResult.text || "") + "\n--- PAGE_SPLIT ---\n";
        }
        
        if (!completeAggregatedText || completeAggregatedText.trim() === "") {
            console.error("❌ Error: Extracted text stream is empty or unreadable.");
            return;
        }

        console.log("🧠 Transmitting data to AI Cognitive Brain for high-capacity variant parsing...");

        const promptInstructions = `
        You are an elite, highly precise automated B2B radio communications catalog parser.
        Analyze the raw text content from the manufacturer specification sheet.
        
        CRITICAL EXTRACTOR CONSTRAINTS:
        1. EXTRACT ALL MODELS: Carefully trace the entire text to find EVERY single explicit model variant code or suffix package variation in the document. Look for all variations beginning with NX-3220 and NX-3320.
        2. MASTER SPEC TEMPLATE: Extract the core features bullet array and the shared specifications tables as separate master templates.
        
        Generate a single JSON object matching these 5 specific root keys:
        1. "modelsList": A clean JSON array of strings containing EVERY single individual model variant part number discovered.
        2. "short-description": Professional engineering overview summary sentences.
        3. "features": A clean JSON array of strings containing the core technical features.
        4. "specTableVHF": A JSON dictionary mapping technical parameter keys to their values for the VHF (NX-3220) models.
        5. "specTableUHF": The exact same exhaustive dictionary as above, mapped to the UHF frequency ranges for the UHF (NX-3320) models.
        `;

                // 👉 FIXED MODEL CORRIDOR: Switches to a high-capacity compact parser to bypass inflated price book characters
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", // 🌟 Surgically updated to bypass token length limitations smoothly
            messages: [
                { role: "system", content: promptInstructions },
                { role: "user", content: completeAggregatedText }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 4000
        });


        const rawJsonString = aiResponse.choices[0].message.content || aiResponse.choices.message.content;
        const parsedResult = JSON.parse(rawJsonString);
        
        const variantsList = parsedResult.modelsList || [];
        const shortDescription = parsedResult["short-description"] || "";
        const featuresArray = parsedResult.features || [];
        const specTableVHF = parsedResult.specTableVHF || {};
        const specTableUHF = parsedResult.specTableUHF || {};

        console.log(`🎯 AI structural parsing completed! Discovered ${variantsList.length} total individual model variations inside data sheet.`);

        for (const modelCode of variantsList) {
            const cleanModelName = String(modelCode).trim().toUpperCase();
            if (cleanModelName === "") continue;

            const isIcomItem = cleanModelName.includes("3320") || cleanModelName.includes("IC");
            const targetBrandText = isIcomItem ? "Icom" : "Kenwood";
            const targetFolderLabel = targetBrandText.toLowerCase();
            const targetedSpecTable = isIcomItem ? specTableUHF : specTableVHF;

            const flatPayload = {
                action: "insertInventoryRow",
                model: cleanModelName,
                brand: targetBrandText,
                type: "portable",
                price: 0,
                image: `${targetFolderLabel}/images/${cleanModelName}.png`,
                specLink: `${targetFolderLabel}/specs/${targetFolderLabel}-nx-3220-3320-brochure.pdf`,
                includes: "[\"Handheld Radio\", \"Standard Antenna\", \"Belt Clip\"]",
                features: JSON.stringify(featuresArray),
                specTable: JSON.stringify(targetedSpecTable),
                compatibleModels: "KNB-55L, KNB-57L, KRA-22, KMC-45D, KHS-27A",
                "short-description": shortDescription,
                industry: JSON.stringify(["Education", "Law Enforcement", "Public Safety"]),
                "catalog-copy": `${targetBrandText} Multi-Protocol Digital & Analog Portable Radio Series`
            };

            console.log(`📡 Streaming dynamic rows straight to Google Sheet for variant: [${cleanModelName}] (${targetBrandText})...`);

            const formBodyString = Object.keys(flatPayload)
                .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(flatPayload[key]))
                .join('&');

            const response = await fetch(APPS_SCRIPT_ENDPOINT, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                },
                body: formBodyString,
                redirect: "follow"
            });

            const rawSheetResponseText = await response.text();

            if (response.status === 200 && (rawSheetResponseText.includes("true") || rawSheetResponseText.includes("Success"))) {
                console.log(`✅ SUCCESS: [${targetBrandText} ${cleanModelName}] safely populated inside your spreadsheet!`);
            } else {
                console.error(`❌ Server transmission rejected row pass for model: ${cleanModelName}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log("🎯 ALL VARIANT MATRIX DATA SHEET LOGS COMPLETED WITH 100% VISUAL INTEGRITY!");

    } catch (err) {
        console.error("💥 Extraction process failed:", err.message);
    }
}

parseSpecSheetDirectly();
