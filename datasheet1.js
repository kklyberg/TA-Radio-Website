require("dotenv").config();

const fs = require("fs");
const path = require("path"); 
const axios = require('axios');
const { OpenAI } = require("openai");
const { getDocumentProxy, extractText } = require("unpdf");
const cheerio = require('cheerio');

// ========== CONFIG ==========
const CONFIG = {
  targetFile: "mototrbo_sl300_data_sheet.pdf",
  brand: "Motorola",
  brandFolder: "Motorola",
  type: "portable",
  pageRange: null,
  appsScriptUrl:
    "https://google.com"
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});
// ============================

/**
 * Advanced web crawling downloader that searches Motorola's storefront,
 * follows redirects, extracts the true image location (even alternate variants),
 * and forces the output filename to match your exact datasheet part number.
 * @param {Array} cleanPartNumbers - Cleaned SKUs from your dataset
 */
async function syncAndDownloadImages(cleanPartNumbers) {
    const imageDir = path.join(__dirname, CONFIG.brandFolder, 'images');

    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
        console.log('📁 Target folder structure created at: ' + imageDir);
    }

    console.log('\n🚀 Starting advanced web crawler download pipeline for ' + cleanPartNumbers.length + ' items...');

    const domainBase = "https://motorolasolutions.com";

    for (const part of cleanPartNumbers) {
        const basePart = part.trim().toUpperCase();
        
        // FIX: Force the file name to lock onto your spreadsheet SKU variable, NOT the server file string
        const localDestination = path.join(imageDir, basePart + '.png');

        if (fs.existsSync(localDestination)) {
            console.log('  ⏭️ Asset [' + basePart + '.png] already exists locally. Skipping.');
            continue;
        }

        console.log('  📥 Processing download channel for SKU: [' + basePart + ']...');

        // Build the precise redirecting search URL
        const searchUrl = domainBase + "/search?Ntt=*" + basePart + "*";
        let targetImageUrl = null;

        try {
            // Request the search page and follow redirects to the actual product page
            const searchResponse = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 15000,
                maxRedirects: 5
            });

            const htmlContent = searchResponse.data;
            
            // Crawling Step 1: Scan the page HTML text array for direct image references
            const genericImageRegex = /([^\s"'`]+\/ccstore\/v1\/images\/\?source=[^\s"'`\)]+)/gi;
            const discoveredPaths = htmlContent.match(genericImageRegex) || [];

            if (discoveredPaths.length > 0) {
                const bestMatch = discoveredPaths.find(p => p.includes("/products/")) || discoveredPaths;
                targetImageUrl = bestMatch.replace(/["']/g, "").replace(/&amp;/g, "&");
            }

            // Crawling Step 2: If hidden, scan for any fallback variant model number text blocks inside the source code
            if (!targetImageUrl) {
                const alternateSkuMatch = htmlContent.match(/([A-Z]{4}\d{4}[A-Z0-9]+)/i);
                if (alternateSkuMatch) {
                    const structuralAltSku = alternateSkuMatch.toUpperCase();
                    targetImageUrl = '/ccstore/v1/images/?source=/file/products/' + structuralAltSku + '.01.jpg&height=300&width=300';
                }
            }

        } catch (searchError) {
            // Skip down to our generic guess formula pattern layer if the server hits a network timeout
        }

        // Crawling Step 3: Hardcoded fall back if the page parsing turned up completely blank
        if (!targetImageUrl) {
            const resolvedSKU = basePart.endsWith('A') || basePart.endsWith('B') || basePart.endsWith('C') ? basePart : basePart + 'A';
            targetImageUrl = '/ccstore/v1/images/?source=/file/products/' + resolvedSKU + '.01.jpg&height=300&width=300';
        }

        // Standardize path prefixes
        if (targetImageUrl && !targetImageUrl.startsWith('http')) {
            targetImageUrl = domainBase + (targetImageUrl.startsWith('/') ? '' : '/') + targetImageUrl;
        }

        const finalizedDownloadUrl = targetImageUrl.replace(/&amp;/g, '&');

        // Execute direct binary payload stream download
        try {
            const imgBuffer = await axios({
                method: 'get',
                url: finalizedDownloadUrl,
                responseType: 'arraybuffer',
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                },
                timeout: 12000
            });

            // Writes the image down under your exact target loop part ID context name
            fs.writeFileSync(localDestination, imgBuffer.data);
            console.log('    ✅ Successfully saved to folder path: ' + CONFIG.brandFolder + '/images/' + basePart + '.png');

        } catch (error) {
            console.log('    ⚠️ Asset unavailable on live server repository mapping for SKU: ' + basePart);
        }

        // 1.5-second anti-blocking throttle delay interval parameter
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}

function parsePageRange(pageRange, totalPages) {
  if (!pageRange) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [];
  String(pageRange)
    .split(",")
    .map((r) => r.trim())
    .forEach((range) => {
      if (range.includes("-")) {
        const [start, end] = range.split("-").map((n) => parseInt(n.trim(), 10));
        for (let p = start; p <= end; p++) pages.push(p);
      } else {
        pages.push(parseInt(range, 10));
      }
    });
  return pages.filter((p) => p >= 1 && p <= totalPages);
}

function cleanFeatures(features) {
  if (!Array.isArray(features)) return "";
  return features
    .map((f) =>
      String(f)
        .replace(/^[\s\-\*•·\d\.]+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join(", ");
}

function imagePath(model) {
  const fileBase = String(model)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
  return `${CONFIG.brandFolder}/images/${fileBase}.png`;
}

function specPath(model) {
  const fileBase = String(model)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
  return `${CONFIG.brandFolder}/specs/${fileBase}.pdf`;
}

async function extractTextFromPdf() {
  if (!fs.existsSync(CONFIG.targetFile)) {
    throw new Error(`PDF not found: ${CONFIG.targetFile}`);
  }
  console.log(`📄 Loading ${CONFIG.targetFile}...`);
  const buffer = fs.readFileSync(CONFIG.targetFile);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const totalPages = pdf.numPages;
  console.log(`✓ ${totalPages} pages`);

  const pagesToScan = parsePageRange(CONFIG.pageRange, totalPages);
  console.log(`📍 Pages: [${pagesToScan.join(", ")}]`);

  let fullText = "";
  for (const pageNum of pagesToScan) {
    console.log(`⏳ Page ${pageNum}...`);
    const result = await extractText(pdf, {
      mergePages: false,
      pageIndices: [pageNum]
    });
    const pageText = Array.isArray(result.text)
      ? result.text.join("\n")
      : result.text || "";
    fullText += pageText + "\n\n";
  }

  if (!fullText.trim()) throw new Error("Extracted text is empty");
  console.log(`✓ Extracted ${fullText.length} characters`);
  return fullText;
}

async function parseWithAI(fullText) {
  console.log("🧠 Sending to AI...");
   const systemPrompt = `
You are an expert B2B two-way radio datasheet parser for ${CONFIG.brand} products.

Return ONE JSON object with these exact keys:
{
  "models": ["exact model part numbers from the document"],
  "root_model": "base series name if clear, else first model",
  "short_description": "1-3 professional sentences",
  "catalog_copy": "one short catalog line",
  "features": ["feature 1", "feature 2", "feature 3", ...],
  "specifications": {
    "Frequency Range": "...",
    "Channel Capacity": "...",
    "Power Output": "...",
    "Battery": "...",
    "Battery Life": "...",
    "Weight": "...",
    "Dimensions": "...",
    "IP Rating": "...",
    "Channel Spacing": "...",
    "Operating Voltage": "..."
  },
  "compatible_accessories": ["exact accessory part numbers if listed"],
  "industry": ["industries if mentioned, else []"]
}

Rules for features:
- Extract EVERY distinct feature mentioned in the document, including those in multi-column layouts, bullet lists, and highlighted call-outs.
- Return them as a flat array of clean plain-English strings (no bullets, no numbers, no leading dashes).
- Include both general features and safety/security/scan/voice features.
- Do not invent features that are not in the text.
- Aim for 12–25 solid features when the datasheet has that many.

Other rules:
- Only use information that actually appears in the text.
- For specifications, only include keys that have a clear value.
- compatible_accessories must be real part numbers (BP-279, MB-133, FA-SC55V, etc.).
`;

  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullText.slice(0, 120000) }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
      temperature: 0.1
    });

    if (!aiResponse || !aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
        throw new Error("OpenAI API returned an empty or invalid response object.");
    }

    const contentString = aiResponse.choices[0].message.content;
    const parsed = JSON.parse(contentString);
    
    return {
      models: parsed.models || [],
      root_model: parsed.root_model || "",
      short_description: parsed.short_description || "",
      catalog_copy: parsed.catalog_copy || parsed.short_description || "",
      features: cleanFeatures(parsed.features || []),
      specTable: JSON.stringify(parsed.specifications || {}),
      compatibleModels: (parsed.compatible_accessories || []).join(", "),
      accessories: parsed.compatible_accessories || [],
      industry: (parsed.industry || []).join(", ")
    };

  } catch (apiError) {
      console.error("\n💥 OpenAI Parsing Layer Error:", apiError.message);
      return {
          models: [CONFIG.targetFile.replace(/_data_sheet\.pdf/i, '').toUpperCase()],
          root_model: "",
          short_description: "Two-way radio device",
          catalog_copy: "Two-way radio device",
          features: "",
          specTable: "{}",
          compatibleModels: "",
          accessories: [],
          industry: ""
      };
  }
}

