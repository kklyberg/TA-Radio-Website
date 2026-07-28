const fs = require('fs');
const path = require('path');
const axios = require('axios');

const accessories = [
    "EMC-11","GA25MCX","GPS15XL-W","KAS-20","KBH-10","KBH-11","KBH-8DS","KBP-5","KBP-7","KCT-18","KCT-36","KCT-51","KCT-60M","KCT-71A100","KCT-71A50","KCT-71M2","KCT-71M3","KCT-71M4","KCT-72","KCT-73MIC","KCT-74PTT","KEP-1","KEP-2","KES-3S","KES-5","KHS-1","KHS-10D","KHS-11BL","KHS-12BL","KHS-14","KHS-15D-BH","KHS-15D-OH","KHS-21","KHS-22A","KHS-26","KHS-27A","KHS-31C","KHS-35F","KHS-7","KHS-7A","KHS-8BL","KHS-9BL","KLF-2","KLH-137","KLH-148K","KLH-148K2","KLH-149K","KLH-149K2","KLH-206","KLH-207","KLH-6SW","KMB-10","KMB-16","KMB-23","KMB-30A","KMB-34","KMB-35A","KMC-21","KMC-35","KMC-36","KMC-40","KMC-41D","KMC-41M","KMC-42WD","KMC-45","KMC-45D","KMC-47GPSD","KMC-51","KMC-52","KMC-54WD","KMC-59C","KMC-70","KMC-72","KMC-9C","KNB-45L","KNB-47","KNB-48","KNB-50","KNB-53N","KNB-55L","KNB-55LAM","KNB-56N","KNB-57L","KNB-57LAM","KNB-63L","KNB-69L","KNB-72","KNB-78L","KNB-78LM","KNB-79L","KNB-79LC","KNB-79LCM","KNB-82LC","KNB-L1","KNB-L2","KNB-L3","KNB-N4","KPG-180AP","KPS-15","KRA-22","KRA-22M","KRA-22M2","KRA-22M3","KRA-23","KRA-23M","KRA-23M2","KRA-23M3","KRA-24","KRA-25","KRA-26","KRA-26M","KRA-26M2","KRA-26M3","KRA-27","KRA-27M","KRA-27M2","KRA-27M3","KRA-28","KRA-29","KRA-32K","KRA-36","KRA-38","KRA-38K","KRA-39","KRA-40G","KRA-41","KRA-41M","KRA-42","KRA-42M","KRA-43GM","KRA-43GM2","KRA-43GM3","KRA-44GM","KRA-44GM2","KRA-44GM3","KRK-18HM","KRK-19BM","KSC-256","KSC-256A","KSC-256AK","KSC-25LS","KSC-25LSK","KSC-25S","KSC-25SK","KSC-32","KSC-326","KSC-356A","KSC-35S","KSC-35SCR","KSC-43","KSC-Y32","KVC-15","KVC-22","KVC-23","KWD-OH20-NX","KWD-YH20-NX","KWR-1","NXR-1700e","NXR-1800e"
];

async function downloadImage(url, destPath) {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            timeout: 15000
        });

        fs.writeFileSync(destPath, response.data);
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    const imageDir = "kenwood/images";
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

    console.log(`Downloading ${accessories.length} accessories...`);

    for (const part of accessories) {
        const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const destPath = path.join(imageDir, `${cleanPart}.png`);

        const urlPatterns = [
            `https://www.gotoess.com/include/shared-images/kenwood-products/accessories/kenwood-${cleanPart}.webp`,
            `https://www.gotoess.com/include/shared-images/kenwood-products/kenwood-${cleanPart}.webp`,
            `https://www.gotoess.com/include/shared-images/kenwood-products/${cleanPart}.webp`
        ];

        let success = false;
        for (const url of urlPatterns) {
            success = await downloadImage(url, destPath);
            if (success) {
                console.log(`✅ ${part}`);
                break;
            }
        }

        if (!success) {
            console.log(`⚠️ ${part}`);
        }

        await new Promise(r => setTimeout(r, 600));
    }

    console.log("Done!");
}

main().catch(console.error);