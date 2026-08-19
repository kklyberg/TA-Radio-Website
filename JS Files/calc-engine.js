// ========================================================================= //
// TARC DUAL-PATH RF SIMULATION PHYSICS MATRIX ENGINE (PART 1)               //
// ========================================================================= //

const lossThresholds = {
  "open": { 
    lossFactor: 2.0, 
    clutterLoss: 0, 
    text: "Open Flat Plains: Signal follows absolute Line-of-Sight geometric rules. Range is limited primarily by node elevation heights and the physical curvature of the Earth." 
  },
  "suburban": { 
    lossFactor: 2.7, 
    clutterLoss: 12, 
    text: "Suburban Environment: Light residential clutter introduces multipath fading, degrading active signal thresholds by roughly 12dB." 
  },
  "foliage": { 
    lossFactor: 3.4, 
    clutterLoss: 24, 
    text: "Dense Forest Canopy: Heavy wood foliage absorption locks onto radio wavelengths. VHF performs best here, while UHF attenuates rapidly." 
  },
  "urban": { 
    lossFactor: 4.2, 
    clutterLoss: 38, 
    text: "Dense Urban Grid: Steel frames and concrete walls aggressively block, drop, and bounce signal waves. High-elevation infrastructure is mandatory." 
  }
};

const frequencySpecs = {
  "vhf": { freqMHz: 154, baseLoss: 76, label: "VHF Low-Band (154 MHz)" },
  "uhf": { freqMHz: 460, baseLoss: 85, label: "UHF High-Band (460 MHz)" },
  "800": { freqMHz: 855, baseLoss: 91, label: "800 MHz Safety-Band (855 MHz)" }
};

