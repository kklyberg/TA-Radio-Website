// catalog.js - Complete Multi-Filter Coordination Matrix & Transactional Cart Engine
const LIVE_STREAM_URL = "https://script.google.com/macros/s/AKfycbxWgZS4ViFUeNALUncco2zs1l9wTvTErszmUDFim1L9f9S3Onp6o7neSVuE3j-vgJCe/exec";

let globalInventoryFeed = []; 
let activeSelectedCategory = "All"; 
let fleetCart = []; 

// Core application bootstrapper initialization 
async function initCatalogPage() {
    setupCartDrawerMechanics();
    setupSearchConsole();
    initializeUniversalShowroomRoute();
    await fetchUniversalCatalogFeed();
}

// 1. HIGH-SPEED CORS COMPLIANT DATA FETCH PIPELINE WITH DUAL-LAYER CACHING
async function fetchUniversalCatalogFeed() {
    const grid = document.getElementById('catalog-feed-grid');
    const STORAGE_CACHE_KEY = "tarc_inventory_cache_feed";
    const CACHE_TIMESTAMP_KEY = "tarc_inventory_cache_timestamp";
    const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

    const cachedDataString = localStorage.getItem(STORAGE_CACHE_KEY);
    const cachedTimestampString = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const currentTimeStamp = Date.now();

    // INSTANT LOADING PASS: If local cache is valid under 10 minutes, use it instantly (5ms)
    if (cachedDataString && cachedTimestampString) {
        if ((currentTimeStamp - parseInt(cachedTimestampString)) < TEN_MINUTES_IN_MS) {
            globalInventoryFeed = JSON.parse(cachedDataString);
            console.log(`⚡ TARC CACHE: Served ${globalInventoryFeed.length} columns from browser memory.`);
            applyUnifiedFilters();
            return;
        }
    }

    // NETWORK FETCH FALLBACK PASS
    try {
        console.log("📡 CONNECTING: Local cache clear or expired. Syncing with live spreadsheet macro...");
        const networkResponse = await fetch(LIVE_STREAM_URL);
        if (!networkResponse.ok) throw new Error("Remote pipeline handshake failure.");
        
        const freshRawSheetData = await networkResponse.json();
        
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(freshRawSheetData));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, currentTimeStamp.toString());
        
        globalInventoryFeed = freshRawSheetData;
        console.log("✓ GLOBAL CACHE SYNCED: Fresh rows saved to device storage memory.");
        applyUnifiedFilters();
    } catch (err) {
        console.error("❌ TIMEOUT: Fallback asset recovery active.", err);
        if (cachedDataString) {
            globalInventoryFeed = JSON.parse(cachedDataString);
            applyUnifiedFilters();
        } else {
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; color:#ff5555; font-weight:bold; text-align:center; padding:40px 0;">
                        <i class="fa-solid fa-triangle-exclamation"></i> SERVER DISCONNECT. PLEASE REFRESH VIEW (CTRL + F5).
                    </div>`;
            }
        }
    }
}

// 2. UNIFIED FILTER CONSOLE ENGINE
function applyUnifiedFilters() {
    if (!globalInventoryFeed || globalInventoryFeed.length === 0) return;

    // A. Read active brand query values directly from browser address records
    const urlParams = new URLSearchParams(window.location.search);
    const targetBrand = (urlParams.get('brand') || 'all').toLowerCase().trim();

    // B. Read active contextual string layouts out of search query input elements
    const searchInput = document.getElementById('catalogSearch');
    const searchString = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteringMatrixResult = [...globalInventoryFeed];

    // Filter Step 1: Brand Verification
    if (targetBrand !== 'all') {
        filteringMatrixResult = filteringMatrixResult.filter(item => {
            const rowBrandString = (item.brand || item.Brand || "").toString().trim().toLowerCase();
            return rowBrandString === targetBrand || rowBrandString.includes(targetBrand);
        });
    }

    // Filter Step 2: Category Verification (Matches your exact spreadsheet strings)
    if (activeSelectedCategory !== 'All') {
        filteringMatrixResult = filteringMatrixResult.filter(item => {
            // Checks both 'category' and 'type' sheet column variations securely
            const rowCategoryString = (item.category || item.Category || item.type || item.Type || "").toString().trim().toLowerCase();
            return rowCategoryString === activeSelectedCategory.toLowerCase().trim();
        });
    }

    // Filter Step 3: Text Search Matching Verification
    if (searchString !== '') {
        filteringMatrixResult = filteringMatrixResult.filter(item => 
            (item.name || "").toLowerCase().includes(searchString) ||
            (item.brand || "").toLowerCase().includes(searchString) ||
            (item.id || "").toLowerCase().includes(searchString) ||
            (item.description || "").toLowerCase().includes(searchString)
        );
    }

    // Pass the computed filtered list to the presentation layer
    renderCatalogGrid(filteringMatrixResult);
}

// Global window layout link handler capturing click modifications across button elements cleanly
window.filterCatalogCategory = function(categoryString) {
    activeSelectedCategory = categoryString;

    // Toggle active layout button formatting dynamically across target pill objects
    const pillButtons = document.querySelectorAll('.brand-sub-pill');
    pillButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${categoryString}'`)) {
            btn.classList.add('active');
        }
    });

    // Run unified filter evaluations matching the updated categories selection choice
    applyUnifiedFilters();
};

