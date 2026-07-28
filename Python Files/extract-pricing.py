import pdfplumber
import re
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "Hytera_US_DMR_MSRP_Price_Book_1-2026.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None          # None = first tab

# Only apply the includes text to these prefixes
PREFIXES = [
    "NX-",      # Kenwood NEXEDGE
    # "TK-",
    # "IC-",
]

DEFAULT_INCLUDES = "Belt Clip (KBH-11) | Universal Connector Cap | User Guide | Premium Warranty: 3 Years*"
# ============================

# ---------- 1. Connect to Google Sheet ----------
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
gc = gspread.authorize(creds)
ss = gc.open_by_key(SPREADSHEET_ID)
sheet = ss.worksheet(WORKSHEET_NAME) if WORKSHEET_NAME else ss.get_worksheet(0)

print(f"Connected to sheet: '{sheet.title}'")

# Get all existing models and their row numbers (for fast lookup)
existing = {}          # model.upper() → row number
all_values = sheet.get_all_values()
headers = all_values[0] if all_values else []

# Find column indexes
try:
    model_col = headers.index("model") + 1
    price_col = headers.index("price") + 1
    includes_col = headers.index("includes") + 1
except ValueError as e:
    print("ERROR: Could not find required columns (model, price, includes)")
    print("Headers found:", headers)
    raise

for idx, row in enumerate(all_values[1:], start=2):  # start=2 because row 1 is header
    if row and row[0].strip():
        existing[row[0].strip().upper()] = idx

print(f"Found {len(existing)} existing models in the sheet.")

# ---------- 2. Extract from price book ----------
print("\n📄 Reading price book...")
updates = []

with pdfplumber.open(PDF_PATH) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        matches = re.findall(
            r'([A-Z0-9\-]+(?:K\d|ISCK\d)?)\s+(.+?)\s+(\d{1,4}\.\d{2})',
            text
        )
        for part, description, price in matches:
            part = part.strip()
            price = price.strip()

            if len(part) < 5 or part.startswith(("LIST", "Table", "IMPORTANT", "RADIO")):
                continue

            part_upper = part.upper()

            # Only process if this model already exists in the sheet
            if part_upper not in existing:
                continue

            # Decide includes
            includes = ""
            for prefix in PREFIXES:
                if part.startswith(prefix):
                    includes = DEFAULT_INCLUDES
                    break

            row_num = existing[part_upper]
            updates.append({
                "row": row_num,
                "model": part,
                "price": price,
                "includes": includes
            })

print(f"Found {len(updates)} matching items that already exist in the sheet.")

# ---------- 3. Update the sheet (price + includes only) ----------
print("\nUpdating Google Sheet...")
updated_count = 0

for item in updates:
    row = item["row"]
    # Update price
    sheet.update_cell(row, price_col, item["price"])
    # Update includes
    sheet.update_cell(row, includes_col, item["includes"])
    updated_count += 1
    print(f"  ✓ {item['model']}  →  ${item['price']}")

print(f"\nDone! Updated {updated_count} existing rows.")
print("No new rows were created.")