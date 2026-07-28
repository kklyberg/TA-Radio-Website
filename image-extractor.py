from pathlib import Path
import shutil
import time

# ============================================================
# CONFIGURE THESE TWO PATHS
# ============================================================
SOURCE_FOLDER = Path(r"C:\Users\kklyb\OneDrive\Documents\TA Radio Website\kenwood\small")          # ← change this
OUTPUT_FOLDER = Path(r"C:\Users\kklyb\OneDrive\Documents\TA Radio Website\kenwood\extracted_images")     # ← change this
# ============================================================

desired_files = {
    "KAP-2.png",
    "KCH-19.png",
    "KCH-20R.png",
    "KCT-23.png",
    "KCT-46.png",
    "KCT-71.png",
    "KCT-72.png",
    "KES-5 (A).png",
    "KLF-2.png",
    "KMB-10.png",
    "KMC-35.png",
    "KMC-36.png",
    "KMC-65.png",
    "KMC-66.png",
    "KPS-15.png",
    "KRK-14H.png",
    "KRK-15B.png",
    "KWD-AE30.png",
    "KWD-AE31.png",
    "KBP-5.png",
    "KNB-29N.png",
    "KNB-54N.png",
    "KNB-69L.png",
    "KNB-82LCM.png",
    "KNB-84LM.png",
    "KNB-LS5CU.png",
    "KNB-LS7M.png",
    "KSC-25LSK.png",
    "KSC-25SK.png",
    "KSC-35SK.png",
    "KSC-43K.png",
    "KSC-44MLKS.png",
    "KSC-506K.png",
    "KSC-50K.png",
    "KSC-526K.png",
    "KSC-52BK.png",
    "KSC-52PAW.png",
    "KHS-10DC-BH.png",
    "KHS-10DC-OH.png",
    "KHS-11BL.png",
    "KHS-12BL.png",
    "KHS-14C.png",
    "KHS-15D-OH.png",
    "KHS-15DC-BH.png",
    "KHS-22A.png",
    "KHS-27A.png",
    "KHS-31C.png",
    "KHS-7C.png",
    "KHS-8BL.png",
    "KHS-9BL.png",
    "KCT-18.png",
    "KCT-23M2.png",
    "KCT-23M4.png",
    "KCT-48VU.png",
    "KCT-51.png",
    "KCT-71A100.png",
    "KCT-71A50.png",
    "KCT-71M3.png",
    "KCT-71M4.png",
    "KCT-72M.png",
    "KCT-77M2.png",
    "KCT-90USB.png",
    "KLH-137ST.png",
    "KLH-154K2.png",
    "KLH-187.png",
    "KLH-200K3.png",
    "KLH-201K3.png",
    "KLH-206K.png",
    "KLH-206K2.png",
    "KLH-206K3.png",
    "KLH-207K.png",
    "KLH-207K2.png",
    "KLH-207K3.png",
    "KLH-6SW.png",
    "KCH-20RM.png",
    "KMB-16.png",
    "KMB-23.png",
    "KMB-28AK.png",
    "KMB-33M.png",
    "KMB-34.png",
    "KMB-526K.png",
    "GA25MCX.png",
    "KBH-21W.png",
    "KBH-8DS.png",
    "KBP-10.png",
    "KES-10W.png",
    "KES-5A.png",
    "KVL-3000.png",
    "KVL-4000.png",
    "L-1849.png",
    "L-1873.png",
    "L-1874.png",
    "L-5001.png",
    "L-5002.png",
    "L-5003.png",
    "L-5004.png",
    "L-5005.png",
    "L-5006.png",
    "L-5007.png",
    "L-5008.png",
    "L-5015.png",
    "L-5019.png",
    "L-5024.png",
    "L-5029.png",
    "L-5030.png",
    "L-5031.png",
    "L-5032.png",
    "L-5033.png",
    "L-5034.png",
    "L-5035.png",
    "L-5037.png",
    "L-5039.png",
    "L-5051.png",
    "L-5052.png",
    "L-5053.png",
    "L-5054.png",
    "L-5062.png",
    "L-5068.png",
    "L-5075.png",
    "L-5077.png",
    "L-836.png",
    "L-961.png",
    "NX-1000.png",
    "OPTION.png",
    "SM1PB003.png",
    "SM1PE003.png",
    "SM1PH003.png",
    "NX1200K2.png",
    "NX1200K3.png",
    "NX-1302AUBK.png",
    "nx-3200-isck.png",
    "nx-3200-isck2.png",
    "nx-3200-isck3.png",
    "nx-3200k.png",
    "nx-3200k3.png",
    "NX3220.png",
    "nx-3300-isck.png",
    "nx-3300-isck2.png",
    "nx-3300-isck3.png",
    "nx-3300k.png",
    "nx-3300k3.png",
    "NX3200.png",
    "KPG-115.png",
    "KPG-115AUT.png",
    "KPG-22UM.png",
    "KPG-36XM.png",
    "KPG-46XM.png",
    "KPG-93.png",
    "KPG-93AUT.png",
    "KPG-AE1K.png",
    "KPG-CLN-RJ45.png",
    "KPG-D6NK.png",
    "KPG-DE1K.png",
    "KRK-19BM.png",
    "KWD-1300CAK.png",
    "KWD-1301CN.png",
    "KWD-1500EE.png",
    "KWD-1501RC.png",
    "KWD-3001FP.png",
    "KWD-3002BT.png",
    "KWD-3301CV.png",
    "KWD-3302TR.png",
    "KWD-3501TR.png",
    "KWD-3502EE.png",
    "KWD-3503AE.png",
    "KWD-3504RC.png",
    "KWD-3505DE.png",
    "KWD-5001FP.png",
    "KWD-5002SD.png",
    "KWD-5003BT.png",
    "KWD-5007RC.png",
    "KWD-5101TR.png",
    "KWD-5102TR.png",
    "KWD-5103RK.png",
    "KWD-5105VT.png",
    "KWD-5106DT.png",
    "KWD-5301TR.png",
    "KWD-5500EE.png",
    "KWD-AE31K.png",
    "KWD-ASK-AK.png",
    "KWD-ASK-MK.png",
    "KMC-21A.png",
    "KMC-40.png",
    "KMC-45D.png",
    "KMC-49.png",
    "KMC-59C.png",
    "KMC-66M.png",
    "KMC-9C.png",
    "KVC-22.png",
    "KVC-4.png",
    "KVC-52.png",
    "KNB-45L.png",
    "KRA-22.png",
    "KRA-23.png",
    "KRA-26.png",
    "KRA-27.png",
    "KHS-26.png",
    "KBH-10.png",
}
def safe_copy(src: Path, dst: Path, max_retries: int = 5) -> bool:
    """Try to copy a file several times if it is locked."""
    for attempt in range(1, max_retries + 1):
        try:
            shutil.copy2(src, dst)
            return True
        except PermissionError:
            if attempt < max_retries:
                print(f"  ⚠ Locked – retrying in 1 second... ({attempt}/{max_retries})")
                time.sleep(1)
            else:
                print(f"  ✗ FAILED after {max_retries} attempts: {src.name}")
                return False
        except Exception as e:
            print(f"  ✗ Unexpected error with {src.name}: {e}")
            return False
    return False