function setupSearchConsole() {
    const textSearchField = document.getElementById('catalogSearch');
    if (textSearchField) {
        textSearchField.addEventListener('input', () => {
            applyUnifiedFilters();
        });
    }
}

// 3. BRAND SHOWROOM CONTEXT SYNCHRONIZER
function initializeUniversalShowroomRoute() {
    const urlParamsSearch = new URLSearchParams(window.location.search);
    const activeRouteBrandToken = (urlParamsSearch.get("brand") || "all").toLowerCase().trim();
    
    console.log(`📡 TARC ROUTER: Calibrating showroom display fields for -> [${activeRouteBrandToken}]`);
    
    const badgeNode = document.getElementById("showroomDealerBadge");
    const titleNode = document.getElementById("showroomTitle");
    const subtitleNode = document.getElementById("showroomSubtitle");
    const labelNode = document.getElementById("filterRowLabel");
    const inputNode = document.getElementById("catalogSearch");
    const heroBannerNode = document.getElementById("showroomHero");

    if (activeRouteBrandToken !== "all") {
        let capitalizedBrandLabel = activeRouteBrandToken.charAt(0).toUpperCase() + activeRouteBrandToken.slice(1);
        
        if (badgeNode) badgeNode.innerHTML = `<i class="fa-solid fa-award"></i> AUTHORIZED ${capitalizedBrandLabel.toUpperCase()} DEALER HUB`;
        if (titleNode) titleNode.innerText = `${capitalizedBrandLabel} Systems Portfolio`;
        if (labelNode) labelNode.innerHTML = `<i class="fa-solid fa-sliders"></i> Filter ${capitalizedBrandLabel} Stock Tiers:`;
        if (inputNode) inputNode.placeholder = `Search ${capitalizedBrandLabel} by model, parameters, or industry features...`;
        
        const brandSubtitles = {
            kenwood: "Authorized Nexedge digital line procurement networks.",
            icom: "Commercial aviation, marine, and land mobile ecosystems.",
            hytera: "Secure DMR tier-two and tier-three hardware deployments.",
            motorola: "Public safety spec communication technologies.",
            ritron: "Industrial wireless callboxes and radio telemetry gear."
        };
        if (subtitleNode && brandSubtitles[activeRouteBrandToken]) {
            subtitleNode.textContent = brandSubtitles[activeRouteBrandToken];
        }

        if (heroBannerNode) {
            heroBannerNode.style.background = `linear-gradient(to right, rgba(14,26,36,0.98) 35%, rgba(14,26,36,0) 80%), url('images/hero-${activeRouteBrandToken}.png') no-repeat right center`;
            heroBannerNode.style.backgroundSize = "contain";
            heroBannerNode.style.padding = "90px 0";
        }
    } else {
        if (badgeNode) badgeNode.innerHTML = `<i class="fa-solid fa-award"></i> AUTHORIZED WIRELESS DEALER`;
        if (titleNode) titleNode.innerText = "Wireless Systems Portfolio";
        if (inputNode) inputNode.placeholder = "Search this catalog...";
    }
}

