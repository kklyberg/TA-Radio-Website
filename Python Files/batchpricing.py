import pdfplumber
import re
import time
import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "LMR_List_May_2026.pdf"
BRAND = "Kenwood"          # Kenwood | Hytera | Icom | Motorola | Ritron
BRAND_FOLDER = "kenwood"
PAGE_RANGE = "63"          # e.g. (20, 25) or None = all pages

CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None      # None = first sheet
# ============================

INCLUDES_MAP = {
    "portable":   "Battery | Antenna | Belt Clip | Charger | User Guide | Warranty",
    "mobile":     "Mounting Bracket | DC Power Cable | Microphone | User Guide | Warranty",
    "repeater":   "User Guide | Warranty",
    "accessory":  "",
    "battery":    "",
    "charger":    "",
    "antenna":    "",
    "microphone": "",
    "default":    "User Guide | Warranty",
}

PART_PATTERNS = {
    "Kenwood": re.compile(
        r'\b([A-Z]{1,4}-\d{3,4}(?:-[A-Z0-9]+)?(?:K\d?|ISCK\d?|BK)?)\b'
    ),
    "Hytera": re.compile(
        r'\b((?:BD|PD|HP|MD|RD|TC|X1)[A-Z0-9\-]+|[A-Z]{2,4}\d{2,5}[A-Z]{0,3}(?:-[A-Z0-9]+)?)\b',
        re.IGNORECASE,
    ),
    "Icom": re.compile(
        r'\b((?:IC-)?[A-Z]{1,4}\d{0,4}[A-Z]{0,6}(?:\s+\d{1,3})?(?:\s+[A-Z]{2,4})?)\b'
    ),
    "Motorola": re.compile(
        r'\b([A-Z]{2,4}\d{3,4}[A-Z0-9]*(?:-[A-Z0-9]+)?)\b'
    ),
    "Ritron": re.compile(
        r'\b([A-Z]{1,4}-?[A-Z0-9]{2,10})\b'
    ),
}

HYTERA_RADIO = re.compile(
    r'\b((?:BD|PD|HP|MD|RD|TC|X1)\d{2,4}[A-Z]?i?(?:-[A-Z0-9]+)+)\b',
    re.IGNORECASE,
)

PART_PATTERN = PART_PATTERNS.get(BRAND, PART_PATTERNS["Kenwood"])
PRICE_PATTERN = re.compile(r'\$?\s*(\d{1,5}\.\d{2})')

JUNK = {
    "LIST", "PAGE", "TOTAL", "PRICE", "MODEL", "ITEM", "MSRP", "QTY",
    "DESCRIPTION", "RADIO", "IP54", "IP66", "IP67", "IP68", "MIL", "STD",
    "BAND", "SPLIT", "POWER", "WATTS", "SPECS", "FEATURES", "USA",
}

scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SPREADSHEET_ID)
sheet = ss.worksheet(WORKSHEET_NAME) if WORKSHEET_NAME else ss.get_worksheet(0)

print(f"Connected: '{sheet.title}'")
print(f"Brand: {BRAND} | File: {PDF_PATH} | Exists: {os.path.isfile(PDF_PATH)}")

all_values = sheet.get_all_values()
headers = all_values[0]
col = {h: i for i, h in enumerate(headers)}

required = [
    "model", "brand", "type", "price", "image", "includes", "features",
    "specLink", "specTable", "compatibleModels", "short-description",
    "industry", "catalog-copy", "root-model",
]
for r in required:
    if r not in col:
        raise SystemExit(f"Missing column: {r}")

if sheet.row_count < 5000:
    sheet.add_rows(5000 - sheet.row_count)

existing = {}
for idx, row in enumerate(all_values[1:], start=2):
    if row and str(row[0]).strip():
        existing[str(row[0]).strip().upper()] = idx

print(f"Models in sheet: {len(existing)}")

def guess_type(model):
    m = model.upper()
    if any(x in m for x in ["BL", "BP", "BATTERY", "KNB", "BP2", "BP3"]):
        return "battery"
    if any(x in m for x in ["CH10", "CHV", "CHARGER", "PS10", "BC1", "BC2", "BC-"]):
        return "charger"
    if any(x in m for x in ["AN0", "ANTENNA", "KRA", "FASC", "FA-SC"]):
        return "antenna"
    if any(x in m for x in ["HM1", "HM2", "HS9", "MIC", "EHS", "ESW", "KMC"]):
        return "microphone"
    if any(x in m for x in ["MD", "MOBILE", "TM-", "F50", "F60", "F501", "F601"]):
        return "mobile"
    if any(x in m for x in ["RD", "REPEATER", "FR5", "FR9", "CY5", "SLR"]):
        return "repeater"
    if any(x in m for x in [
        "NX-", "BD", "PD", "HP", "APX", "XPR", "IC-F",
        "V3MR", "V10MR", "F200", "F1000", "F2000", "F3000", "F4000", "F5000", "F7000",
    ]):
        return "portable"
    return "accessory"

