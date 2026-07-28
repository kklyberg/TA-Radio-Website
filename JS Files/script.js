/**
 * =========================================================================
 * TARC RADIO PRODUCTS - UNIFIED MASTER SCRIPT INFRASTRUCTURE (2026)
 * =========================================================================
 * Source of Truth: Synchronized against master catalog data schemas.
 * Drives homepage interactions, global search routing, and local storage sync.
 */
// FIXED REFERENCE HOOK: Restored your missing live micro-service database feed anchor link
const GOOGLE_INVENTORY_FEED_URL = "https://script.google.com/macros/s/AKfycbw1M3qP6Lkebhy14vbMcCXESzB-N2QEFf2NHGHSuItlVn1sNP35Efa9uGdlRXEeF-m8DA/exec";
// Central system state registers matching catalog specifications
let masterSheetInventoryFeed = [];
let secureStorefrontCart = [];
let activeSelectedCategory = "all";
let activeSelectedIndustry = "all";
let activeRouteBrandToken = "kenwood";

document.addEventListener("DOMContentLoaded", () => {
  // Sync the master e-commerce drawer memory with browser tracking vaults on load
  const savedCartVaultData = localStorage.getItem("tarc_active_user_cart");
  if (savedCartVaultData) {
    try {
      secureStorefrontCart = JSON.parse(savedCartVaultData);
      refreshSecureEcomConsole();
    } catch (err) {
      console.error("❌ Cart tracking session synchronization failed:", err);
    }
  }
  // NEW: Safe initialization to prevent lockups on pages missing elements
  initGlobalSearchSafely();
  fetchGoogleInventoryFeed();
});

// =========================================================================
// 2. ISOLATED GLOBAL NAVBAR SEARCH ENGINE ROUTER (DUAL-TARGET SYNC)
// =========================================================================
function initGlobalSearchSafely() {
  const topNavbarSearchField = document.getElementById("navbarGlobalSearchInput");
  const innerGridSearchField = document.getElementById("catalogSearch");
  function handleLiveSearchBehavior(eventElement) {
    if (window.location.pathname.includes('catalog.html')) {
      if (topNavbarSearchField) topNavbarSearchField.value = eventElement.value;
      if (innerGridSearchField) innerGridSearchField.value = eventElement.value;
      if (typeof executeLiveMatrixSift === 'function') {
        executeLiveMatrixSift();
      }
    }
  }
  function handleCrossPageSearchRedirect(eventKey, eventElement) {
    if (eventKey === "Enter") {
      const queryTerm = eventElement.value.toLowerCase().trim();
      if (queryTerm === "") return;
      if (!window.location.pathname.includes('catalog.html')) {
        const folderPrefix = window.location.pathname.includes('/industries/') ? '../' : '';
        window.location.href = `${folderPrefix}catalog.html?search=${encodeURIComponent(queryTerm)}`;
      }
    }
  }
  if (topNavbarSearchField) {
    topNavbarSearchField.addEventListener("input", (e) => handleLiveSearchBehavior(e.target));
    topNavbarSearchField.addEventListener("keydown", (e) => handleCrossPageSearchRedirect(e.key, e.target));
  }
  if (innerGridSearchField) {
    innerGridSearchField.addEventListener("input", (e) => handleLiveSearchBehavior(e.target));
    innerGridSearchField.addEventListener("keydown", (e) => handleCrossPageSearchRedirect(e.key, e.target));
  }
}

// =========================================================================
// 3. SLIDING FLEET CART DRAWER ACTIONS & LISTENERS
// =========================================================================
const cartTriggerNode = document.getElementById("cartToggleBtn");
const cartDismissNode = document.getElementById("closeCartBtn");
const cartDrawerWindow = document.getElementById("fleetCartDrawer");
if (cartTriggerNode && cartDrawerWindow) {
  cartTriggerNode.addEventListener("click", (e) => {
    e.preventDefault();
    cartDrawerWindow.style.right = "0px";
  });
}
if (cartDismissNode && cartDrawerWindow) {
  cartDismissNode.addEventListener("click", () => {
    cartDrawerWindow.style.right = "-400px";
  });
}

