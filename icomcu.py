import pdfplumber
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "Icom - Land Mobile Retail Price Book - April 2026.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

# Manual overrides for items the automatic parser keeps missing
MANUAL = {
    "BP-279":   ("98.00", "Li-ion 7.2V 1485mAh battery"),
    "HM-158LA": ("58.00", "Compact speaker microphone with revolving clip and earphone jack (right angle 2-pin screw down connector, stereo mic/mono speaker)"),
    "MB-133":   ("21.00", "Alligator type belt clip"),
    "BC-242":   ("30.00", "AC adapter"),
    "MB-124":   ("15.00", "Alligator type belt clip"),
    "OPC-478UC":("110.00", "USB programming cable"),
    "HM-166LA": ("82.00", "Earphone microphone with 2-pin right angle connector"),
    "BC-219N":  ("88.00", "Rapid charger for radios with the BP283/BP284/BP294"),
    "BP-284":   ("145.00", "3150mAh li-ion battery"),
    "BC-123S":  ("30.00", "Straight-angle AC adapter for rapid chargers"),
    "HM-222":   ("175.00", "IP68 speaker mic with 2-pin screw down connector and 3.5mm jack"),
    "HM-220":   ("190.00", "IP68 waterproof speaker microphone w/3.5mm accessory jack"),
    "HM-218":   ("132.00", "14-pin loud waterproof speaker mic"),
    "HM-148G":  ("97.00", "Large speaker microphone with earphone jack and metal alligator clip"),
    "HM-152T":  ("58.00", "Compact speaker microphone with revolving clip and earphone jack"),
    "BP-304A":  ("85.00", "2250mAh li-ion battery"),
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

# ---------- Find Icom accessories in the sheet ----------
accessories = []
for idx, row in enumerate(all_values[1:], start=2):
    model = str(row[col["model"]]).strip()
    typ = str(row[col["type"]]).strip().lower()
    if not model:
        continue

    if ("accessory" in typ or
        model.upper().startswith((
            "BP-", "BC-", "MB-", "HM-", "HS-", "FA-", "FASC-", "OPC-",
            "VS-", "SP-", "AD-", "LC-", "NC-", "UT-", "ISL-", "RMK-",
            "BP", "BC", "MB", "HM", "HS", "FA", "OPC", "SM-", "UX-"
        ))):
        accessories.append({
            "row": idx,
            "model": model,
            "norm": normalize(model)
        })

print(f"Found {len(accessories)} Icom accessories in the sheet")

# ---------- Read Icom price book ----------
print("\nReading Icom price book...")
price_book = {}

with pdfplumber.open(PDF_PATH) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ""
        matches = re.findall(
            r'([A-Z]{1,6}[A-Z0-9\-]{2,})\s+(.+?)\s+\$?(\d{1,4}\.\d{2})',
            text,
            re.IGNORECASE
        )
        for part, desc, price in matches:
            part = part.strip()
            desc = desc.strip()
            if len(part) < 3 or len(desc) < 5:
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

# Apply manual overrides for the ones that still failed
for model, (price, desc) in MANUAL.items():
    key = normalize(model)
    if key in matched_norms:
        continue  # already handled by automatic match
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

print("\nDone.")