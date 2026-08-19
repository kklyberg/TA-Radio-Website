import pdfplumber
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "LMR_List_May_2026.pdf"          # your Kenwood price book
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

# Manual overrides for items the automatic parser keeps missing

MANUAL = {
    "KAP-2":        ("125.00", "Interface adapter"),
    "KCH-19":       ("285.00", "Control head"),
    "KCH-20R":      ("325.00", "Remote control head"),
    "KCT-23":       ("45.00",  "Ignition sense cable"),
    "KCT-46":       ("55.00",  "Ignition sense cable"),
    "KCT-71":       ("65.00",  "Connection cable"),
    "KCT-72":       ("75.00",  "Connection cable"),
    "KES-5":        ("89.00",  "External speaker"),
    "KES-5A":       ("89.00",  "External speaker"),
    "KLF-2":        ("56.30",  "Line filter (suppresses alternator whine)"),
    "KMB-10":       ("35.20",  "Key lock adapter"),
    "KMC-35":       ("89.00",  "Speaker microphone"),
    "KMC-36":       ("95.00",  "Speaker microphone"),
    "KMC-41D":      ("115.00", "Speaker microphone"),
    "KMC-54WD":     ("145.00", "Speaker microphone (waterproof)"),
    "KMC-65":       ("165.00", "Mobile microphone"),
    "KMC-66":       ("175.00", "Mobile microphone with keypad"),
    "KNB-L3":       ("165.00", "Li-ion battery"),
    "KNB-N4":       ("95.00",  "Ni-MH battery"),
    "KPG-180AP":    ("75.00",  "Programming software / license"),
    "KPS-15":       ("232.00", "DC switching power supply"),
    "KRA-32":       ("45.00",  "Antenna"),
    "KRK-14H":      ("85.00",  "Remote kit"),
    "KRK-15B":      ("95.00",  "Remote kit"),
    "KSC-326":      ("185.00", "Multi-unit charger"),
    "KSC-Y32":      ("65.00",  "Charger adapter"),
    "KWD-AE30":     ("299.00", "AES encryption module"),
    "KWD-AE31":     ("299.00", "AES encryption module"),

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

# ---------- Find Kenwood accessories in the sheet ----------
accessories = []
for idx, row in enumerate(all_values[1:], start=2):
    model = str(row[col["model"]]).strip()
    typ = str(row[col["type"]]).strip().lower()
    if not model:
        continue

    if ("accessory" in typ or
        model.upper().startswith((
            "KNB", "KSC", "KBH", "KMC", "KHS", "KEP", "KRA", "KPG",
            "KWR", "KES", "KLH", "KMB", "KCH", "KCT", "KRK", "KAP",
            "KWD", "KLF", "KPS"
        ))):
        accessories.append({
            "row": idx,
            "model": model,
            "norm": normalize(model)
        })

print(f"Found {len(accessories)} Kenwood accessories in the sheet")

# ---------- Read Kenwood price book ----------
print("\nReading Kenwood price book...")
price_book = {}

with pdfplumber.open(PDF_PATH) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ""
        matches = re.findall(
            r'([A-Z]{2,6}[A-Z0-9\-]{2,})\s+(.+?)\s+(\d{1,5}\.\d{2})',
            text,
            re.IGNORECASE
        )
        for part, desc, price in matches:
            part = part.strip()
            desc = desc.strip()
            if len(part) < 4 or len(desc) < 8:
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

print("\nDone. Kenwood accessory short-descriptions should now be filled.")