import pdfplumber
import re
import json
import time
import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from openai import OpenAI

# ========== CONFIG ==========
PDF_PATH = "xpr5000e-series-datasheet-na.pdf"          # ← change per datasheet
BRAND = "Motorola"                            # Kenwood | Hytera | Icom | Motorola | Ritron
BRAND_FOLDER = "motorola"
DEFAULT_TYPE = "mobile"
PAGE_RANGE = None                         # e.g. (1, 4) or None

CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-proj-YOUR_KEY_HERE")

# Optional forced mappings: datasheet name → exact sheet model
OVERRIDE_MAP = {
    # "BD302i": "BD302i-U1-NB",
}
# ============================

ai = OpenAI(api_key=OPENAI_API_KEY)

scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SPREADSHEET_ID)
sheet = ss.worksheet(WORKSHEET_NAME) if WORKSHEET_NAME else ss.get_worksheet(0)

print(f"Connected: '{sheet.title}' | Brand: {BRAND} | PDF: {PDF_PATH}")

all_values = sheet.get_all_values()
headers = all_values[0]
col = {h: i for i, h in enumerate(headers)}

required_cols = [
    "model", "brand", "type", "features", "specTable", "short-description",
    "catalog-copy", "compatibleModels", "industry", "image", "specLink", "root-model",
]
for r in required_cols:
    if r not in col:
        raise SystemExit(f"Missing column: {r}")

existing = {}
for idx, row in enumerate(all_values[1:], start=2):
    if row and str(row[0]).strip():
        existing[str(row[0]).strip().upper()] = idx

print(f"Models in sheet: {len(existing)}")


# ---------- Matching helpers ----------
def normalize(s):
    n = re.sub(r"[\s\-]+", "", str(s).upper())
    if BRAND == "Icom" and n.startswith("IC"):
        n = n[2:]
    return n


def core_model(s):
    n = normalize(s)
    if BRAND == "Icom":
        n = re.sub(r"\d{2,3}$", "", n)
        n = re.sub(r"(USA|EUR|AUS|CAN|UK)$", "", n)
    elif BRAND == "Kenwood":
        n = re.sub(r"(ISCK?\d*|K\d+|BK\d*)$", "", n)
    elif BRAND == "Hytera":
        n = re.sub(r"[VU]\d$", "", n)
    return n


def find_sheet_matches(datasheet_model, existing_dict):
    raw = str(datasheet_model).strip()
    if not raw:
        return []

    key = raw.upper()

    # 1. Override
    target = OVERRIDE_MAP.get(raw) or OVERRIDE_MAP.get(key)
    if target:
        t = target.upper()
        if t in existing_dict:
            return [(t, existing_dict[t])]
        return []

    # 2. Exact
    if key in existing_dict:
        return [(key, existing_dict[key])]

    # 3. Normalized
    norm_map = {}
    for m, row in existing_dict.items():
        norm_map.setdefault(normalize(m), []).append((m, row))

    n = normalize(key)
    if n in norm_map:
        return norm_map[n]

    n2 = re.sub(r"\d{2,3}$", "", n)
    if n2 and n2 in norm_map:
        return norm_map[n2]

    # 4. Core / family match
    ds_core = core_model(key)
    if len(ds_core) < 3:
        return []

    matches = []
    for sheet_model, row in existing_dict.items():
        sm_norm = normalize(sheet_model)
        sm_core = core_model(sheet_model)
        same_core = sm_core == ds_core
        sheet_starts = sm_norm.startswith(ds_core) or sm_core.startswith(ds_core)
        ds_starts = ds_core.startswith(sm_core) and len(sm_core) >= 4
        if same_core or sheet_starts or ds_starts:
            matches.append((sheet_model, row))

    seen = set()
    unique = []
    for m, r in matches:
        if r not in seen:
            seen.add(r)
            unique.append((m, r))
    return unique


# ---------- PDF text ----------
full_text = ""
with pdfplumber.open(PDF_PATH) as pdf:
    total = len(pdf.pages)
    pages = range(total) if PAGE_RANGE is None else range(max(0, PAGE_RANGE[0]-1), min(total, PAGE_RANGE[1]))
    for i in pages:
        full_text += (pdf.pages[i].extract_text() or "") + "\n\n"

if not full_text.strip():
    raise SystemExit("No text extracted from PDF")

print(f"Extracted {len(full_text)} characters")


# ---------- AI ----------
print("Sending to AI...")
system_prompt = f"""
You are a meticulous B2B two-way radio datasheet parser for {BRAND}.

Return ONE JSON object:
{{
  "models": ["exact model part numbers"],
  "root_model": "base series name",
  "short_description": "1-3 professional sentences",
  "catalog_copy": "one short marketing line",
  "features": ["feature 1", "feature 2", "..."],
  "specifications": {{
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
  }},
  "compatible_accessories": ["exact accessory part numbers"],
  "industry": []
}}

STRICT RULES FOR FEATURES:
- Extract EVERY distinct feature mentioned in the document.
- Pay special attention to multi-column layouts.
- Return a flat array of clean plain-English strings.
- Aim for 12–25 features when available.
- Do not invent features.

OTHER RULES:
- Only use information that appears in the text.
- For specifications, only include keys that have clear values.
- compatible_accessories must be real part numbers when possible.
"""

resp = ai.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": full_text[:120000]},
    ],
    response_format={"type": "json_object"},
    temperature=0.1,
)

data = json.loads(resp.choices[0].message.content)

