// ========================================================================= //
// TARC DUAL-PATH RF SIMULATION PHYSICS MATRIX ENGINE
// ========================================================================= //

const lossThresholds = {
  open: {
    lossFactor: 2.0,
    clutterLoss: 0,
    text: "Open Flat Plains: Signal follows Line-of-Sight geometry. Range is limited mainly by antenna height and earth curvature."
  },
  suburban: {
    lossFactor: 2.7,
    clutterLoss: 12,
    text: "Suburban Environment: Light residential clutter and multipath; expect moderate extra attenuation."
  },
  foliage: {
    lossFactor: 3.4,
    clutterLoss: 24,
    text: "Dense Forest Canopy: Foliage absorbs RF energy. Lower frequencies (VHF) generally hold up better than UHF/800."
  },
  urban: {
    lossFactor: 4.2,
    clutterLoss: 38,
    text: "Dense Urban Grid: Steel and concrete block and scatter energy. Height and infrastructure matter more than raw watts."
  }
};

// Frequency used in FSPL / Egli-style terms. UHF (460) is the reference band.
const frequencySpecs = {
  vhf: { freqMHz: 154, label: "VHF Low-Band (154 MHz)" },
  uhf: { freqMHz: 460, label: "UHF High-Band (460 MHz)" },
  "800": { freqMHz: 855, label: "800 MHz Safety-Band (855 MHz)" }
};

// Scales ONLY the terrain clutter term. UHF = 1.0 → same clutter dB as your original model.
const bandClutterScale = {
  vhf: {
    open: 1.0,
    suburban: 0.90,
    foliage: 0.70, // VHF: better knife-edge / foliage behavior
    urban: 1.0
  },
  uhf: {
    open: 1.0,
    suburban: 1.0,
    foliage: 1.0,
    urban: 1.0
  },
  "800": {
    open: 1.0,
    suburban: 1.10,
    foliage: 1.20, // higher freq: more foliage / urban penalty
    urban: 1.15
  }
};

function clutterForBand(terrainKey, bandKey) {
  const env = lossThresholds[terrainKey] || lossThresholds.open;
  const scales = bandClutterScale[bandKey] || bandClutterScale.uhf;
  const scale = scales[terrainKey] != null ? scales[terrainKey] : 1;
  return env.clutterLoss * scale;
}

