import pdfplumber
import csv
import re

pdf_path = "pricebook.pdf"
output_csv = "part_numbers_full.csv"

# ============================================================
# EDIT THIS SECTION FOR EACH MANUFACTURER / PRICE BOOK
# ============================================================

# List of prefixes that should receive the includes list
# Add as many as you need
PREFIXES = [
    "NX-",          # Kenwood NEXEDGE
    # "TK-",        # example for another Kenwood series
    # "IC-",        # example for Icom
    # "VX-",        # example for Vertex
]

# The includes text that will be applied to any matching prefix
DEFAULT_INCLUDES = "Belt Clip (KBH-11) | Universal Connector Cap | User Guide | Premium Warranty: 3 Years*"

# ============================================================

results = []

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")

    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""

        matches = re.findall(
            r'([A-Z0-9\-]+(?:K\d|ISCK\d)?)\s+(.+?)\s+(\d{1,4}\.\d{2})',
            text
        )

        for part, description, price in matches:
            part = part.strip()
            description = description.strip()
            price = price.strip()

            if len(part) < 5 or part.startswith(("LIST", "Table", "IMPORTANT", "RADIO")):
                continue

            # Check if the part number starts with any of the allowed prefixes
            includes = ""
            for prefix in PREFIXES:
                if part.startswith(prefix):
                    includes = DEFAULT_INCLUDES
                    break

            results.append({
                "page": i + 1,
                "part_number": part,
                "description": description,
                "price": price,
                "includes": includes
            })

# Remove duplicates
seen = set()
unique_results = []
for item in results:
    if item["part_number"] not in seen:
        seen.add(item["part_number"])
        unique_results.append(item)

# Save
with open(output_csv, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["page", "part_number", "description", "price", "includes"])
    writer.writeheader()
    writer.writerows(unique_results)

print(f"\nDone! Extracted {len(unique_results)} items → {output_csv}")