// =========================================================================
// 4. INVENTORY RENDER CONTROLLER (STRICT TEXT STRING MATCHING ENGINE)
// =========================================================================
function renderCatalogGrid(productsList) {
    const gridContainer = document.getElementById('catalog-feed-grid');
    if (!gridContainer) return;

    if (!productsList || productsList.length === 0) {
        gridContainer.innerHTML = `<p class="no-results-text" style="grid-column:1/-1; text-align:center; padding:40px; color:#5a6e72; font-weight:600;">No systems match your active query filters.</p>`;
        return;
    }

    // Active tracker array to catch and block duplicate suffix configurations [INDEX]
    const alreadyRenderedRootsTracker = [];

    // =========================================================================
    // ENFORCED GRID CONTAINER FIX: STRICT STRING COMPRESSION FILTER
    // =========================================================================
    const filteredHtmlArray = productsList.map(item => {
        // Safe casing fallback normalization [INDEX]
        const cleanItemType = String(item.type || item.Type || '').toLowerCase().trim();
        const cleanItemModel = String(item.model || item.Model || item.id || item.Id || '').trim();
        const cleanRootModelField = String(item["root-model"] || item["rootModel"] || item.rootModel || '').trim();

        // RULE A: If an item is an accessory, let it pass through onto its own thumbnail card blocks cleanly [INDEX]
        if (cleanItemType === "accessory") {
            // Keep regular accessory rendering path intact
        } else {
            // RULE B: ESTABLISH THE SERIES IDENTIFIER WITH STRING CLIP FALLBACK MATRIX [INDEX]
            let finalGroupKeyIdentifier = cleanItemModel;

            if (cleanRootModelField !== "") {
                finalGroupKeyIdentifier = cleanRootModelField;
            } else if (cleanItemModel.startsWith("NX-1200") || cleanItemModel.startsWith("NX-1202")) {
                finalGroupKeyIdentifier = "NX-1200";
            } else if (cleanItemModel.startsWith("NX-1300") || cleanItemModel.startsWith("NX-1302")) {
                finalGroupKeyIdentifier = "NX-1300";
            }

            // Clean the key character format to guarantee absolute string match compliance [INDEX]
            const strictStringLookupKey = String(finalGroupKeyIdentifier).trim().toUpperCase();

            // 👉 FIXED: Forces deep array checking by evaluating the string character array directly [INDEX]!
            if (alreadyRenderedRootsTracker.includes(strictStringLookupKey)) {
                // CLAMP ACTIVE: Skip drawing this duplicate variant configuration! [INDEX]
                return ''; 
            }
            
            // Lock this master string key into your tracking index canvas panel [INDEX]
            alreadyRenderedRootsTracker.push(strictStringLookupKey);
        }

        const itemPrice = parseFloat(item.price || item.Price || item.msrp || item.Msrp || 0);
        const displayPrice = isNaN(itemPrice) ? "0.00" : itemPrice.toFixed(2);
        const cleanImg = escapeHTML(item.image || item.Image || 'images/default-product.jpg');
        const cleanID = escapeHTML(cleanItemModel);
        
        // Force render clean master series titles for your homepage grid showcase [INDEX]
        let displayCardTitle = escapeHTML(item.name || item.Name || cleanItemModel || 'Equipment Catalog');
        if (cleanItemModel.startsWith("NX-1200") || cleanItemModel.startsWith("NX-1202")) {
            if (cleanItemType !== "accessory") displayCardTitle = "Kenwood NX-1200 Series Base Station";
        } else if (cleanItemModel.startsWith("NX-1300") || cleanItemModel.startsWith("NX-1302")) {
            if (cleanItemType !== "accessory") displayCardTitle = "Kenwood NX-1300 Series Base Station";
        }

        return `
            <div class="product-card">
                <div class="image-container">
                    <img src="${cleanImg}" alt="${displayCardTitle} Product Preview" loading="lazy">
                </div>
                
                <div class="product-info">
                    <span class="brand">${escapeHTML(item.brand || item.Brand || 'T.A. Radio')}</span>
                    <h3>${displayCardTitle}</h3>
                    <p class="price">$${displayPrice}</p>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button onclick="window.location.href='product.html?model=${encodeURIComponent(cleanID)}'" class="view-details-btn" style="width:100%; background:#0b5eb4; color:#ffffff; border:none; padding:8px; border-radius:4px; font-weight:700; cursor:pointer;">View System Details</button>
                    </div>
                </div>
            </div>
        `;
    });

    // Combine your filtered list elements while safely stripping out the empty rows we skipped [INDEX]
    gridContainer.innerHTML = filteredHtmlArray.filter(html => html !== '').join('');
}

    // =========================================================================
