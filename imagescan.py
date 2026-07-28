import os
import csv

# === CHANGE THESE TWO LINES ===
USED_CSV = r"C:\path\to\used_images.csv"      # the CSV you exported
IMAGE_FOLDER = r"C:\path\to\your\image\folder" # the folder to scan
# ==============================

used = set()
with open(USED_CSV, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    next(reader, None)  # skip header if present
    for row in reader:
        if row:
            name = row[0].strip()          # adjust column index if needed
            # remove path or extension if the sheet only has basename
            used.add(os.path.basename(name).lower())

unused = []
for filename in os.listdir(IMAGE_FOLDER):
    if filename.lower() not in used and filename.lower().endswith(('.jpg','.jpeg','.png','.gif','.webp','.bmp')):
        unused.append(filename)

print(f"Found {len(unused)} unused images:")
for u in sorted(unused):
    print(u)

# Optional: write the list to a file
with open("unused_images.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(sorted(unused)))