function processTelemetryAndData() {
  const txHeight = parseFloat(document.getElementById("hudTxHeight").value) || 5;
  const rxHeight = parseFloat(document.getElementById("hudRxHeight").value) || 5;
  const rawPower = parseFloat(document.getElementById("rfPower").value) || 1;
  const bandKey = (document.getElementById("rfBand") || {}).value || "uhf";
  const terrainKey = (document.getElementById("terrainType") || {}).value || "open";
  const useRepeater = !!(document.getElementById("useRepeater") || {}).checked;

  if (document.getElementById("lblTxAlt")) document.getElementById("lblTxAlt").innerText = txHeight;
  if (document.getElementById("lblRxAlt")) document.getElementById("lblRxAlt").innerText = rxHeight;
  if (document.getElementById("lblPower")) document.getElementById("lblPower").innerText = rawPower;

  const env = lossThresholds[terrainKey] || lossThresholds.open;
  const freq = frequencySpecs[bandKey] || frequencySpecs.uhf;
  const clutterDb = clutterForBand(terrainKey, bandKey);

  let systemERP = rawPower;
  let maxGeometricLOS = 0;
  let calculatedUsableRange = 0;

  const HORIZON_CONSTANT = 1.415; // statute miles from height in feet (4/3-earth style)
  const RX_SENSITIVITY = -115; // dBm

  // Egli-style constant calibrated around your original UHF model (kept fixed)
  const EGLI_CONST = 76.3;
  const FSPL_CONST = 36.6; // miles + MHz form

  const repDeck = document.getElementById("repeaterControlDeck");

  if (useRepeater) {
    if (repDeck) repDeck.style.display = "flex";

    const repHeight = parseFloat(document.getElementById("hudRepHeight").value) || 100;
    const repPower = parseFloat(document.getElementById("rfRepPower").value) || 40;
    const coax = (document.getElementById("coaxType") || {}).value || "rg213";
    const antenna = (document.getElementById("antennaType") || {}).value || "omni6";

    if (document.getElementById("lblRepAlt")) document.getElementById("lblRepAlt").innerText = repHeight;
    if (document.getElementById("lblRepPower")) document.getElementById("lblRepPower").innerText = repPower;

    // Approximate cable loss (dB per foot of vertical run) — same for all bands
    const coaxLossPerFt = coax === "rg58" ? 0.06 : coax === "rg213" ? 0.03 : 0.008;
    const cableAtt = repHeight * coaxLossPerFt;
    const antGain =
      antenna === "unity" ? 0 :
      antenna === "omni3" ? 3 :
      antenna === "omni6" ? 6 : 9;

    systemERP = repPower * Math.pow(10, (antGain - cableAtt) / 10);

    const horizonTxToTower = HORIZON_CONSTANT * (Math.sqrt(txHeight) + Math.sqrt(repHeight));
    const horizonTowerToRx = HORIZON_CONSTANT * (Math.sqrt(repHeight) + Math.sqrt(rxHeight));
    maxGeometricLOS = Math.max(horizonTxToTower, horizonTowerToRx);

    // Leg A: portable TX → repeater
    const legAPowerDbm = 30 + 10 * Math.log10(Math.max(rawPower, 0.1));
    let legARange = 0.1;
    while (legARange <= horizonTxToTower) {
      const pathLoss =
        40 * Math.log10(legARange) +
        20 * Math.log10(freq.freqMHz) -
        20 * Math.log10(Math.max(txHeight * repHeight, 1)) +
        clutterDb +
        EGLI_CONST;
      if (legAPowerDbm - pathLoss < RX_SENSITIVITY) break;
      legARange += 0.1;
    }

    // Leg B: repeater → RX
    const legBPowerDbm = 30 + 10 * Math.log10(Math.max(systemERP, 0.1));
    let legBRange = 0.1;
    while (legBRange <= horizonTowerToRx) {
      const pathLoss =
        40 * Math.log10(legBRange) +
        20 * Math.log10(freq.freqMHz) -
        20 * Math.log10(Math.max(repHeight * rxHeight, 1)) +
        clutterDb +
        EGLI_CONST;
      if (legBPowerDbm - pathLoss < RX_SENSITIVITY) break;
      legBRange += 0.1;
    }

    calculatedUsableRange = Math.min(legARange, legBRange);
  } else {
    if (repDeck) repDeck.style.display = "none";

    maxGeometricLOS = HORIZON_CONSTANT * (Math.sqrt(txHeight) + Math.sqrt(rxHeight));

    const directPowerDbm = 30 + 10 * Math.log10(Math.max(rawPower, 0.1));
    let directRange = 0.1;

    while (directRange <= maxGeometricLOS) {
      const egliLoss =
        40 * Math.log10(directRange) +
        20 * Math.log10(freq.freqMHz) -
        20 * Math.log10(Math.max(txHeight * rxHeight, 1)) +
        EGLI_CONST;

      const fsplLoss =
        20 * Math.log10(directRange) +
        20 * Math.log10(freq.freqMHz) +
        FSPL_CONST;

      // Floor with FSPL so very low antennas don't go unrealistically optimistic
      let finalLoss = Math.max(fsplLoss, egliLoss);

      if (terrainKey !== "open") {
        finalLoss += clutterDb;
      }

      if (directPowerDbm - finalLoss < RX_SENSITIVITY) break;
      directRange += 0.1;
    }

    calculatedUsableRange = directRange;
  }

  if (calculatedUsableRange > maxGeometricLOS) calculatedUsableRange = maxGeometricLOS;
  if (calculatedUsableRange < 0.1) calculatedUsableRange = 0.1;
  
  // Model best case (theoretical for these settings)
	const bestCaseRange = calculatedUsableRange;

// Practical real-world estimate
	const PRACTICAL_FACTOR = 0.55;
	let practicalRange = bestCaseRange * PRACTICAL_FACTOR;

// Handheld-to-handheld: keep practical conservative
if (!useRepeater && txHeight <= 6 && rxHeight <= 6) {
  practicalRange = Math.min(practicalRange, 2.0);
}
if (practicalRange < 0.1) practicalRange = 0.1;
  
  if (document.getElementById("telemetryTx")) {
    document.getElementById("telemetryTx").innerText = `${txHeight} FT`;
  }
  if (document.getElementById("telemetryERP")) {
    document.getElementById("telemetryERP").innerText = `${systemERP.toFixed(1)} W`;
  }
  if (document.getElementById("telemetryLOS")) {
    document.getElementById("telemetryLOS").innerText = `${maxGeometricLOS.toFixed(1)} MI`;
  }
  if (document.getElementById("telemetryRange")) {
  document.getElementById("telemetryRange").innerHTML =
    `${practicalRange.toFixed(1)} MI` +
    `<div style="font-size:0.62rem;font-weight:700;color:#94a3b8;margin-top:2px;text-transform:none;letter-spacing:0;">practical</div>`;
}

  const advBox = document.getElementById("tarcAdvisoryBox");
  const advText = document.getElementById("tarcAdvisoryText");
  if (advBox && advText) {
  advBox.style.display = "block";
  advText.innerHTML =
    `<strong>${freq.label}</strong> · ${env.text}<br>` +
    `<strong>Practical (real world):</strong> ${practicalRange.toFixed(1)} mi · ` +
    `<strong>Best case (model):</strong> ${bestCaseRange.toFixed(1)} mi · ` +
    `LOS limit ${maxGeometricLOS.toFixed(1)} mi. ` +
    `Estimate only — not a field survey.`;
}

  const repH = useRepeater
    ? parseFloat((document.getElementById("hudRepHeight") || {}).value) || 0
    : 0;

  drawSkylineMatrix(
    txHeight,
    rxHeight,
    calculatedUsableRange,
    maxGeometricLOS,
    useRepeater,
    repH
  );
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