function processTelemetryAndData() {
  // 1. Gather baseline inputs safely
  const txHeight = parseFloat(document.getElementById("hudTxHeight").value) || 5.5;
  const rxHeight = parseFloat(document.getElementById("hudRxHeight").value) || 5.5;
  const rawPower = parseFloat(document.getElementById("rfPower").value) || 1.0;
  const bandKey = document.getElementById("rfBand").value;
  const terrainKey = document.getElementById("terrainType").value;
  const useRepeater = document.getElementById("useRepeater").checked;

  // Synchronize UI labels
  if (document.getElementById("lblTxAlt")) document.getElementById("lblTxAlt").innerText = txHeight;
  if (document.getElementById("lblRxAlt")) document.getElementById("lblRxAlt").innerText = rxHeight;
  if (document.getElementById("lblPower")) document.getElementById("lblPower").innerText = rawPower;

  const env = lossThresholds[terrainKey];
  const freq = frequencySpecs[bandKey];
  
  let systemERP = rawPower;
  let maxGeometricLOS = 0;
  let calculatedUsableRange = 0;

  // 4/3 Earth Radio Horizon constant (Outputs Statute Miles from Feet)
  const HORIZON_CONSTANT = 1.415; 
  const RX_SENSITIVITY = -115; // dBm threshold where standard radios lose signal

  // 2. REPEATER VISIBILITY LINK CONTROLLER HOOK
  const repDeck = document.getElementById("repeaterControlDeck");
  
  if (useRepeater) {
    if (repDeck) repDeck.style.display = "flex";

    const repHeight = parseFloat(document.getElementById("hudRepHeight").value) || 100;
    const repPower = parseFloat(document.getElementById("rfRepPower").value) || 30;
    const coax = document.getElementById("coaxType").value;
    const antenna = document.getElementById("antennaType").value;

    if (document.getElementById("lblRepAlt")) document.getElementById("lblRepAlt").innerText = repHeight;
    if (document.getElementById("lblRepPower")) document.getElementById("lblRepPower").innerText = repPower;

    // Compute infrastructure losses and system gains
    let coaxLoss = coax === "rg58" ? 0.06 : coax === "rg213" ? 0.03 : 0.008;
    let cableAtt = repHeight * coaxLoss;
    let antGain = antenna === "unity" ? 0 : antenna === "omni3" ? 3 : antenna === "omni6" ? 6 : 9;
    systemERP = repPower * Math.pow(10, (antGain - cableAtt) / 10);

    // Physical Earth Horizons for individual legs
    const horizonTxToTower = HORIZON_CONSTANT * (Math.sqrt(txHeight) + Math.sqrt(repHeight));
    const horizonTowerToRx = HORIZON_CONSTANT * (Math.sqrt(repHeight) + Math.sqrt(rxHeight));
    
    // Max geometric coverage is capped by the furthest edge of the tower's footprint
    maxGeometricLOS = Math.max(horizonTxToTower, horizonTowerToRx);

    // --- REPEATER LINK BUDGET SIMULATION ---
    // Leg A: Handheld (Tx) talking INTO the Repeater Tower
    let legAPowerDbm = 30 + (10 * Math.log10(rawPower)); 
    let legARange = 0.1;
    
    while (legARange <= horizonTxToTower) {
      let pathLoss = 40 * Math.log10(legARange) + 20 * Math.log10(freq.freqMHz) - 20 * Math.log10(txHeight * repHeight) + env.clutterLoss + 76.3;
      if ((legAPowerDbm - pathLoss) < RX_SENSITIVITY) {
        break;
      }
      legARange += 0.1;
    }

    // Leg B: Repeater Tower broadcasting OUT to Base Station (Rx)
    let legBPowerDbm = 30 + (10 * Math.log10(systemERP)); 
    let legBRange = 0.1;
    
    while (legBRange <= horizonTowerToRx) {
      let pathLoss = 40 * Math.log10(legBRange) + 20 * Math.log10(freq.freqMHz) - 20 * Math.log10(repHeight * rxHeight) + env.clutterLoss + 76.3;
      if ((legBPowerDbm - pathLoss) < RX_SENSITIVITY) {
        break;
      }
      legBRange += 0.1;
    }

    // System performance drops as soon as the WEAKEST link fails.
    calculatedUsableRange = Math.min(legARange, legBRange);

  } else {
    // === THIS IS THE PEER-TO-PEER ELSE STATEMENT ===
    if (repDeck) repDeck.style.display = "none";
    
    // Direct Line-of-Sight Horizon
    maxGeometricLOS = HORIZON_CONSTANT * (Math.sqrt(txHeight) + Math.sqrt(rxHeight));

    // Direct peer-to-peer Link Budget
    let directPowerDbm = 30 + (10 * Math.log10(rawPower)); 
    let directRange = 0.1;
    
    while (directRange <= maxGeometricLOS) {
      let egliLoss = 40 * Math.log10(directRange) + 20 * Math.log10(freq.freqMHz) - 20 * Math.log10(txHeight * rxHeight) + 76.3;
      let fsplLoss = 20 * Math.log10(directRange) + 20 * Math.log10(freq.freqMHz) + 36.6;
      
      // Use Egli but protect low handheld heights with an FSPL baseline
      let finalLoss = Math.max(fsplLoss, egliLoss);
      
      if (terrainKey !== "open") {
        finalLoss += env.clutterLoss;
      }

      if ((directPowerDbm - finalLoss) < RX_SENSITIVITY) {
        break;
      }
      directRange += 0.1;
    }
    calculatedUsableRange = directRange;
  }


  // Final hard boundary enforcement sanity check
  if (calculatedUsableRange > maxGeometricLOS) {
    calculatedUsableRange = maxGeometricLOS;
  }
  if (calculatedUsableRange < 0.1) {
    calculatedUsableRange = 0.1;
  }

  // Direct Telemetry Panel Injections
  if (document.getElementById("telemetryTx")) document.getElementById("telemetryTx").innerText = `${txHeight} FT`;
  if (document.getElementById("telemetryERP")) document.getElementById("telemetryERP").innerText = `${systemERP.toFixed(1)} W`;
  if (document.getElementById("telemetryLOS")) document.getElementById("telemetryLOS").innerText = `${maxGeometricLOS.toFixed(1)} MI`;
  if (document.getElementById("telemetryRange")) document.getElementById("telemetryRange").innerText = `${calculatedUsableRange.toFixed(1)} MI`;

  const advBox = document.getElementById("tarcAdvisoryBox");
  const advText = document.getElementById("tarcAdvisoryText");
  if (advBox && advText) {
    advBox.style.display = "block";
    advText.innerHTML = `<strong>${freq.label} Environment Diagnostic:</strong> ${env.text} System is managing a maximum line-of-sight capability of <strong>${maxGeometricLOS.toFixed(1)} miles</strong> with a calculated stable coverage blueprint reaching <strong>${calculatedUsableRange.toFixed(1)} miles</strong>.`;
  }

  drawSkylineMatrix(txHeight, rxHeight, calculatedUsableRange, maxGeometricLOS, useRepeater, useRepeater ? parseFloat(document.getElementById("hudRepHeight").value) : 0);
  drawSpectrumFrequencies(freq.freqMHz, terrainKey);
}

// ========================================================================= //
// CANVAS RENDERING LOOPS & SEPARATED EVENT BINDING ENGINE (PART 2)         //
// ========================================================================= //
// ... (Keep your original Part 2 Canvas code intact, it handles the UI visual rendering correctly)

// =========================================================================
// CANVAS RENDERING LOOPS & SEPARATED EVENT BINDING ENGINE (PART 2)
// =========================================================================