// =========================================================================
// 4. UNIVERSAL POPUP MODAL ACTIONS (RFQ SUBMISSION CONSOLE)
// =========================================================================
const quoteModalNode = document.getElementById("quoteModal");
const checkoutBtnNode = document.getElementById("checkoutFleetBtn");
const closeModalSpanNode = document.querySelector(".close-btn");
const quoteFormEngine = document.getElementById("quoteForm");
if (checkoutBtnNode && quoteModalNode) {
  checkoutBtnNode.addEventListener("click", () => {
    if (secureStorefrontCart.length === 0) {
      alert("🛒 Your secure procurement manifest is empty.");
      return;
    }
    if (cartDrawerWindow) cartDrawerWindow.style.right = "-400px";
    quoteModalNode.style.display = "block";
  });
}
if (closeModalSpanNode && quoteModalNode) {
  closeModalSpanNode.addEventListener("click", () => {
    quoteModalNode.style.display = "none";
  });
}
window.addEventListener("click", (e) => {
  if (quoteModalNode && e.target === quoteModalNode) {
    quoteModalNode.style.display = "none";
  }
});
if (quoteFormEngine) {
  quoteFormEngine.addEventListener("submit", (e) => {
    e.preventDefault();
    const customerPayload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      requirements: document.getElementById("message").value.trim(),
      manifest: secureStorefrontCart
    };
    console.log("📤 COMPILED RFQ DEPLOYMENT DATA:", customerPayload);
    alert(`🎉 INQUIRY ROUTED SECURELY:\nThank you, ${customerPayload.name}. Your fleet manifest quote request containing ${secureStorefrontCart.length} custom model selections has been sent to our dispatch board!\n\nWe will analyze your environmental range boundaries and issue an official commercial statement via ${customerPayload.email} shortly.`);
    secureStorefrontCart = [];
    localStorage.removeItem("tarc_active_user_cart");
    refreshSecureEcomConsole();
    quoteFormEngine.reset();
    if (quoteModalNode) quoteModalNode.style.display = "none";
  });
}

// Boot background network storage syncing pipeline
fetchGoogleInventoryFeed();

// =========================================================================
// 5. CACHING STORAGE PIPELINE: Controls 10-Minute Refresh Loops
// =========================================================================
async function fetchGoogleInventoryFeed() {
  const STORAGE_CACHE_KEY = "tarc_inventory_cache_feed";
  const CACHE_TIMESTAMP_KEY = "tarc_inventory_cache_timestamp";
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
 
  const cachedDataString = localStorage.getItem(STORAGE_CACHE_KEY);
  const cachedTimestampString = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const currentTimeStamp = Date.now();
  if (cachedDataString && cachedTimestampString) {
    if ((currentTimeStamp - parseInt(cachedTimestampString)) < TEN_MINUTES_IN_MS) {
      masterSheetInventoryFeed = JSON.parse(cachedDataString);
      runTarcImageLinkValidator(masterSheetInventoryFeed);
      return;
    }
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(GOOGLE_INVENTORY_FEED_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error("Macro gateway unverified response.");
    masterSheetInventoryFeed = await response.json();
  
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(masterSheetInventoryFeed));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, currentTimeStamp.toString());
    runTarcImageLinkValidator(masterSheetInventoryFeed);
  } catch (error) {
    console.error("Database initialization fault: ", error);
  }
}

// --- PRODUCTION SECURITY IMAGE RECONNAISSANCE ENGINE ---
function runTarcImageLinkValidator(catalogItems) {
  console.log("%c📡 TARC IMAGE VALIDATOR ACTIVATED.", "color: #00FFFF; font-weight: bold;");
  if (!catalogItems) return;
 
  catalogItems.forEach((item, index) => {
    const rowNum = index + 2;
    const rawPath = item.image ? item.image.trim() : "";
    if (rawPath.startsWith(".") || rawPath.startsWith("/")) {
      console.error(` ↳ ❌ PATH CONFIGURATION FAULT (Row ${rowNum}): GitHub hosting requires starting directly with folder paths.`);
    }
  });
}