def main():
    if not SOURCE_FOLDER.exists():
        print(f"ERROR: Source folder does not exist:\n{SOURCE_FOLDER}")
        return

    OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

    found = set()
    failed = []

    print("Searching and copying files...\n")

    for file_path in SOURCE_FOLDER.rglob("*"):
        if not file_path.is_file():
            continue

        name_lower = file_path.name.lower()
        if name_lower not in {f.lower() for f in desired_files}:
            continue

        dest = OUTPUT_FOLDER / file_path.name

        # Skip if already successfully copied
        if dest.exists() and dest.stat().st_size == file_path.stat().st_size:
            print(f"✓ Already exists: {file_path.name}")
            found.add(name_lower)
            continue

        print(f"Copying: {file_path.name}")
        success = safe_copy(file_path, dest)

        if success:
            found.add(name_lower)
            print(f"✓ Copied: {file_path.name}")
        else:
            failed.append(file_path.name)

    # Final report
    desired_lower = {f.lower() for f in desired_files}
    missing = sorted(desired_lower - found)

    print("\n" + "=" * 55)
    print(f"Finished!")
    print(f"Successfully copied : {len(found)}")
    print(f"Failed (locked)     : {len(failed)}")
    print(f"Not found at all    : {len(missing)}")
    print("=" * 55)

    if failed:
        print("\nFiles that were locked (try again later):")
        for name in failed:
            print(f"  ✗ {name}")

    if missing:
        print("\nFiles not found anywhere in the source folder:")
        for name in missing:
            print(f"  ✗ {name}")

if __name__ == "__main__":
    main()