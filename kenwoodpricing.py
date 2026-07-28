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

BRAND = "Kenwood"
DEFAULT_TYPE = "portable"

PREFIXES = ["NX-", "TK-", "PKT-", "NX", "TK", "PKT"]
DEFAULT_INCLUDES = "Battery | Belt Clip | Charger | Antenna | Owner’s Manual | Warranty: 2 or 3 years*"
# ============================

def normalize(s):
    return re.sub(r'[\s\-]+', '', str(s).upper())

def core_family(s):
    n = normalize(s)
    m = re.match(r'^([A-Z]+)(\d{3,4})', n)
    if m:
        return m.group(1) + m.group(2)
    return n[:6]

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

required = ["model", "price", "includes", "catalog-copy", "brand", "type"]
for r in required:
    if r not in col:
        raise SystemExit(f"Missing column: {r}")

existing = {}
existing_families = set()

for idx, row in enumerate(all_values[1:], start=2):
    if row and row[0].strip():
        model = row[0].strip().upper()
        existing[model] = idx
        existing_families.add(core_family(model))

print(f"Found {len(existing)} existing models")
print(f"Active families on sheet: {sorted(existing_families)}")

# ---------- Extract ----------
print("\n📄 Reading Kenwood price book...")
to_update = []
to_create = []
seen_rows = set()
seen_new = set()

with pdfplumber.open(PDF_PATH) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    for page in pdf.pages:
        text = page.extract_text() or ""

        # Primary pattern
        matches = re.findall(
            r'((?:NX|TK|PKT)[-\s]?[A-Z0-9]{3,}[A-Z0-9/]*)\s+(.+?)\s+(\d{2,5}\.\d{2})',
            text,
            re.IGNORECASE
        )

        # Second pass for table-style rows
        table_matches = re.findall(
            r'(NX-\d{4}[A-Z0-9/]*|TK-\d{4}[A-Z0-9/]*|PKT-\d{3}[A-Z0-9/]*)\s+([^\n]{8,90}?)\s+(\d{2,5}\.\d{2})',
            text,
            re.IGNORECASE
        )

        all_matches = matches + table_matches

        for part, description, price in all_matches:
            part = part.strip()
            description = description.strip()
            price = price.strip()

            if (len(part) < 5 or
                part.upper().startswith((
                    "LIST", "TABLE", "PAGE", "MODEL", "RADIO", "BATTERY",
                    "CHARGER", "DESCRIPTION", "MSRP", "IMPORTANT", "NOTE",
                    "ACCESSORIES", "CONFIGURATIONS", "TOTAL", "SUBTOTAL", "MAP"
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
                if row_num in seen_rows:
                    continue
                seen_rows.add(row_num)

                to_update.append({
                    "row": row_num,
                    "model": matched_key,
                    "price": price,
                    "includes": includes,
                    "catalog_copy": description
                })
            else:
                # Only create if it belongs to a family we already have
                family = core_family(part)
                if family not in existing_families:
                    continue

                norm_new = normalize(part)
                if norm_new in seen_new:
                    continue
                seen_new.add(norm_new)

                to_create.append({
                    "model": part,
                    "price": price,
                    "includes": includes,
                    "catalog_copy": description,
                    "brand": BRAND,
                    "type": DEFAULT_TYPE
                })

print(f"\nFound {len(to_update)} existing items to update")
print(f"Found {len(to_create)} related variations to create")

# ---------- Update existing ----------
if to_update:
    print("\nUpdating existing rows...")
    cells = []
    for item in to_update:
        r = item["row"]
        cells.append(gspread.Cell(r, col["price"] + 1, item["price"]))
        cells.append(gspread.Cell(r, col["includes"] + 1, item["includes"]))
        cells.append(gspread.Cell(r, col["catalog-copy"] + 1, item["catalog_copy"]))

    BATCH = 30
    for i in range(0, len(cells), BATCH):
        batch = cells[i:i + BATCH]
        sheet.update_cells(batch)
        print(f"  Updated batch {i // BATCH + 1}")
        time.sleep(1.4)

# ---------- Create related variations ----------
if to_create:
    print("\nCreating related variations...")
    rows_to_append = []
    for item in to_create:
        row = [""] * len(headers)
        row[col["model"]] = item["model"]
        row[col["price"]] = item["price"]
        row[col["includes"]] = item["includes"]
        row[col["catalog-copy"]] = item["catalog_copy"]
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