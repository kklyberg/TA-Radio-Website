import os
import re
import json
import time
import pdfplumber
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from openai import OpenAI

# ========== CONFIG ==========
PDF_PATH = "Hytera_BD302i_DS-F.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or "sk-proj-PASTE_YOUR_KEY_HERE"
# ============================

client_ai = OpenAI(api_key=OPENAI_API_KEY)

print("📄 Reading PDF...")
with pdfplumber.open(PDF_PATH) as pdf:
    full_text = "\n\n".join([(page.extract_text() or "") for page in pdf.pages])
print(f"Extracted {len(full_text)} characters.")

# ---------- CALL 1: Radios + shared data ----------
print("\n🧠 Call 1/2 – Extracting radios, features and specs...")

radio_prompt = """
You are an expert Kenwood radio brochure parser.
Focus only on the radios and shared specifications.

Return JSON with these keys:
{
  "features": "Long single-line comma-separated list of 15-25 features. No newlines, no bullets, no asterisks.",
  "compatibleModels": "Comma-separated list of accessory PART NUMBERS only",
  "short-description": "2-3 professional sentences",
  "catalog-copy": "One strong sentence",
  "industry": "Public Safety, Utilities, Transportation, Industrial",
  "base_models": [
    {"base": "NX-5200", "frequency": "136-174 MHz", "power": "6 W"},
    {"base": "NX-5300", "frequency": "450-520 MHz", "power": "5 W"},
    {"base": "NX-5400", "frequency": "380-470 MHz", "power": "5 W"}
  ],
  "spec_template": {
    "Channel Capacity": "4000 channels",
    "Number of Zones": "128",
    "Channel Spacing": "Analog 12.5/15/20/25/30 kHz, Digital 6.25/12.5 kHz",
    "Display": "1.74 inch Transflective TFT",
    "IP Rating": "IP67/68",
    "MIL-STD": "810 C/D/E/F/G",
    "Encryption": "56-bit DES (AES optional)",
    "GPS": "Built-in",
    "Bluetooth": "Built-in",
    "Audio Output": "1 W",
    "Vocoder": "AMBE+2",
    "Operating Temperature": "-30°C to +60°C"
  }
}
"""

response1 = client_ai.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": radio_prompt},
        {"role": "user", "content": full_text[:120000]}
    ],
    response_format={"type": "json_object"},
    temperature=0.1
)

data = json.loads(response1.choices[0].message.content)

features = data.get("features", "")
compatible = data.get("compatibleModels", "")
short_desc = data.get("short-description", "")
catalog_copy = data.get("catalog-copy", "")
industry = data.get("industry", "Public Safety, Utilities, Transportation, Industrial")
base_models = data.get("base_models", [])
spec_template = data.get("spec_template", {})

print(f"   → {len(base_models)} base models extracted")

# Small delay before second call
time.sleep(1.5)

# ---------- CALL 2: Accessories only ----------
print("🧠 Call 2/2 – Extracting accessories (focused)...")

acc_prompt = """
You are extracting ONLY the optional accessories from a Kenwood brochure.

Return a JSON object with a single key "accessories".
"accessories" is an array of objects. Each object must have:
- model: the exact part number (e.g. KNB-L1, KSC-Y32, KRA-22, KMC-41)
- short-description: one clear professional sentence
- catalog-copy: very short one-line description

Extract EVERY accessory listed in the Optional Accessories section.
Do not miss batteries, chargers, antennas, speaker microphones, belt clips, or carrying accessories.
Be thorough.
"""

response2 = client_ai.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": acc_prompt},
        {"role": "user", "content": full_text[:120000]}
    ],
    response_format={"type": "json_object"},
    temperature=0.1
)

acc_data = json.loads(response2.choices[0].message.content)
accessories = acc_data.get("accessories", [])

print(f"   → {len(accessories)} accessories extracted")

# ---------- Google Sheet ----------
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SPREADSHEET_ID)
sheet = ss.worksheet(WORKSHEET_NAME) if WORKSHEET_NAME else ss.get_worksheet(0)

existing_models = {row[0].strip().upper() for row in sheet.get_all_values()[1:] if row and row[0].strip()}
print(f"Found {len(existing_models)} existing models in sheet.")

def clean_features(text):
    if isinstance(text, list):
        text = ", ".join(text)
    text = str(text)
    text = text.replace("\n", ", ").replace("\r", ", ")
    text = re.sub(r"[•\*\-]\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r",\s*,", ",", text)
    return text.strip(" ,")

features = clean_features(features)

# ---------- Create 9 radio variations ----------
keypad_versions = ["K", "K2", "K3"]
created_radios = 0

for base in base_models:
    base_name = base.get("base")
    freq = base.get("frequency", "")
    power = base.get("power", "")

    for suffix in keypad_versions:
        full_model = f"{base_name}{suffix}"

        if full_model.upper() in existing_models:
            print(f"  ↳ Already exists: {full_model}")
            continue

        spec_table = spec_template.copy()
        spec_table["Frequency Range"] = freq
        spec_table["RF Power Output"] = power
        spec_table = {k: v for k, v in spec_table.items() if v and str(v).strip()}

        model_lower = full_model.lower()
        image_url = f"kenwood/images/{model_lower}.png"
        spec_link = f"kenwood/specs/{model_lower}.pdf"

        row = [
            full_model, "Kenwood", "portable", "",
            image_url, "", features, spec_link,
            json.dumps(spec_table), compatible,
            short_desc, industry, catalog_copy, base_name
        ]

        next_row = len(sheet.col_values(1)) + 1
        sheet.update(f"A{next_row}", [row])
        existing_models.add(full_model.upper())
        created_radios += 1
        print(f"✅ Radio: {full_model}")

# ---------- Accessories ----------
created_acc = 0
for acc in accessories:
    model = str(acc.get("model", "")).strip()
    if not model or model.upper() in existing_models:
        continue

    model_lower = model.lower()
    image_url = f"kenwood/images/{model_lower}.png"

    row = [
        model, "Kenwood", "accessory", "",
        image_url, "", "", "", "", "",
        acc.get("short-description", ""),
        "", acc.get("catalog-copy", ""), ""
    ]

    next_row = len(sheet.col_values(1)) + 1
    sheet.update(f"A{next_row}", [row])
    existing_models.add(model.upper())
    created_acc += 1
    print(f"  ↳ Accessory: {model}")

print(f"\nDone! Created {created_radios} radios and {created_acc} accessories.")