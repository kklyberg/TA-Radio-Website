import pdfplumber
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "Hytera_US_DMR_MSRP_Price_Book_1-2026.pdf"   # ← your Hytera price book
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

# Manual overrides for stubborn items
MANUAL = {
    # Add any that still fail after the first run
    # "BL2001": ("89.00", "Li-ion battery 2000mAh"),
}
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

for r in ["model", "type", "price", "short-description", "catalog-copy"]:
    if r not in col:
        raise SystemExit(f"Missing column: {r}")

# ---------- Find Hytera accessories in the sheet ----------
accessories = []
for idx, row in enumerate(all_values[1:], start=2):
    model = str(row[col["model"]]).strip()
    typ = str(row[col["type"]]).strip().lower()
    brand = str(row[col.get("brand", 0)]).strip().lower() if "brand" in col else ""

    if not model:
        continue

    # Hytera accessory detection
    if ("accessory" in typ or
        "hytera" in brand or
        model.upper().startswith((
            "BL", "BC", "CH", "MCA", "POA", "AN", "EHN", "ESM", "SM",
            "PC", "RO", "ISL", "PS", "NCN", "LCY", "MCA", "PWC", "EAS",
            "ECN", "EAN", "BRK", "CK", "DB", "GPS", "RCC", "SW"
        ))):
        accessories.append({
            "row": idx,
            "model": model,
            "norm": normalize(model)
        })

print(f"Found {len(accessories)} Hytera accessories in the sheet")

# ---------- Read Hytera price book ----------
print("\nReading Hytera price book...")
price_book = {}

with pdfplumber.open(PDF_PATH) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ""
        matches = re.findall(
            r'([A-Z]{1,6}[A-Z0-9\-]{2,})\s+(.+?)\s+(\d{1,5}\.\d{2})',
            text,
            re.IGNORECASE
        )
        for part, desc, price in matches:
            part = part.strip()
            desc = desc.strip()
            if len(part) < 3 or len(desc) < 6:
                continue
            key = normalize(part)
            price_book[key] = (price.strip(), desc)

print(f"Loaded {len(price_book)} items from price book")

# ---------- Match & update ----------
updates = []
matched_norms = set()

for acc in accessories:
    if acc["norm"] in price_book:
        price, description = price_book[acc["norm"]]
        updates.append({
            "row": acc["row"],
            "model": acc["model"],
            "price": price,
            "short_description": description,
            "catalog_copy": description
        })
        matched_norms.add(acc["norm"])
        print(f"  ✓ {acc['model']} → {description[:70]}...")

# Manual overrides
for model, (price, desc) in MANUAL.items():
    key = normalize(model)
    if key in matched_norms:
        continue
    for acc in accessories:
        if acc["norm"] == key:
            updates.append({
                "row": acc["row"],
                "model": acc["model"],
                "price": price,
                "short_description": desc,
                "catalog_copy": desc
            })
            print(f"  ✓ {model} (manual) → {desc[:60]}...")
            break

print(f"\nWill update {len(updates)} accessories")

if not updates:
    print("Nothing to update.")
    exit()

cells = []
for item in updates:
    r = item["row"]
    cells.append(gspread.Cell(r, col["price"] + 1, item["price"]))
    cells.append(gspread.Cell(r, col["short-description"] + 1, item["short_description"]))
    cells.append(gspread.Cell(r, col["catalog-copy"] + 1, item["catalog_copy"]))

BATCH = 30
for i in range(0, len(cells), BATCH):
    batch = cells[i:i + BATCH]
    sheet.update_cells(batch)
    print(f"  Wrote batch {i // BATCH + 1}")
    time.sleep(1.4)

print("\nDone. Hytera accessory short-descriptions should now be filled.")