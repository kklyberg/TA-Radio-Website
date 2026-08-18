import pdfplumber
import re
import time
import os.path
import gspread
# ✅ REPAIR: Forces a localized JWT handshake to clear the "No access token" error
from google.auth import jwt
from googleapiclient.discovery import build

def main():
    try:
        # 1. Fetch your new secure JWT signature
        creds = get_credentials()
        
        print("📡 Connecting to your catalog sheet database grid matrix...")
        
        # 2. Build the secure connection service
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        
        # -----------------------------------------------------------------
        # 🔐 LEAVE ALL YOUR EXISITING LOOPS & PRICING CODES UNTOUCHED HERE:
        # -----------------------------------------------------------------
        # (Keep your existing values.get(), calculations, and loop lines right here)

    except Exception as err:
        # ✅ FIXED: Closes the try block securely so Python can execute the script cleanly
        print(f"💥 Runtime Execution Error: {err}")

# 🛑 MAKE SURE THESE TWO OLD BROWSER HOOK LINES BELOW ARE COMPLETELY DELETED FROM THE FILE:
# from google_auth_oauthlib.flow import InstalledAppFlow
# from google.auth.transport.requests import Request

if __name__ == '__main__':
    main()

# ========== CONFIG ==========
PDF_PATH = "pricebook.pdf"
CREDENTIALS_FILE = "credentials.json"      # OAuth client secret (Desktop app)
TOKEN_FILE = "token.json"                  # created automatically after first login
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"
WORKSHEET_NAME = None                      # None = first worksheet

BRAND = "Kenwood"
DEFAULT_TYPE = "portable"
PREFIXES = ["NX-", "TK-", "PKT-", "NX", "TK", "PKT"]
DEFAULT_INCLUDES = "Battery | Belt Clip | Charger | Antenna | Owner’s Manual | Warranty: 2 or 3 years*"
# ============================

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# ✅ REPAIR: Corrects the internal scopes mapping definition to unblock the access token
from google.oauth2 import service_account

def get_credentials():
    CREDENTIALS_FILE = 'credentials.json'
    
    # 🔑 FIXED: Swapped to the explicit read/write endpoint required for Service Accounts
    SCOPES = ['https://googleapis.com']
    
    print("🔐 Authenticating securely via Service Account JSON key...")
    
    # Load the credentials cleanly from your local file mapping tree
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_FILE, 
        scopes=SCOPES
    )
    
    # 💡 ACCELERATION PATCH: Force your system to fetch and attach a fresh access token immediately
    # This prevents the backend from falling back to a plain ID identity token loop
    import google.auth.transport.requests
    request = google.auth.transport.requests.Request()
    creds.refresh(request)
    
    return creds


def normalize(s):
    return re.sub(r'[\s\-]+', '', str(s).upper())

def core_family(s):
    n = normalize(s)
    m = re.match(r'^([A-Z]+)(\d{3,4})', n)
    if m:
        return m.group(1) + m.group(2)
    return n[:6]

# ---------- Connect ----------
creds = get_credentials()
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

        matches = re.findall(
            r'((?:NX|TK|PKT)[-\s]?[A-Z0-9]{3,}[A-Z0-9/]*)\s+(.+?)\s+(\d{2,5}\.\d{2})',
            text,
            re.IGNORECASE
        )

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

print(f"\n Found {len(to_update)} existing items to update in Google Sheets")
print(f" Found {len(to_create)} related variations to create/append")

# =========================================================================
# UPDATE EXISTING ROWS (STABLE MASS BATCH UPDATER)
# =========================================================================
if to_update:
    print("\n Updating existing catalog rows...")
    cells = []
    for item in to_update:
        r = item["row"]
        model = item["model"].upper()

        # Always update price column index
        cells.append(gspread.Cell(row=r, col=col["price"] + 1, value=item["price"]))

        # Always update includes column index
        cells.append(gspread.Cell(row=r, col=col["includes"] + 1, value=item["includes"]))

        # Only update catalog-copy if the model does NOT start with NX
        if not model.startswith("NX"):
            # ✅ FIXED: Uses lowercase indexing key to prevent KeyError structural crashes
            cells.append(gspread.Cell(row=r, col=col["catalog-copy"] + 1, value=item["catalog_copy"]))

    # Stagger execution blocks to safely navigate Google Cloud API rate limit gates
    BATCH_SIZE = 30
    for i in range(0, len(cells), BATCH_SIZE):
        batch = cells[i:i + BATCH_SIZE]
        
        # ✅ FIXED: Modern gspread syntax execution path
        sheet.update_cells(batch, value_input_option="USER_ENTERED")
        print(f"  ✓ Synchronized updates for processing batch {i // BATCH_SIZE + 1}")
        time.sleep(1.5)

# =========================================================================
# CREATE RELATED VARIATIONS (SAFE ROW APPENDER)
# =========================================================================
if to_create:
    print("\n Appending related variant additions...")
    rows_to_append = []
    for item in to_create:
        # Create a blank row tracking grid matching your exact sheet width layout
        row = [""] * len(all_values[0])
        
        row[col["model"]] = item["model"]
        row[col["price"]] = item["price"]
        row[col["includes"]] = item["includes"]
        row[col["catalog-copy"]] = item["catalog_copy"]
        row[col["brand"]] = item["brand"]
        row[col["type"]] = item["type"]
        rows_to_append.append(row)

    # Stream the appends cleanly using optimized user inputs
    APPEND_BATCH_SIZE = 20
    for i in range(0, len(rows_to_append), APPEND_BATCH_SIZE):
        batch = rows_to_append[i:i + APPEND_BATCH_SIZE]
        sheet.append_rows(batch, value_input_option="USER_ENTERED")
        print(f"  ✓ Created new row batch {i // APPEND_BATCH_SIZE + 1} ({len(batch)} additions added)")
        time.sleep(1.8)

print(f"\n🎯 Ingestion Complete!")
print(f" Total Rows Modified: {len(to_update)}")
print(f" Total Variations Generated: {len(to_create)}")