models = data.get("models") or []
root_model = (data.get("root_model") or (models[0] if models else "")).strip()
short_desc = (data.get("short_description") or "").strip()
catalog_copy = (data.get("catalog_copy") or short_desc).strip()
features_list = data.get("features") or []
specs = data.get("specifications") or {}
accessories = data.get("compatible_accessories") or []
industries = data.get("industry") or []

features_str = ", ".join(
    re.sub(r"^[\s\-\*•·]+", "", str(f)).strip()
    for f in features_list if str(f).strip()
)
spec_json = json.dumps(specs, ensure_ascii=False)
accessories_str = ", ".join(str(a).strip() for a in accessories if str(a).strip())
industry_str = ", ".join(str(i).strip() for i in industries if str(i).strip())

print(f"Models in datasheet: {len(models)}")
for m in models:
    print(f"  • {m}")
print(f"Accessories found: {len(accessories)}")


# ---------- Build row data (protects accessory descriptions) ----------
def build_row_data(sheet_model, is_accessory=False, existing_short="", existing_catalog=""):
    file_base = re.sub(r"[^a-z0-9\-]", "", sheet_model.lower().replace(" ", "-"))

    if is_accessory:
        # Protect good descriptions that were cleaned up earlier
        short = existing_short if (existing_short and "compatible accessory" not in existing_short.lower() and len(existing_short) > 12) else sheet_model
        catalog = existing_catalog if (existing_catalog and len(existing_catalog) > 15 and "compatible accessory" not in existing_catalog.lower()) else sheet_model
    else:
        short = short_desc
        catalog = catalog_copy

    return {
        "model": sheet_model,
        "brand": BRAND,
        "type": "accessory" if is_accessory else DEFAULT_TYPE,
        "features": "" if is_accessory else features_str,
        "specTable": "" if is_accessory else spec_json,
        "short-description": short,
        "catalog-copy": catalog,
        "compatibleModels": "" if is_accessory else accessories_str,
        "industry": "" if is_accessory else industry_str,
        "image": "" if is_accessory else f"{BRAND_FOLDER}/images/{file_base}.png",
        "specLink": "" if is_accessory else f"{BRAND_FOLDER}/specs/{file_base}.pdf",
        "root-model": "" if is_accessory else root_model,
    }


# ---------- Update existing + Create missing ----------
to_update = []
to_create = []
matched_rows = set()

# 1. Main radio models
for model in models:
    model = str(model).strip()
    if not model:
        continue

    hits = find_sheet_matches(model, existing)
    if hits:
        for sheet_model, row_num in hits:
            if row_num in matched_rows:
                continue
            matched_rows.add(row_num)
            print(f"  Update radio: '{model}' → '{sheet_model}' (row {row_num})")
            data = build_row_data(sheet_model, is_accessory=False)
            data["row"] = row_num
            to_update.append(data)
    else:
        print(f"  Create radio: '{model}'")
        to_create.append(build_row_data(model, is_accessory=False))

# 2. Accessories
for acc in accessories:
    acc = str(acc).strip()
    if not acc:
        continue

    hits = find_sheet_matches(acc, existing)
    if hits:
        for sheet_model, row_num in hits:
            if row_num in matched_rows:
                continue
            matched_rows.add(row_num)

            # Read existing values so we can protect them
            existing_short = ""
            existing_catalog = ""
            try:
                row_data = all_values[row_num - 1]
                existing_short = str(row_data[col["short-description"]]).strip()
                existing_catalog = str(row_data[col["catalog-copy"]]).strip()
            except Exception:
                pass

            print(f"  Update accessory: '{acc}' → '{sheet_model}' (row {row_num}) [protecting description]")
            data = build_row_data(sheet_model, is_accessory=True,
                                  existing_short=existing_short,
                                  existing_catalog=existing_catalog)
            data["row"] = row_num
            to_update.append(data)
    else:
        print(f"  Create accessory: '{acc}'")
        to_create.append(build_row_data(acc, is_accessory=True))

print(f"\nWill update: {len(to_update)}")
print(f"Will create: {len(to_create)}")


# ---------- Perform updates ----------
fields = [
    "brand", "type", "features", "specTable", "short-description",
    "catalog-copy", "compatibleModels", "industry", "image", "specLink", "root-model",
]

BATCH = 10
for i in range(0, len(to_update), BATCH):
    batch = to_update[i:i + BATCH]
    cells = []
    for item in batch:
        r = item["row"]
        for f in fields:
            cells.append(gspread.Cell(r, col[f] + 1, item[f]))
    if cells:
        sheet.update_cells(cells)
    print(f"Updated batch {i // BATCH + 1}")
    time.sleep(1.2)


# ---------- Perform creates ----------
if to_create:
    print("\nCreating new rows...")
    rows_to_append = []
    for item in to_create:
        row = [""] * len(headers)
        row[col["model"]] = item["model"]
        for f in fields:
            if f in col:
                row[col[f]] = item[f]
        rows_to_append.append(row)

    BATCH = 20
    for i in range(0, len(rows_to_append), BATCH):
        batch = rows_to_append[i:i + BATCH]
        sheet.append_rows(batch, value_input_option="USER_ENTERED")
        print(f"  Created batch {i // BATCH + 1} ({len(batch)} rows)")
        time.sleep(1.5)

print(f"\nDone.")
print(f"  Updated : {len(to_update)}")
print(f"  Created : {len(to_create)}")
print("price and includes were not modified.")