import fitz  # pymupdf
import re
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========== CONFIG ==========
PDF_PATH = "LMR_List_May_2026.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None

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

try:
    model_col    = headers.index("model") + 1
    price_col    = headers.index("price") + 1
    includes_col = headers.index("includes") + 1
    catalog_col  = headers.index("catalog-copy") + 1
    features_col = headers.index("features") + 1
except ValueError as e:
    print("ERROR: Missing required column →", e)
    print("Headers found:", headers)
    exit()

existing = {}
for idx, row in enumerate(all_values[1:], start=2):
    if row and row[0].strip():
        existing[row[0].strip().upper()] = idx

print(f"Found {len(existing)} existing models in the sheet.")

# ---------- Extract ----------
print("\n📄 Reading price book with pymupdf...")
updates = []
seen = set()

doc = fitz.open(PDF_PATH)
print(f"Total pages: {len(doc)}")

for page in doc:
    text = page.get_text("text") or ""

    # ----- 1. Try to extract a General Features block -----
    features_text = ""
    feat_match = re.search(
        r'(?:GENERAL FEATURES|FEATURES|KEY FEATURES)[:\s]*(.*?)(?=\n\s*(?:INCLUDES|SUPPLIED|RADIO|MODEL|BATTERY|SPECIFICATIONS|$))',
        text,
        re.IGNORECASE | re.DOTALL
    )
    if feat_match:
        raw = feat_match.group(1)
        # Clean into comma-separated features
        lines = re.split(r'[\n•\-\*]+', raw)
        clean = [re.sub(r'\s+', ' ', l).strip() for l in lines if len(l.strip()) > 8]
        features_text = ", ".join(clean[:20])   # limit to 20 features

    # ----- 2. Extract model + description + price -----
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

        if not matched_key:
            continue

        row_num = existing[matched_key]
        if row_num in seen:
            continue
        seen.add(row_num)

        includes = ""
        for prefix in PREFIXES:
            if part.upper().startswith(prefix.upper()) or matched_key.startswith(prefix.upper()):
                includes = DEFAULT_INCLUDES
                break

        updates.append({
            "row": row_num,
            "model": matched_key,
            "price": price,
            "includes": includes,
            "catalog_copy": description,
            "features": features_text          # may be empty on many pages
        })

doc.close()
print(f"Found {len(updates)} matching items.")

# ---------- Update (batched) ----------
print("\nUpdating price, includes, catalog-copy, and features...")

cells = []
for item in updates:
    r = item["row"]
    cells.append(gspread.Cell(r, price_col, item["price"]))
    cells.append(gspread.Cell(r, includes_col, item["includes"]))
    cells.append(gspread.Cell(r, catalog_col, item["catalog_copy"]))
    if item["features"]:
        cells.append(gspread.Cell(r, features_col, item["features"]))

BATCH = 30
for i in range(0, len(cells), BATCH):
    batch = cells[i:i + BATCH]
    sheet.update_cells(batch)
    print(f"  Updated batch {i // BATCH + 1}")
    time.sleep(1.4)

print(f"\nDone! Updated {len(updates)} existing rows.")
print("No new rows were created.")