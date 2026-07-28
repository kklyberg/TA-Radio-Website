import fitz  # pymupdf
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "LMR_List_May_2026.pdf"          # ← change this
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

BRAND = "Kenwood"          # ← change per price book (Kenwood / Icom / Hytera / Motorola / Ritron)
DEFAULT_TYPE = "portable"  # or "mobile" / "accessory" if you prefer

PREFIXES = [
    "NX-", "TK-", "PKT-",          # Kenwood
    "IC-", "F", "V",               # Icom
    "PD", "HP", "BD", "MD",        # Hytera
    "XPR", "APX", "DP", "DM",      # Motorola
    "NT-", "PT-", "PR-",           # Ritron
]

DEFAULT_INCLUDES = "Battery | Belt Clip | Charger | Antenna | User Guide | Warranty"
# ============================

def normalize(s):
    return re.sub(r'[\s\-]+', '', str(s).upper())

# ---------- Connect ----------
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SPREADSHEET_ID)
sheet = ss.worksheet(WORKSHEET_NAME) if WORKSHEET_NAME else ss.get_worksheet(0)

print(f"Connected to: '{sheet.title}'")

all_values = sheet.get_all_values()
headers = all_values[0]
col = {h: i for i, h in enumerate(headers)}

required = ["model", "price", "includes", "catalog-copy", "features", "brand", "type"]
for r in required:
    if r not in col:
        raise SystemExit(f"Missing column: {r}")

existing = {}
for idx, row in enumerate(all_values[1:], start=2):
    if row and row[0].strip():
        existing[row[0].strip().upper()] = idx

print(f"Found {len(existing)} existing models in the sheet.")

# ---------- Extract ----------
print("\n📄 Reading price book with pymupdf...")
to_update = []
to_create = []
seen = set()

doc = fitz.open(PDF_PATH)
print(f"Total pages: {len(doc)}")

for page in doc:
    text = page.get_text("text") or ""

    # Try to grab a features block from the page
    features_text = ""
    feat_match = re.search(
        r'(?:GENERAL FEATURES|FEATURES|KEY FEATURES)[:\s]*(.*?)(?=\n\s*(?:INCLUDES|SUPPLIED|RADIO|MODEL|BATTERY|SPECIFICATIONS|$))',
        text,
        re.IGNORECASE | re.DOTALL
    )
    if feat_match:
        raw = feat_match.group(1)
        lines = re.split(r'[\n•\-\*]+', raw)
        clean = [re.sub(r'\s+', ' ', l).strip() for l in lines if len(l.strip()) > 8]
        features_text = ", ".join(clean[:20])

    matches = re.findall(
        r'([A-Z]{1,8}[A-Z0-9\-/]{2,}(?:\s+[A-Z0-9\-/]+)?)\s+(.+?)\s+(\d{1,5}\.\d{2})',
        text,
        re.IGNORECASE
    )

    for part, description, price in matches:
        part = part.strip()
        description = description.strip()
        price = price.strip()

        if (len(part) < 4 or
            part.upper().startswith((
                "LIST", "TABLE", "PAGE", "MODEL", "RADIO", "BATTERY",
                "CHARGER", "DESCRIPTION", "MSRP", "IMPORTANT", "NOTE",
                "ACCESSORIES", "CONFIGURATIONS", "TOTAL", "SUBTOTAL"
            ))):
            continue

        candidates = {
            part.upper(),
            normalize(part),
            part.replace(" ", "").upper(),
            normalize(part.replace(" ", ""))
        }

        matched_key = None
        for cand in candidates:
            if cand in existing:
                matched_key = cand
                break
            for sheet_key in existing:
                if normalize(sheet_key) == normalize(cand):
                    matched_key = sheet_key
                    break
            if matched_key:
                break

        includes = ""
        for prefix in PREFIXES:
            if part.upper().startswith(prefix.upper()) or (matched_key and matched_key.startswith(prefix.upper())):
                includes = DEFAULT_INCLUDES
                break

        if matched_key:
            row_num = existing[matched_key]
            if row_num in seen:
                continue
            seen.add(row_num)

            to_update.append({
                "row": row_num,
                "model": matched_key,
                "price": price,
                "includes": includes,
                "catalog_copy": description,
                "features": features_text
            })
        else:
            # New product → create it
            new_model = part
            to_create.append({
                "model": new_model,
                "price": price,
                "includes": includes,
                "catalog_copy": description,
                "features": features_text,
                "brand": BRAND,
                "type": DEFAULT_TYPE
            })

doc.close()

print(f"Found {len(to_update)} items to update")
print(f"Found {len(to_create)} new items to create")

# ---------- Update existing ----------
if to_update:
    print("\nUpdating existing rows...")
    cells = []
    for item in to_update:
        r = item["row"]
        cells.append(gspread.Cell(r, col["price"] + 1, item["price"]))
        cells.append(gspread.Cell(r, col["includes"] + 1, item["includes"]))
        cells.append(gspread.Cell(r, col["catalog-copy"] + 1, item["catalog_copy"]))
        if item["features"]:
            cells.append(gspread.Cell(r, col["features"] + 1, item["features"]))

    BATCH = 30
    for i in range(0, len(cells), BATCH):
        batch = cells[i:i + BATCH]
        sheet.update_cells(batch)
        print(f"  Updated batch {i // BATCH + 1}")
        time.sleep(1.4)

# ---------- Create new rows ----------
if to_create:
    print("\nCreating new rows...")
    rows_to_append = []
    for item in to_create:
        row = [""] * len(headers)
        row[col["model"]] = item["model"]
        row[col["price"]] = item["price"]
        row[col["includes"]] = item["includes"]
        row[col["catalog-copy"]] = item["catalog_copy"]
        row[col["features"]] = item["features"]
        row[col["brand"]] = item["brand"]
        row[col["type"]] = item["type"]
        rows_to_append.append(row)

    BATCH = 20
    for i in range(0, len(rows_to_append), BATCH):
        batch = rows_to_append[i:i + BATCH]
        sheet.append_rows(batch, value_input_option="USER_ENTERED")
        print(f"  Created batch {i // BATCH + 1} ({len(batch)} rows)")
        time.sleep(1.5)

print(f"\nDone!")
print(f"  Updated : {len(to_update)}")
print(f"  Created : {len(to_create)}")