def find_part(text):
    if BRAND == "Hytera":
        m = HYTERA_RADIO.search(text)
        if m:
            return m.group(1), True
    m = PART_PATTERN.search(text)
    if not m:
        return None, False
    part = m.group(1).strip()
    is_radio = any(x in part.upper() for x in [
        "NX-", "BD", "PD", "HP", "IC-F", "V3MR", "V10MR", "F200", "APX", "XPR",
    ])
    return part, is_radio

print("\nReading price book...")
price_book = {}

with pdfplumber.open(PDF_PATH) as pdf:
    total = len(pdf.pages)
    if PAGE_RANGE:
        start, end = PAGE_RANGE
        pages = range(max(0, start - 1), min(total, end))
        print(f"Pages {start}–{end} of {total}")
    else:
        pages = range(total)
        print(f"All {total} pages")

    for i in pages:
        page = pdf.pages[i]

        for table in (page.extract_tables() or []):
            for row in table or []:
                cells = [str(c).strip() if c else "" for c in row]
                row_text = " ".join(cells)
                pm = PRICE_PATTERN.search(row_text)
                if not pm:
                    continue
                part, is_radio = find_part(row_text)
                if not part or part.upper() in JUNK or len(part) < 3:
                    continue
                desc = " ".join(
                    c for c in cells
                    if c and c != part and not PRICE_PATTERN.search(c)
                ).strip()
                price_book[part.upper()] = {
                    "model": part,
                    "price": pm.group(1),
                    "description": desc,
                    "is_radio": is_radio,
                }

        for line in (page.extract_text() or "").splitlines():
            line = line.strip()
            if len(line) < 6:
                continue
            pm = re.search(r'\$?\s*(\d{1,5}\.\d{2})\s*$', line)
            if not pm:
                continue
            part, is_radio = find_part(line)
            if not part or part.upper() in JUNK or len(part) < 3:
                continue
            if part.upper() in price_book:
                continue
            desc = line[line.find(part) + len(part):pm.start()].strip(" -:$")
            price_book[part.upper()] = {
                "model": part,
                "price": pm.group(1),
                "description": desc,
                "is_radio": is_radio,
            }

print(f"Extracted: {len(price_book)} parts")

to_update, to_create = [], []

for key, pb in price_book.items():
    model = pb["model"]
    price = pb["price"]
    desc = pb["description"]
    row_type = guess_type(model)
    includes = INCLUDES_MAP.get(row_type, INCLUDES_MAP["default"])

    if key in existing:
        to_update.append({
            "row": existing[key],
            "price": price,
            "includes": includes if row_type in ("portable", "mobile") else "",
            "catalog_copy": desc,
        })
    else:
        file_base = re.sub(r'[^a-z0-9\-]', '', model.lower().replace(" ", "-"))
        root = model.split()[0] if " " in model else (model.split("-")[0] if "-" in model else model)
        new_row = [""] * len(headers)
        new_row[col["model"]] = model
        new_row[col["brand"]] = BRAND
        new_row[col["type"]] = row_type
        new_row[col["price"]] = price
        new_row[col["image"]] = f"{BRAND_FOLDER}/images/{file_base}.png"
        new_row[col["includes"]] = includes if row_type in ("portable", "mobile") else ""
        new_row[col["features"]] = ""
        new_row[col["specLink"]] = f"{BRAND_FOLDER}/specs/{file_base}.pdf"
        new_row[col["specTable"]] = ""
        new_row[col["compatibleModels"]] = ""
        new_row[col["short-description"]] = desc
        new_row[col["industry"]] = ""
        new_row[col["catalog-copy"]] = desc
        new_row[col["root-model"]] = root
        to_create.append(new_row)

print(f"Update: {len(to_update)} | Create: {len(to_create)}")

BATCH = 15
print("\nUpdating...")
for i in range(0, len(to_update), BATCH):
    batch = to_update[i:i + BATCH]
    cells = []
    for item in batch:
        r = item["row"]
        cells.append(gspread.Cell(r, col["price"] + 1, item["price"]))
        cells.append(gspread.Cell(r, col["includes"] + 1, item["includes"]))
        cells.append(gspread.Cell(r, col["catalog-copy"] + 1, item["catalog_copy"]))
    if cells:
        sheet.update_cells(cells)
    print(f"  batch {i // BATCH + 1}")
    time.sleep(1.1)

print("Creating...")
for i in range(0, len(to_create), BATCH):
    batch = to_create[i:i + BATCH]
    if batch:
        sheet.append_rows(batch, value_input_option="USER_ENTERED")
    print(f"  batch {i // BATCH + 1} ({len(batch)} rows)")
    time.sleep(1.2)

print(f"\nDone. Updated {len(to_update)}, created {len(to_create)}")