function drawSkylineMatrix(txH, rxH, usableR, maxLos, hasRepeater, repH) {
    const canvas = document.getElementById("rfSkylineCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw earth arc baseline background environment
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height + 400, canvas.height + 380, Math.PI, 2 * Math.PI);
    ctx.fillStyle = "#090d12"; ctx.fill();
    ctx.strokeStyle = "#1a2936"; ctx.lineWidth = 2; ctx.stroke();

    let txX = 50;  let txY = canvas.height - 35 - (txH * 0.25);
    let rxX = canvas.width - 50; let rxY = canvas.height - 35 - (rxH * 0.25);
    if (txY < 15) txY = 15; if (rxY < 15) rxY = 15;

    // --- NODE 1: TRANSMITTER MAST ---
    ctx.lineWidth = 3; ctx.strokeStyle = "#0B5EB4";
    ctx.beginPath(); ctx.moveTo(txX, canvas.height - 25); ctx.lineTo(txX, txY); ctx.stroke();
    ctx.fillStyle = "#ff3333"; ctx.beginPath(); ctx.arc(txX, txY, 4, 0, 2 * Math.PI); ctx.fill();

    // --- NODE 2: RECEIVER BASE ---
    ctx.strokeStyle = "#ffaa00";
    ctx.beginPath(); ctx.moveTo(rxX, canvas.height - 25); ctx.lineTo(rxX, rxY); ctx.stroke();
    ctx.fillStyle = "#ff3333"; ctx.beginPath(); ctx.arc(rxX, rxY, 4, 0, 2 * Math.PI); ctx.fill();

    // --- NODE 3: CENTRAL REPEATER HUB ---
    if (hasRepeater && repH > 0) {
        let repX = canvas.width / 2; let repY = canvas.height - 35 - (repH * 0.22);
        if (repY < 10) repY = 10;
        ctx.strokeStyle = "#00FFFF";
        ctx.beginPath(); ctx.moveTo(repX, canvas.height - 25); ctx.lineTo(repX, repY); ctx.stroke();
        ctx.fillStyle = "#ff3333"; ctx.beginPath(); ctx.arc(repX, repY, 5, 0, 2 * Math.PI); ctx.fill();

        ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0, 255, 102, 0.85)";
        ctx.beginPath(); ctx.moveTo(txX, txY); ctx.quadraticCurveTo((txX + repX) / 2, Math.min(txY, repY) - 25, repX, repY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(repX, repY); ctx.quadraticCurveTo((repX + rxX) / 2, Math.min(repY, rxY) - 25, rxX, rxY); ctx.stroke();
        ctx.restore();
    } else {
        ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = (usableR >= maxLos * 0.8) ? "#00FF66" : "#ff5555";
        ctx.beginPath(); ctx.moveTo(txX, txY); ctx.quadraticCurveTo(canvas.width / 2, Math.min(txY, rxY) - 30, rxX, rxY); ctx.stroke();
        ctx.restore();
    }
}

function drawSpectrumFrequencies(frequencyValue, environmentKey) {
    const canvas = document.getElementById("rfSpectrumCanvas"); if (!canvas) return;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(0, 255, 102, 0.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, canvas.height - 15);
    let clutterModifier = environmentKey === "urban" ? 25 : environmentKey === "foliage" ? 15 : 5;
    for (let x = 0; x < canvas.width; x += 6) {
        let noise = Math.random() * clutterModifier; let baselineY = canvas.height - 20 - noise;
        if (x > canvas.width / 2 - 20 && x < canvas.width / 2 + 20) { baselineY -= (40 - Math.abs(canvas.width / 2 - x) * 1.8); }
        ctx.lineTo(x, baselineY);
    }
    ctx.stroke();
}

// --- 4. MASTER ENGINE CYCLING EVENT BINDERS ---
document.addEventListener("DOMContentLoaded", () => {
    // Sliders & Selectors that respond flawlessly to 'input' and 'change' loops
    const liveDynamicSliders = [
        "hudTxHeight", "hudRxHeight", "rfPower", "rfBand", "terrainType",
        "hudRepHeight", "rfRepPower", "coaxType", "antennaType"
    ];

    liveDynamicSliders.forEach(elementId => {
        const sliderNode = document.getElementById(elementId);
        if (sliderNode) {
            sliderNode.addEventListener("input", processTelemetryAndData);
            sliderNode.addEventListener("change", processTelemetryAndData);
        }
    });

    // FIXED: Checkbox utilizes standard 'change' event matrix independently. No console errors!
    const checkboxNode = document.getElementById("useRepeater");
    if (checkboxNode) {
        checkboxNode.addEventListener("change", processTelemetryAndData);
    }

    // Fire first compile calculations run loop instantly on page render initialization
    processTelemetryAndData();
});