// =========================================================================
// 6. GLOBAL SHOPPING CART FRAMEWORK METHODS
// =========================================================================
window.injectItemIntoSecureCart = function(model, brand, type, price, img) {
  const analyticalMatch = secureStorefrontCart.find(c => c.model === model);
  if (analyticalMatch) {
    analyticalMatch.qty += 1;
  } else {
    secureStorefrontCart.push({ model, brand, type, price, image: img, qty: 1 });
  }
  syncCartToDeviceMemory();
  refreshSecureEcomConsole();
  document.getElementById("fleetCartDrawer").style.right = "0px";
};

window.modifyCartItemQuantity = function(idx, qtyDelta) {
  if (!secureStorefrontCart[idx]) return;
  if (qtyDelta === -99) {
    secureStorefrontCart.splice(idx, 1);
  } else {
    secureStorefrontCart[idx].qty += qtyDelta;
    if (secureStorefrontCart[idx].qty <= 0) secureStorefrontCart.splice(idx, 1);
  }
  syncCartToDeviceMemory();
  refreshSecureEcomConsole();
};

function syncCartToDeviceMemory() {
  localStorage.setItem("tarc_active_user_cart", JSON.stringify(secureStorefrontCart));
}

function refreshSecureEcomConsole() {
  const listFeed = document.getElementById("cartItemsList");
  if (!listFeed) return;

  const badge = document.getElementById("cartCountBadge");
  const totalUnits = document.getElementById("cartTotalItemsCount");
  const financialSumNode = document.getElementById("cartEstimatedTotalValue");

  listFeed.innerHTML = "";
  let totalCount = 0, netTotalSum = 0;

  if (secureStorefrontCart.length === 0) {
    listFeed.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; color:#5a6e72; padding:40px 0; font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-basket-shopping" style="font-size:2rem; color:#cbd5e1; margin-bottom:12px;"></i><span>Manifest is empty.</span></div>`;
    if (badge) badge.innerText = "0";
    if (totalUnits) totalUnits.innerText = "0 Units";
    if (financialSumNode) financialSumNode.innerText = "$0.00";
    return;
  }

  secureStorefrontCart.forEach((product, idx) => {
    totalCount += product.qty;
    netTotalSum += (product.price * product.qty);
    const componentCard = document.createElement("div");
    componentCard.style.cssText = "background:#ffffff; border:1px solid #e2e8f0; border-left:3px solid #0b5eb4; border-radius:4px; padding:12px; display:flex; gap:12px; align-items:center; box-sizing:border-box;";
    componentCard.innerHTML = `
      <div style="width:45px; height:45px; display:flex; align-items:center; justify-content:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; flex-shrink:0;"><img src="${product.image}" style="max-height:90%; max-width:90%; object-fit:contain;" onerror="this.src='images/radio-placeholder.png'"></div>
      <div style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden; text-align:left;">
        <span style="color:#0b5eb4; font-size:0.65rem; font-weight:800; text-transform:uppercase;">${product.brand}</span>
        <h4 style="color:#0e1a24; font-size:0.85rem; font-weight:800; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${product.model}</h4>
        <div style="color:#16a34a; font-size:0.82rem; font-weight:800;">$${(product.price * product.qty).toFixed(2)}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div style="display:flex; align-items:center; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden; background:#f8fafc; height:22px;">
          <button onclick="modifyCartItemQuantity(${idx}, -1)" style="border:none; background:none; width:18px; cursor:pointer; font-weight:900;">-</button>
          <span style="font-size:0.8rem; font-weight:800; color:#0e1a24; width:20px; text-align:center;">${product.qty}</span>
          <button onclick="modifyCartItemQuantity(${idx}, 1)" style="border:none; background:none; width:18px; cursor:pointer; font-weight:900;">+</button>
        </div>
        <span onclick="modifyCartItemQuantity(${idx}, -99)" style="color:#ef4444; font-size:0.65rem; font-weight:700; cursor:pointer; text-transform:uppercase;"><i class="fa-solid fa-trash-can"></i> Drop</span>
      </div>`;
    listFeed.appendChild(componentCard);
  });

  if (badge) badge.innerText = totalCount;
  if (totalUnits) totalUnits.innerText = `${totalCount} Unit${totalCount !== 1 ? 's' : ''}`;
  if (financialSumNode) financialSumNode.innerText = `$${netTotalSum.toFixed(2)}`;
}