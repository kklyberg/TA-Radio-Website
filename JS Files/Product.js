// product.js - Single Product Page
// Get product ID from URL
function getProductId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('model') || 'HY-HP602';
}

// Product data
const productDatabase = {
    "HY-HP602": {
        id: "HY-HP602",
        brand: "Hytera",
        name: "HP602 Professional DMR Handheld",
        category: "Portable",
        sub_category: "DMR",
        msrp: 577.50,
        dealer_price: 346.50,
        description: "Professional DMR handheld radio with AI-based noise cancellation, rugged IP67 design, and advanced digital features.",
        image: "hytera/images/hp602.png",
        features: [
            "AI-Based Noise Cancellation",
            "IP67 and MIL-STD-810 C/D/E/F/G Compliant",
            "Bluetooth (on select models)",
            "GPS Positioning (on select models)",
            "3 Year Standard Warranty (radios only)"
        ],
        specs: {
            "Frequency Range": "400-527 MHz (UHF) / 136-174 MHz (VHF)",
            "Power Output": "1-4 Watts (UHF) / 1-5 Watts (VHF)",
            "Channels": "1,024 channels, 64 zones",
            "Battery": "2000mAh Lithium Polymer",
            "Display": "0.91\" OLED",
            "Audio": "High-volume speaker with digital noise suppression"
        }
    }
};

// Accessories for HP602
const accessories = [
    { id: "BP2002", partNumber: "BP2002", name: "2000mAh Li-Polymer Battery", price: 112.70 },
    { id: "CH10L30", partNumber: "CH10L30", name: "Single Unit Charger", price: 42.10 },
    { id: "SM27W2", partNumber: "SM27W2", name: "Bluetooth Speaker Microphone", price: 165.30 },
    { id: "EHW08", partNumber: "EHW08", name: "Bluetooth Earpiece with Mic", price: 150.20 },
    { id: "POA121", partNumber: "POA121", name: "Bluetooth PTT Ring", price: 127.60 }
];

function renderAccessories() {
    const container = document.getElementById('accessoriesContainer');
    if (!container) return;
    
    container.innerHTML = accessories.map(acc => `
        <div class="accessory-item">
            <h4>${acc.name}</h4>
            <small>Part #: ${acc.partNumber}</small>
            <p>$${acc.price.toFixed(2)}</p>
            <button onclick="addToQuote('${acc.id}')">Add to Quote</button>
        </div>
    `).join('');
}

// Render the product
function renderProduct(product) {
    document.getElementById('productBrand').textContent = product.brand;
    document.getElementById('productName').textContent = product.name;
    document.getElementById('productPrice').textContent = '$' + product.msrp.toFixed(2);
    
    // FIXED: Direct lookup pointer mapping straight into your "short-description" cell data field
    document.getElementById('productDescription').textContent = product["short-description"] || product.description || "";
    
    // FIXED: Maps your database image link directly to your custom zoom image identifier node
    const mainImgElement = document.getElementById('primaryProductImg');
    if (mainImgElement) {
        mainImgElement.src = product.image || 'images/default-product.jpg';
    }
    
    // Features
    const featureList = document.getElementById('featureList');
    if (featureList) {
        featureList.innerHTML = product.features.map(f => `<li>${f}</li>`).join('');
    }
    
    // Standard Package (What's Included)
    const packageList = document.getElementById('packageList');
    if (packageList) {
        packageList.innerHTML = `
            <li>HP602 Handheld Radio</li>
            <li>Standard Antenna</li>
            <li>2000mAh Li-Polymer Battery (BP2002)</li>
            <li>Single Unit Charger (CH10L30)</li>
            <li>Power Adapter</li>
            <li>Belt Clip & Nylon Strap</li>
        `;
    }
    
    // Specs
    const specsTable = document.getElementById('specsTable');
    if (specsTable) {
        specsTable.innerHTML = Object.entries(product.specs).map(([key, value]) => `
            <div class="spec-item">
                <strong>${key}</strong>
                <span>${value}</span>
            </div>
        `).join('');
    }
    
    // Render Accessories
    renderAccessories();
}

// Initialize and setup mouse coordinate magnification tracking [INDEX]
document.addEventListener('DOMContentLoaded', () => {
    const productId = getProductId();
    const product = productDatabase[productId];

    if (product) {
        renderProduct(product);
    } else {
        const titleNode = document.getElementById('productName');
        if (titleNode) titleNode.textContent = "Product Not Found";
    }

      // =========================================================================
    // RUNTIME COORDINATE MOUSE INTERACTION TRACKER (INTEGRATED ZOOM MATRIX)
    // =========================================================================
    const zoomFrameElement = document.getElementById("productImageZoomFrame");
    const primaryImgElement = document.getElementById("primaryProductImg");

    if (zoomFrameElement && primaryImgElement) {
        zoomFrameElement.addEventListener("mousemove", (e) => {
            const boundingDimensionsBox = zoomFrameElement.getBoundingClientRect();
            const absoluteMousePositionX = e.clientX - boundingDimensionsBox.left;
            const absoluteMousePositionY = e.clientY - boundingDimensionsBox.top;

            const horizontalPercentCoordinate = (absoluteMousePositionX / boundingDimensionsBox.width) * 100;
            const verticalPercentCoordinate = (absoluteMousePositionY / boundingDimensionsBox.height) * 100;

            primaryImgElement.style.transformOrigin = `${horizontalPercentCoordinate}% ${verticalPercentCoordinate}%`;
            primaryImgElement.style.transform = "scale(2.2)";
        });

        zoomFrameElement.addEventListener("mouseleave", () => {
            primaryImgElement.style.transform = "scale(1)";
            primaryImgElement.style.transformOrigin = "center center";
        });
    }
});
function addToQuote(itemId) {
    alert(`Added ${itemId} to quote!`);
}