async function createOrUpdate(model, parsed, isAccessory = false) {
  const action = isAccessory ? "createAccessory" : "createProduct";

  const payload = {
    action: action,
    model: model,
    brand: CONFIG.brand,
    type: isAccessory ? "accessory" : CONFIG.type,
    image: isAccessory ? "" : imagePath(model),
    specLink: isAccessory ? "" : specPath(model),
    features: isAccessory ? "" : parsed.features,
    specTable: isAccessory ? "" : parsed.specTable,
    compatibleModels: isAccessory ? "" : parsed.compatibleModels,
    "short-description": isAccessory
      ? `Compatible accessory for ${CONFIG.brand} radios`
      : parsed.short_description,
    industry: isAccessory ? "" : parsed.industry,
    "catalog-copy": isAccessory ? model : parsed.catalog_copy,
    "root-model": isAccessory ? "" : (parsed.root_model || model)
  };

  const body = Object.keys(payload)
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(payload[key] ?? ""))
    .join("&");

  const response = await fetch(CONFIG.appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    body,
    redirect: "follow"
  });

  const text = await response.text();
  return { status: response.status, text };
}

async function main() {
  try {
    console.log(`Brand: ${CONFIG.brand}`);
    console.log(`Mode: CREATE radio + accessories (from scratch)`);

    const fullText = await extractTextFromPdf();
    let parsed = await parseWithAI(fullText);

    if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
    }

    // ====================================================================
    // REGEX TEXT CLEANER & AUTOMATED IMAGE DOWNLOADER
    // ====================================================================
    console.log("\n🧹 Cleaning messy data sheet text and isolating part numbers...");
    const rawAiAccessories = parsed.accessories || parsed.compatible_accessories || [];
    const cleanPartsSet = new Set();
    
    rawAiAccessories.forEach(item => {
        const currentStr = String(item).trim();
        const partMatch = currentStr.match(/([A-Z]{2,4}\d{4}[A-Z0-9]*)/i);
        
        if (partMatch) {
            const cleanSKU = partMatch[1].toUpperCase();
            cleanPartsSet.add(cleanSKU);
        }
    });

    const finalCleanList = Array.from(cleanPartsSet);
    
    parsed.accessories = finalCleanList;
    parsed.compatibleModels = finalCleanList.join(", ");
    
    console.log(`✅ Text clean-up complete! Isolated ${finalCleanList.length} valid product SKUs.`);

    // Runs the updated direct download tracking module safely using your clean parts list
    if (finalCleanList.length > 0) {
        await syncAndDownloadImages(finalCleanList);
    } else {
        console.log("⚠️ No accessories found to fetch images for.");
    }
    // ====================================================================

    console.log(`\n🎯 Models: ${parsed.models.length}`);
    parsed.models.forEach((m) => console.log(` • ${m}`));

    console.log(`\n🧩 Accessories: ${parsed.accessories.length}`);
    parsed.accessories.forEach((a) => console.log(` • ${a}`));

    // Create the main radios
    for (const model of parsed.models) {
      const name = String(model).trim();
      if (!name) continue;

      process.stdout.write(`📡 ${name} ... `);
      
      try {
        const result = await createOrUpdate(name, parsed, false);
        const text = (result.text || "").toLowerCase();

        if (text.includes("created") || text.includes("updated") || text.includes("success")) {
          console.log("✅ created/updated");
        } else if (text.includes("already")) {
          console.log("⏭ already exists");
        } else {
          console.log("❌ " + (result.text || "").slice(0, 300));
        }
      } catch (radioError) {
        console.log(`❌ Network push error for radio row: ${radioError.message}. Skipping.`);
      }
      
      await new Promise((r) => setTimeout(r, 700));
    }

    // Create the accessories
    for (const acc of parsed.accessories) {
      const name = String(acc).trim();
      if (!name) continue;

      process.stdout.write(`🧩 ${name} ... `);
      
      try {
        const result = await createOrUpdate(name, parsed, true);
        const text = (result.text || "").toLowerCase();

        if (text.includes("created") || text.includes("success")) {
          console.log("✅ created");
        } else if (text.includes("already")) {
          console.log("⏭ already exists");
        } else {
          console.log("❌ " + (result.text || "").slice(0, 300));
        }
      } catch (accError) {
        console.log(`❌ Network push error for accessory row: ${accError.message}. Skipping.`);
      }
      
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log("\nDone.");
  } catch (err) {
    console.error("💥", err.message);
  }
}

main();
