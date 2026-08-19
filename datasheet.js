/**
 * datasheet2.js — Generic multi-brand datasheet importer
 * Brands: Kenwood | Motorola | Hytera | Icom | Ritron
 *
 * Usage:
 *   1. Edit CONFIG below
 *   2. node datasheet2.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const { getDocumentProxy, extractText } = require("unpdf");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

// ========== ONLY SECTION YOU EDIT PER RUN ==========
const CONFIG = {
  targetFile: "MOTOTRBO.pdf", // PDF in this folder
  brand: "Motorola",                          // Kenwood | Motorola | Hytera | Icom | Ritron
  brandFolder: "motorola",                    // must match folder on disk (lowercase)
  type: "accessory",                          // portable | mobile | repeater | base | ...
  pageRange: null,                           // null = all pages, or "1-5" or "1,3,7"
  appsScriptUrl:
    "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec"
};
// ==================================================

// Brand-specific part-number patterns (data only — do not hardcode elsewhere)
const PART_PATTERNS = {
  kenwood:  /\b([A-Z]{2,4}-?[A-Z0-9]{1,10}(?:-[A-Z0-9]+)?)\b/i,
  motorola: /\b([A-Z]{2,4}\d{4}[A-Z0-9]*)\b/i,
  hytera:   /\b([A-Z]{2,6}\d{2,5}[A-Z0-9\-]*)\b/i,
  icom:     /\b([A-Z]{1,3}-?[A-Z0-9]{2,10})\b/i,
  ritron:   /\b([A-Z]{2,5}-?[A-Z0-9]{2,10})\b/i
};

function getPartRegex() {
  const key = String(CONFIG.brand || "").toLowerCase();
  return PART_PATTERNS[key] || /\b([A-Z]{2,6}[-\s]?\d{2,6}[A-Z0-9\-]*)\b/i;
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

function slugify(model) {
  return String(model)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function imagePath(model) {
  return `${CONFIG.brandFolder}/images/${slugify(model)}.png`;
}

function specPath(model) {
  return `${CONFIG.brandFolder}/specs/${slugify(model)}.pdf`;
}

function getDownloadedAccessories() {
  const imageDir = path.join(__dirname, CONFIG.brandFolder, "images");
  if (!fs.existsSync(imageDir)) {
    console.log(`⚠️ Image directory not found: ${imageDir}`);
    return [];
  }
  return fs
    .readdirSync(imageDir)
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .map((f) => path.basename(f).replace(/\.(png|jpg|jpeg)$/i, "").toUpperCase());
}

function extractPartNumbers(rawList) {
  const regex = getPartRegex();
  const clean = new Set();
  for (const item of rawList || []) {
    const str = String(item).trim();
    if (!str) continue;
    const match = str.match(regex);
    if (match) {
      const sku = match[1].toUpperCase().replace(/\s+/g, "");
      clean.add(sku);
      console.log(` 🎯 Isolated SKU: [${sku}]`);
    } else {
      console.log(` ⏩ Dropped (no SKU): "${str.slice(0, 50)}"`);
    }
  }
  return Array.from(clean);
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
  "features": ["feature 1", "feature 2", "..."],
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

Rules:
- Only use information that appears in the text.
- Extract EVERY distinct feature (flat array of plain English strings).
- Do not invent features or part numbers.
- compatible_accessories must be real part numbers only.
- For specifications, only include keys that have a clear value.
- Aim for 12–25 features when the datasheet supports it.
`;

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

  const parsed = JSON.parse(aiResponse.choices[0].message.content);
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
}

async function createOrUpdate(model, parsed, isAccessory = false) {
  const action = isAccessory ? "createAccessory" : "createProduct";
  const payload = {
    action,
    model,
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
    "root-model": isAccessory ? "" : parsed.root_model || model
  };

  const body = Object.keys(payload)
    .map(
      (key) =>
        encodeURIComponent(key) + "=" + encodeURIComponent(payload[key] ?? "")
    )
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
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY missing. Check your .env file.");
    }

    console.log(`Brand: ${CONFIG.brand}`);
    console.log(`Folder: ${CONFIG.brandFolder}`);
    console.log(`Type: ${CONFIG.type}`);
    console.log(`PDF: ${CONFIG.targetFile}`);
    console.log(`Mode: CREATE radio + accessories\n`);

    const fullText = await extractTextFromPdf();
    let parsed = await parseWithAI(fullText);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);

    // ----- Accessories: AI first, local folder fallback -----
    const rawAiAccessories =
      parsed.accessories || parsed.compatible_accessories || [];
    const hasAiAccessories = rawAiAccessories.length > 0;

    if (!hasAiAccessories) {
      console.log("\nℹ️ AI found 0 accessories in PDF.");
      console.log(`📂 Scanning ${CONFIG.brandFolder}/images ...`);
      const localParts = getDownloadedAccessories();
      if (localParts.length > 0) {
        parsed.accessories = localParts;
        parsed.compatible_accessories = localParts;
        console.log(`✅ Injected ${localParts.length} SKUs from local images.`);
      } else {
        console.log("⚠️ No local images found. Accessories list empty.");
        parsed.accessories = [];
        parsed.compatible_accessories = [];
      }
    } else {
      console.log("\n🧹 Cleaning AI accessory list...");
      const finalCleanList = extractPartNumbers(rawAiAccessories);
      parsed.accessories = finalCleanList;
      parsed.compatible_accessories = finalCleanList;
      console.log(`✅ Kept ${finalCleanList.length} valid SKUs.`);
    }

    console.log(`\n🎯 Models: ${parsed.models.length}`);
    parsed.models.forEach((m) => console.log(` • ${m}`));
    console.log(`\n🧩 Accessories: ${parsed.accessories.length}`);
    parsed.accessories.forEach((a) => console.log(` • ${a}`));

    // Create main products
    for (const model of parsed.models) {
      const name = String(model).trim();
      if (!name) continue;
      process.stdout.write(`📡 ${name} ... `);
      const result = await createOrUpdate(name, parsed, false);
      const text = (result.text || "").toLowerCase();
      if (
        text.includes("created") ||
        text.includes("updated") ||
        text.includes("success")
      ) {
        console.log("✅ created/updated");
      } else if (text.includes("already")) {
        console.log("⏭ already exists");
      } else {
        console.log("❌ " + (result.text || "").slice(0, 300));
      }
      await new Promise((r) => setTimeout(r, 700));
    }

    // Create accessories
    for (const acc of parsed.accessories) {
      const name = String(acc).trim();
      if (!name) continue;
      process.stdout.write(`🧩 ${name} ... `);
      const result = await createOrUpdate(name, parsed, true);
      const text = (result.text || "").toLowerCase();
      if (text.includes("created") || text.includes("success")) {
        console.log("✅ created");
      } else if (text.includes("already")) {
        console.log("⏭ already exists");
      } else {
        console.log("❌ " + (result.text || "").slice(0, 300));
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    console.log("\nDone.");
  } catch (err) {
    console.error("💥", err.message);
    process.exit(1);
  }
}

main();