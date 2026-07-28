import os
from pathlib import Path

# ============================================
# CHANGE THESE
# ============================================
UNUSED_LIST = r"C:\Users\kklyb\OneDrive\Documents\TA Radio Website\kenwood\unusedimages.csv"   # your list of unused files
TARGET_FOLDER = r"C:\Users\kklyb\OneDrive\Documents\TA Radio Website\kenwood\images"  # optional safety check
# ============================================

# Create a folder to move the files into (safer than permanent delete)
TO_DELETE = os.path.join(os.path.dirname(UNUSED_LIST), "_TO_DELETE")
os.makedirs(TO_DELETE, exist_ok=True)

with open(UNUSED_LIST, encoding="utf-8") as f:
    paths = [line.strip() for line in f if line.strip()]

print(f"Found {len(paths)} files in the list.")

moved = 0
for path in paths:
    if not os.path.isfile(path):
        print(f"Skipping (not found): {path}")
        continue

    try:
        filename = os.path.basename(path)
        dest = os.path.join(TO_DELETE, filename)

        # Avoid overwriting if same name already exists
        counter = 1
        while os.path.exists(dest):
            name, ext = os.path.splitext(filename)
            dest = os.path.join(TO_DELETE, f"{name}_{counter}{ext}")
            counter += 1

        os.rename(path, dest)
        print(f"Moved: {path}")
        moved += 1
    except Exception as e:
        print(f"Error moving {path}: {e}")

print(f"\nDone. {moved} files moved to:\n{TO_DELETE}")
print("Review the folder, then delete it when you're sure.")