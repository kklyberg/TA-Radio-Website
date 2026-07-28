import pdfplumber
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "LMR_List_May_2026.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

PREFIXES = ["NX"]
DEFAULT_INCLUDES = "Battery | Belt Clip | Charger | Antenna | Owner’s Manual | Warranty: 2 or 3 years*"

# Manual overrides for items the PDF parser keeps missing
MANUAL_OVERRIDES = {
    
    # Add more as needed
}
# ============================

# ---------- Connect to Google Sheet ----------
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

try:
    model_col = headers.index("model") + 1
    price_col = headers.index("price") + 1
    includes_col = headers.index("includes") + 1
    catalog_copy_col = headers.index("catalog-copy") + 1
except ValueError as e:
    print("ERROR: Missing required column →", e)
    print("Headers found:", headers)
    exit()

# model → row number
existing = {}
for idx, row in enumerate(all_values[1:], start=2):
    if row and row[0].strip():
        existing[row[0].strip().upper()] = idx

print(f"Found {len(existing)} existing models in the sheet.")

# ---------- Extract from price book ----------
print("\n📄 Reading Icom price book...")
updates = []

with pdfplumber.open(PDF_PATH) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""

        matches = re.findall(
            r'([A-Z]{1,6}[A-Z0-9\-]*(?:\s+\d{1,3})?(?:\s+USA)?)\s+(.+?)\s+\$?(\d{1,4}\.\d{2})',
            text,
            re.IGNORECASE
        )

        for part, description, price in matches:
            part = part.strip()
            description = description.strip()
            price = price.strip()

            if (len(part) < 3 or
                part.upper().startswith((
                    "LIST", "TABLE", "PAGE", "MODEL", "IMPORTANT", "RADIO",
                    "DESCRIPTION", "MSRP", "ACCESSORIES", "CONFIGURATIONS",
                    "ANTENNAS", "BATTERIES", "CHARGERS", "HEADSETS",
                    "MICROPHONES", "SOFTWARE", "WIRE", "TRUNKING", "LAND"
                ))):
                continue

            # Build candidates
            candidates = set()
            raw = part.upper().strip()
            candidates.add(raw)

            cleaned = re.sub(r'\s+\d{1,3}\s+USA$', '', raw, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r'\s+', '', cleaned)
            candidates.add(cleaned)

            no_dash = cleaned.replace("-", "")
            candidates.add(no_dash)

            match = re.match(r'^([A-Z]+)(\d+.*)$', no_dash)
            if match:
                with_dash = f"{match.group(1)}-{match.group(2)}"
                candidates.add(with_dash)

            if no_dash.startswith("FASC"):
                candidates.add("FA-SC" + no_dash[4:])
                candidates.add(no_dash.replace("FASC", "FA-SC"))

            for c in list(candidates):
                if not c.startswith("IC-"):
                    candidates.add("IC-" + c)

            # Find match
            matched_key = None
            for cand in candidates:
                if cand in existing:
                    matched_key = cand
                    break

            if not matched_key:
                continue

            includes = ""
            if any(matched_key.startswith(p.upper()) or part.upper().startswith(p.upper())
                   for p in PREFIXES):
                includes = DEFAULT_INCLUDES

            updates.append({
                "row": existing[matched_key],
                "model": matched_key,
                "price": price,
                "includes": includes,
                "catalog_copy": description
            })

# ---------- Apply manual overrides ----------
for model, info in MANUAL_OVERRIDES.items():
    key = model.upper()
    if key in existing:
        # Remove any previous weak entry for this model
        updates = [u for u in updates if u["model"] != key]
        updates.append({
            "row": existing[key],
            "model": key,
            "price": info["price"],
            "includes": "",
            "catalog_copy": info["catalog_copy"]
        })
        print(f"  Manual override: {model} → ${info['price']} | {info['catalog_copy']}")

print(f"\nFound {len(updates)} items to update.")

# ---------- Update the sheet (batched) ----------
print("\nUpdating price, includes, and catalog-copy...")

cells = []
for item in updates:
    row_num = item["row"]
    cells.append(gspread.Cell(row_num, price_col, item["price"]))
    cells.append(gspread.Cell(row_num, includes_col, item["includes"]))
    cells.append(gspread.Cell(row_num, catalog_copy_col, item["catalog_copy"]))

BATCH_SIZE = 30
updated_count = 0

for i in range(0, len(cells), BATCH_SIZE):
    batch = cells[i:i + BATCH_SIZE]
    sheet.update_cells(batch)
    updated_count += len(batch) // 3
    print(f"  Updated batch {i // BATCH_SIZE + 1} ({len(batch)//3} models)")
    time.sleep(1.5)

print(f"\nDone! Updated {updated_count} existing rows.")
print("No new rows were created.")