// 5. SECURE TRANSACTIONAL CHECKOUT CART DRAWER SLIDER OVERLAYSfunction setupCartDrawerMechanics() {const cartToggle = document.getElementById('cartToggleBtn');const closeBtn = document.getElementById('closeCartBtn');const drawer = document.getElementById('fleetCartDrawer');if (cartToggle && drawer) {cartToggle.addEventListener('click', (e) => {e.preventDefault();drawer.style.right = "0px";});}if (closeBtn && drawer) {closeBtn.addEventListener('click', () => {drawer.style.right = "-400px";});}}window.addInventoryItemToCart = function(productID) {if (!globalInventoryFeed) return;const targetProduct = globalInventoryFeed.find(p => (p.id || p.Id) === productID);if (!targetProduct) return;const cartInstance = fleetCart.find(item => item.id === productID);if (cartInstance) {cartInstance.quantity += 1;} else {fleetCart.push({ ...targetProduct, id: productID, quantity: 1 });}refreshCartUIState();const drawer = document.getElementById('fleetCartDrawer');if (drawer) drawer.style.right = "0px";};function refreshCartUIState() {const listContainer = document.getElementById('cartItemsList');const countBadge = document.getElementById('cartCountBadge');const totalUnitsText = document.getElementById('cartTotalItemsCount');const costTotalText = document.getElementById('cartEstimatedTotalValue');if (!listContainer) return;let totalUnitsCalculated = 0;let totalValueCalculated = 0.00;if (fleetCart.length === 0) {listContainer.innerHTML = <p style="text-align: center; padding: 40px 0; font-weight: 600; color: #5a6e72; margin:0;">Your cart is empty.</p>;} else {listContainer.innerHTML = fleetCart.map(item => {const price = parseFloat(item.msrp || 0);const totalLineCost = price * item.quantity;totalUnitsCalculated += item.quantity;totalValueCalculated += totalLineCost;return <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;"> <div style="text-align: left; max-width: 70%;"> <h4 style="margin: 0; font-size: 0.88rem; color: #0e1a24;">${escapeHTML(item.name)}</h4> <small style="color: #5a6e72; font-weight: 600;">Qty: ${item.quantity} &times; $${price.toFixed(2)}</small> </div> <span style="font-weight: 800; color: #0b5eb4; font-size: 0.9rem;">$${totalLineCost.toFixed(2)}</span> </div>;}).join('');}if (countBadge) countBadge.textContent = totalUnitsCalculated;if (totalUnitsText) totalUnitsText.textContent = ${totalUnitsCalculated} Unit${totalUnitsCalculated !== 1 ? 's' : ''};if (costTotalText) costTotalText.textContent = $${totalValueCalculated.toFixed(2)};}// 6. ANCHOR SECURITY LOGIC INJECTION SANITIZERfunction escapeHTML(str) {if (!str) return '';return String(str).replace(/[&<>'"]/g,tag => ({ '&': '&', '<': '<', '>': '>', "'": ''', '"': '"' }[tag] || tag));}document.addEventListener('DOMContentLoaded', initCatalogPage);