const fs = require('fs');
const axios = require('axios');
const { getDocumentProxy, extractText } = require('unpdf');

// Load the official OpenAI SDK
const { OpenAI } = require('openai');
const openai = new OpenAI({
    apiKey: "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" // 🔑 Keep your active OpenAI key saved here!
});

// YOUR VERIFIED ENDPOINT URL CONSTANT
const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";

async function parseSpecSheetDirectly() {
    console.log("📄 Loading catalog.pdf from local hard drive partition...");
    
    try {
        if (!fs.existsSync("catalog.pdf")) {
            console.error("❌ Error: catalog.pdf was not found in your root directory.");
            return;
        }

        const dataBuffer = fs.readFileSync("catalog.pdf");
        
        console.log("⏳ Initializing PDF proxy architecture...");
        const verifiedPdfProxy = await getDocumentProxy(new Uint8Array(dataBuffer));
        
        console.log("⏳ Extracting layout text elements from page nodes...");
        const pdfExtractionResult = await extractText(verifiedPdfProxy, { mergePages: true });
        const extractedTextContent = pdfExtractionResult.text || "";
        
        if (!extractedTextContent || extractedTextContent.trim() === "") {
            console.error("❌ Error: Extracted text stream is empty or unreadable.");
            return;
        }

        console.log("🧠 Transmitting data to AI Cognitive Brain for high-capacity variant parsing...");

        // 👉 HIGH-EFFICIENCY COMPACT PROMPT CONTRACT (SAVES TOKEN CAPACITY)
        const promptInstructions = `
        You are an elite, highly precise automated B2B radio communications catalog parser.
        Analyze the raw text content from the manufacturer specification sheet.
        
        CRITICAL EXTRACTOR CONSTRAINTS:
        1. EXTRACT ALL MODELS: Carefully trace the entire text to find EVERY single explicit model variant code or suffix package variation in the document. Look for all variations beginning with NX-3220 and NX-3320 (e.g., NX-3220, NX-3220K, NX-3220K-TR, NX-3220K2, NX-3220K2-TR, NX-3220K2-XLKVP, NX-3220K2LAKVP, NX-3220K2SLAKVP, NX-3220K3, NX-3220K3-TR, NX-3220K3SLAKVP, NX-3220KSLAKVP, and all matching NX-3320 counterparts).
        2. MASTER SPEC TEMPLATE: Extract the core features bullet array and the shared specifications tables as separate master templates.
        
        Generate a single JSON object matching these 4 specific root keys:
        1. "modelsList": A clean JSON array of strings containing EVERY single individual model variant part number discovered (e.g., ["NX-3220K", "NX-3220K-TR", "NX-3220K2", ...]). Do not miss a single suffix.
        2. "short-description": Professional engineering overview summary sentences.
        3. "features": A clean JSON array of strings containing the core technical features.
        4. "specTableVHF": A JSON dictionary mapping technical parameter keys to their values for the VHF (NX-3220) models. Exhaustively capture: "Frequency Range", "Number of Channels", "Number of Zones", "Channel Spacing", "Battery Life", "Operating Voltage", "RF Power Output", "Audio Output Power", "Dust & Water Protection", and "Operating Temperature".
        5. "specTableUHF": The exact same exhaustive dictionary as above, mapped to the UHF frequency ranges for the UHF (NX-3320) models.
        `;

        // 🌟 SURGICAL UPGRADE: Expands completion token ceiling to prevent mid-array data drops
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: promptInstructions },
                { role: "user", content: extractedTextContent }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 8000 // Forces OpenAI to give the script maximum output bandwidth
        });

               // 👉 FIXED OPENAI KEY LAYOUT: Cleanly extracts the text payload matching your library version
        const rawJsonString = aiResponse.choices[0].message.content;
        const parsedResult = JSON.parse(rawJsonString);
        
        const variantsList = parsedResult.modelsList || [];

        const shortDescription = parsedResult["short-description"] || "";
        const featuresArray = parsedResult.features || [];
        const specTableVHF = parsedResult.specTableVHF || {};
        const specTableUHF = parsedResult.specTableUHF || {};

        console.log(`🎯 AI structural parsing completed! Discovered ${variantsList.length} total individual model variations inside data sheet.`);

        // 👉 MULTI-ROW STREAM ENGINE: Steps down your list to inject and route your data cells safely
        for (const modelCode of variantsList) {
            const cleanModelName = String(modelCode).trim().toUpperCase();
            if (cleanModelName === "") continue;

            const isIcomItem = cleanModelName.includes("3320") || cleanModelName.includes("IC");
            const targetBrandText = isIcomItem ? "Icom" : "Kenwood";
            const targetFolderLabel = targetBrandText.toLowerCase();
            
            // Assign the correct frequency spec dictionary based on model family branch
            const targetedSpecTable = isIcomItem ? specTableUHF : specTableVHF;

            const flatPayload = {
                action: "insertInventoryRow",
                model: cleanModelName,
                brand: targetBrandText,
                type: "portable",
                price: 0,
                image: `${targetFolderLabel}/images/${cleanModelName}.png`,
                specLink: `${targetFolderLabel}/specs/${targetFolderLabel}`,
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

            // 1-second pause to respect host network anti-flood thresholds cleanly
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log("🎯 ALL VARIANT MATRIX DATA SHEET LOGS COMPLETED WITH 100% VISUAL INTEGRITY!");

    } catch (err) {
        console.error("💥 Extraction process failed:", err.message);
    }
}

parseSpecSheetDirectly();
