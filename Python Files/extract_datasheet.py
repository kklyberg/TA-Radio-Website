import pdfplumber
import re
import gspread
from oauth2client.service_account import ServiceAccountCredentials

PDF_PATH = "catalog.pdf"
CREDENTIALS_FILE = "credentials.json"
SPREADSHEET_ID = "1iI4aI70HhgSuxv4o0g2c2Tj4urFxdefmG2gQA02jaT8"   # ← clean ID only
WORKSHEET_NAME = "Sheet1"
# ============================

# Authorize with Google
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]
creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
client = gspread.authorize(creds)
print("Service account email:", creds.service_account_email)
print("Sheets visible to this account:")
for s in client.openall():
    print(" -", s.title, "→", s.id)
ss = client.open_by_key(SPREADSHEET_ID)

# Choose the tab you want
sheet = ss.worksheet("sheet1")   # ← change this
# or
# sheet = ss.get_worksheet(0)             # leftmost tab

# ---------- Extract data from PDF ----------
with pdfplumber.open(PDF_PATH) as pdf:
    full_text = ""
    for page in pdf.pages:
        full_text += (page.extract_text() or "") + "\n\n"

# Root models
root_models = sorted(list(set(["NX-" + m for m in re.findall(r'NX-(\d{4})', full_text)])))

# Short description
short_desc = ""
patterns = [
    r'(A SINGULAR SOLUTION\s+.*?)(?=FEATURE HIGHLIGHTS|GENERAL FEATURES|$)',
    r'(If you are thinking of harnessing.*?right for you\.)',
    r'(NEXEDGE VHF/UHF.*?PORTABLE RADIOS\s+.*?)(?=FEATURE HIGHLIGHTS|GENERAL FEATURES|$)',
]
for pat in patterns:
    match = re.search(pat, full_text, re.DOTALL | re.IGNORECASE)
    if match:
        short_desc = re.sub(r'\s+', ' ', match.group(1)).strip()
        if len(short_desc) > 80:
            break
if not short_desc:
    short_desc = "NEXEDGE VHF/UHF/700-800 MHz MULTI-PROTOCOL DIGITAL & ANALOG PORTABLE RADIOS"

# Features
features = []
sections = re.findall(
    r'(FEATURE HIGHLIGHTS|GENERAL FEATURES|DIGITAL – NXDN MODE|DIGITAL – DMR MODE|DIGITAL – P25 MODE|FM MODES – GENERAL|INTELLIGENT BATTERY SYSTEM)(.*?)(?=FEATURE HIGHLIGHTS|GENERAL FEATURES|DIGITAL|FM MODES|INTELLIGENT|OPTIONAL|SPECIFICATIONS|$)',
    full_text, re.DOTALL | re.IGNORECASE
)
for title, content in sections:
    bullets = re.findall(r'[•●\-]\s*([^\n•●]+)', content)
    for b in bullets:
        clean = b.strip()
        if len(clean) > 8 and clean not in features:
            features.append(clean)

# Accessories
accessories = []
acc_block = re.search(r'OPTIONAL ACCESSORIES(.*?)(SPECIFICATIONS|$)', full_text, re.DOTALL | re.IGNORECASE)
if acc_block:
    parts = re.findall(r'\b(K[A-Z]{1,3}-[A-Z0-9]{1,8})\b', acc_block.group(1))
    accessories = sorted(list(set(parts)))

# ---------- Prepare rows ----------
headers = [
    "model", "brand", "type", "price", "image", "includes", "features",
    "specLink", "specTable", "compatibleModels", "short-description",
    "industry", "catalog-copy", "root-model"
]

rows_to_add = []
for model in root_models:
    row = [
        model,                                      # model
        "Kenwood",                                  # brand
        "portable",                                 # type
        "",                                         # price (from price book later)
        f"kenwood/images/{model.lower()}.png",      # image
        "",                                         # includes
        " | ".join(features[:40]),                  # features
        f"kenwood/specs/{model.lower()}.pdf",       # specLink
        "",                                         # specTable
        " | ".join(accessories),                    # compatibleModels
        short_desc,                                 # short-description
        "Public Safety | Business | Government",    # industry
        short_desc[:160] + "..." if len(short_desc) > 160 else short_desc,  # catalog-copy
        model                                       # root-model
    ]
    rows_to_add.append(row)

# ---------- Write to Google Sheet ----------
if rows_to_add:
    sheet.append_rows(rows_to_add)
    print(f"Successfully added {len(rows_to_add)} rows to the sheet.")
else:
    print("No models found.")