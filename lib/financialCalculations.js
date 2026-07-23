// Deterministic financial modeling for Nexus Diligence. Computed in code
// rather than left to the model — LLMs are unreliable at multi-step
// arithmetic, and a report claiming to be "rigorous" shouldn't show an
// Expected Value that doesn't actually equal approval% x commercial% x NPV.
// This is intentionally a simplified model (flat plateau at peak, no
// post-peak/LOE decline, no working-capital or R&D-spend netting) — that
// simplification is disclosed in the report's caveats section.

export function calculateEV(approvalProbability, commercialProbability, npv) {
  if (
    !isFiniteNumber(approvalProbability) ||
    !isFiniteNumber(commercialProbability) ||
    !isFiniteNumber(npv)
  ) {
    return null;
  }
  return (approvalProbability / 100) * (commercialProbability / 100) * npv;
}

export function calculateNPV(peakSales, startYear, peakYear, discountRate, profitMargin) {
  if (
    !isFiniteNumber(peakSales) ||
    !isFiniteNumber(startYear) ||
    !isFiniteNumber(peakYear) ||
    !isFiniteNumber(discountRate) ||
    !isFiniteNumber(profitMargin)
  ) {
    return null;
  }
  const rampSpan = Math.max(peakYear - startYear, 1); // guard against divide-by-zero
  let npv = 0;
  for (let year = startYear; year <= startYear + 10; year++) {
    const yearsToRamp = year - startYear;
    const rampFactor = Math.min(yearsToRamp / rampSpan, 1);
    const yearlyRevenue = peakSales * rampFactor * (profitMargin / 100);
    npv += yearlyRevenue / Math.pow(1 + discountRate / 100, year - startYear);
  }
  return npv;
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Builds BASE/BULL/BEAR scenarios from raw form input. Returns null if the
// user didn't provide enough numeric data for a deterministic model — in
// that case the report prompt falls back to asking Claude to estimate
// figures itself, with explicit "this is an estimate" framing.
export function buildScenarios(formData) {
  const peakSales = toNumber(formData.basePeakSales) ?? toNumber(formData.expectedPeakSales);
  const margin = toNumber(formData.netProfitMargin);
  const approvalProb = toNumber(formData.approvalProbability);
  const commercialProb = toNumber(formData.commercialSuccessProbability);
  const discountRate = toNumber(formData.discountRate) ?? 10;
  const yearsToApproval = toNumber(formData.yearsToApproval);
  const yearsApprovalToPeak = toNumber(formData.yearsApprovalToPeak);

  const hasRequiredInputs =
    peakSales !== null &&
    margin !== null &&
    approvalProb !== null &&
    commercialProb !== null &&
    yearsToApproval !== null &&
    yearsApprovalToPeak !== null;

  if (!hasRequiredInputs) return null;

  const startYear = yearsToApproval;
  const peakYear = startYear + yearsApprovalToPeak;

  const baseNpv = calculateNPV(peakSales, startYear, peakYear, discountRate, margin);
  const baseEv = calculateEV(approvalProb, commercialProb, baseNpv);

  const bullApproval = Math.min(approvalProb + 15, 95);
  const bullCommercial = Math.min(commercialProb + 15, 95);
  const bullPeakYear = Math.max(peakYear - 1, startYear + 1);
  const bullMargin = Math.min(margin * 1.1, 95);
  const bullPeakSales = peakSales * 1.5;
  const bullNpv = calculateNPV(bullPeakSales, startYear, bullPeakYear, discountRate, bullMargin);
  const bullEv = calculateEV(bullApproval, bullCommercial, bullNpv);

  const bearApproval = Math.max(approvalProb - 15, 5);
  const bearCommercial = Math.max(commercialProb - 15, 5);
  const bearPeakYear = peakYear + 2;
  const bearMargin = margin * 0.9;
  const bearPeakSales = peakSales * 0.5;
  const bearNpv = calculateNPV(bearPeakSales, startYear, bearPeakYear, discountRate, bearMargin);
  const bearEv = calculateEV(bearApproval, bearCommercial, bearNpv);

  return {
    base: {
      approvalProbability: approvalProb,
      commercialProbability: commercialProb,
      peakSales,
      timeToPeak: yearsApprovalToPeak,
      marginAtPeak: margin,
      npv: baseNpv,
      ev: baseEv,
    },
    bull: {
      approvalProbability: bullApproval,
      commercialProbability: bullCommercial,
      peakSales: bullPeakSales,
      timeToPeak: bullPeakYear - startYear,
      marginAtPeak: bullMargin,
      npv: bullNpv,
      ev: bullEv,
    },
    bear: {
      approvalProbability: bearApproval,
      commercialProbability: bearCommercial,
      peakSales: bearPeakSales,
      timeToPeak: bearPeakYear - startYear,
      marginAtPeak: bearMargin,
      npv: bearNpv,
      ev: bearEv,
    },
  };
}
