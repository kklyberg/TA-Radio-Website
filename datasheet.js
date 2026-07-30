require("dotenv").config();

const fs = require("fs");
const path = require("path"); // only if you use path later

const { OpenAI } = require("openai");
const { getDocumentProxy, extractText } = require("unpdf");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

// ========== CONFIG ==========
const CONFIG = {
  targetFile: "mototrbo_sl300_data_sheet (1).pdf",
  brand: "Motorola",
  brandFolder: "motorola",
  type: "portable",
  pageRange: null,
  appsScriptUrl:
    "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec"
};


// ============================

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
    const parsed = await parseWithAI(fullText);

    console.log(`\n🎯 Models: ${parsed.models.length}`);
    parsed.models.forEach((m) => console.log(` • ${m}`));

    console.log(`\n🧩 Accessories: ${parsed.accessories.length}`);
    parsed.accessories.forEach((a) => console.log(` • ${a}`));

    // Create the main radios
    for (const model of parsed.models) {
      const name = String(model).trim();
      if (!name) continue;

      process.stdout.write(`📡 ${name} ... `);
      const result = await createOrUpdate(name, parsed, false);
      const text = (result.text || "").toLowerCase();

      if (text.includes("created") || text.includes("updated") || text.includes("success")) {
        console.log("✅ created/updated");
      } else if (text.includes("already")) {
        console.log("⏭ already exists");
      } else {
        console.log("❌ " + (result.text || "").slice(0, 300));
      }
      await new Promise((r) => setTimeout(r, 700));
    }

    // Create the accessories
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
  }
}

main();