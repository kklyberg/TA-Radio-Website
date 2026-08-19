const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// CONFIG: Set your target site URL here
const TARGET_URL = "https://shop.motorolasolutions.com/search/_/N-735920568+387156806?Nrpp=15&srsltid=AfmBOoqLT-t-ndMuzn-9pT_2fw9-OLmtfLgeV-kj_LPaGwYG5_kSPgUQ";
const OUTPUT_FILE = "extracted_urls.json";

async function extractUrls() {
    try {
        console.log(`Scanning target webpage: ${TARGET_URL}...`);
        
        const response = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        // Load the HTML into the parser
        const $ = cheerio.load(response.data);
        const imageUrls = [];

        // Loop through every image tag found on the page
        $('img').each((index, element) => {
            let src = $(element).attr('src') || $(element).attr('data-src'); // Checks for normal and lazy-loaded assets
            
            if (src) {
                // If the URL is relative (e.g. "/assets/img.jpg"), convert it to an absolute URL
                if (src.startsWith('/')) {
                    const urlObj = new URL(TARGET_URL);
                    src = `${urlObj.origin}${src}`;
                }
                
                // Filter out tracking pixels, icons, or tiny layout spacers
                if (!src.includes('pixel') && !src.includes('logo') && !imageUrls.includes(src)) {
                    imageUrls.push(src);
                }
            }
        });

        // Save findings to JSON file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(imageUrls, null, 2));
        console.log(`Success! Found and saved ${imageUrls.length} image URLs to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("❌ Error fetching webpage structure:", error.message);
    }
}

extractUrls();
