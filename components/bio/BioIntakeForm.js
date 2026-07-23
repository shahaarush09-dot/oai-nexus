"use client";

import ProgressBar from "./ProgressBar";
import { TextField, TextAreaField, SelectField, NumberField, CheckboxGroupField } from "./fields";

const MODALITY_OPTIONS = [
  "Small Molecule",
  "Gene Therapy",
  "Cell Therapy",
  "RNA Therapy (ASO/siRNA)",
  "Monoclonal Antibody",
  "Enzyme Replacement",
  "Other",
];

const PHASE_OPTIONS = [
  "Preclinical",
  "Phase 1",
  "Phase 1/2",
  "Phase 2",
  "Phase 3",
  "Approved",
];

const PRICE_OPTIONS = [
  "Under $100K",
  "$100K-$500K",
  "$500K-$1M",
  "Over $1M",
  "Unknown",
];

const REG_OPTIONS = ["Yes", "No", "Pending", "Unknown"];

const SALES_FORCE_OPTIONS = ["Yes", "No", "Building", "Planning to partner"];
const PARTNER_REGION_OPTIONS = ["US only", "US+EU", "Global", "Developing markets"];
const LAUNCH_REGION_OPTIONS = ["US", "Europe", "Japan", "Rest of world", "Emerging markets"];
const PATIENT_ID_OPTIONS = [
  "Specialist referral",
  "Primary care referral",
  "Genetic testing or newborn screening",
  "Direct-to-consumer",
  "Patient registry or advocacy outreach",
  "Combination",
  "Unknown",
];
const REGISTRY_OPTIONS = ["Yes", "No", "Partial"];
const ACCESS_BARRIER_OPTIONS = [
  "Cost",
  "Awareness",
  "Diagnosis delay",
  "Geographic access",
  "Physician resistance",
  "Other",
];
const PAYER_OPTIONS = ["Commercial insurance", "Medicaid", "Medicare", "Cash-pay", "Mix"];
const YES_NO_UNSURE = ["Yes", "No", "Unsure"];
const STANDARD_OF_CARE_OPTIONS = ["No treatment available", "Limited treatment", "Multiple options"];
const PATIENT_PREFERENCE_OPTIONS = [
  "Better efficacy",
  "Better safety",
  "Better convenience",
  "Lower cost",
  "Other",
];

const STEP_META = [
  { title: "Scientific Profile", blurb: "The drug, its mechanism, and the disease it targets." },
  { title: "Clinical Development", blurb: "Trial design, timeline, and endpoints." },
  { title: "Market & Economics", blurb: "Disease size, pricing context, and competing therapies." },
  { title: "Regulatory", blurb: "Designations and the pathway to approval." },
  {
    title: "Commercialization",
    blurb: "Sales infrastructure, patient access, and payer strategy — this is what turns approval into revenue.",
  },
  {
    title: "Strategic Assumptions",
    blurb: "The numbers behind the financial model: peak sales, margins, probabilities, and what could move the valuation most.",
  },
];

function set(formData, setFormData, key) {
  return (value) => setFormData({ ...formData, [key]: value });
}

function SubSection({ title, children }) {
  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function BioIntakeForm({
  step,
  formData,
  setFormData,
  onNext,
  onBack,
  onSubmit,
}) {
  const f = formData;
  const upd = (key) => set(f, setFormData, key);
  const meta = STEP_META[step - 1];

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressBar step={step} totalSteps={6} />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{meta.blurb}</p>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <TextField
            label="Drug or therapy name"
            value={f.drugName}
            onChange={upd("drugName")}
          />
          <TextField
            label="Developing company"
            value={f.company}
            onChange={upd("company")}
          />
          <TextField
            label="Disease indication"
            value={f.indication}
            onChange={upd("indication")}
          />
          <TextField
            label="Target gene or protein"
            value={f.target}
            onChange={upd("target")}
          />
          <TextAreaField
            label="Mechanism of action"
            value={f.mechanism}
            onChange={upd("mechanism")}
            rows={4}
          />
          <SelectField
            label="Modality"
            value={f.modality}
            onChange={upd("modality")}
            options={MODALITY_OPTIONS}
          />
          <SelectField
            label="Current clinical phase"
            value={f.phase}
            onChange={upd("phase")}
            options={PHASE_OPTIONS}
          />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <TextField
            label="Estimated trial size (number of patients)"
            value={f.trialSize}
            onChange={upd("trialSize")}
          />
          <TextField
            label="Primary endpoint"
            value={f.primaryEndpoint}
            onChange={upd("primaryEndpoint")}
          />
          <TextAreaField
            label="Patient population description"
            value={f.patientPopulation}
            onChange={upd("patientPopulation")}
            rows={3}
          />
          <TextAreaField
            label="Notable safety signals (optional)"
            value={f.safetySignals}
            onChange={upd("safetySignals")}
            rows={3}
          />
          <TextAreaField
            label="Summary of prior clinical results, if any (optional)"
            value={f.priorResults}
            onChange={upd("priorResults")}
            rows={3}
          />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <TextField
            label="Global disease prevalence (estimated number of patients)"
            value={f.prevalence}
            onChange={upd("prevalence")}
          />
          <TextField
            label="Diagnosed population (may differ from prevalence)"
            value={f.diagnosedPopulation}
            onChange={upd("diagnosedPopulation")}
          />
          <TextField
            label="Primary geography of market"
            value={f.geography}
            onChange={upd("geography")}
          />
          <TextField
            label="Current standard of care"
            value={f.standardOfCare}
            onChange={upd("standardOfCare")}
          />
          <TextAreaField
            label="Main competing therapies"
            value={f.competingTherapies}
            onChange={upd("competingTherapies")}
            rows={3}
          />
          <SelectField
            label="Rough annual price assumption"
            value={f.priceAssumption}
            onChange={upd("priceAssumption")}
            options={PRICE_OPTIONS}
          />
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-5">
          <SelectField
            label="FDA Orphan Drug Designation"
            value={f.fdaOrphan}
            onChange={upd("fdaOrphan")}
            options={REG_OPTIONS}
          />
          <SelectField
            label="FDA Fast Track"
            value={f.fdaFastTrack}
            onChange={upd("fdaFastTrack")}
            options={REG_OPTIONS}
          />
          <SelectField
            label="FDA Breakthrough Therapy"
            value={f.fdaBreakthrough}
            onChange={upd("fdaBreakthrough")}
            options={REG_OPTIONS}
          />
          <SelectField
            label="EMA Orphan Designation"
            value={f.emaOrphan}
            onChange={upd("emaOrphan")}
            options={REG_OPTIONS}
          />
          <TextAreaField
            label="Any other regulatory notes (optional)"
            value={f.regulatoryNotes}
            onChange={upd("regulatoryNotes")}
            rows={3}
          />
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-6">
          <SubSection title="Commercial Infrastructure">
            <SelectField
              label="Does the company have an existing sales force?"
              value={f.salesForceStatus}
              onChange={upd("salesForceStatus")}
              options={SALES_FORCE_OPTIONS}
            />
            <SelectField
              label="If partnering, which regions/markets?"
              value={f.partneringRegions}
              onChange={upd("partneringRegions")}
              options={PARTNER_REGION_OPTIONS}
            />
            <NumberField
              label="Sales force size estimate"
              value={f.salesForceSize}
              onChange={upd("salesForceSize")}
              min={0}
              step={1}
              suffix="reps"
            />
            <CheckboxGroupField
              label="Planned launch regions"
              value={f.launchRegions}
              onChange={upd("launchRegions")}
              options={LAUNCH_REGION_OPTIONS}
            />
          </SubSection>

          <SubSection title="Patient Identification & Access">
            <SelectField
              label="How will patients be identified?"
              value={f.patientIdentification}
              onChange={upd("patientIdentification")}
              options={PATIENT_ID_OPTIONS}
            />
            <SelectField
              label="Is there a patient registry for this disease?"
              value={f.patientRegistry}
              onChange={upd("patientRegistry")}
              options={REGISTRY_OPTIONS}
            />
            <NumberField
              label="Estimated time to reach 50% of addressable market"
              value={f.timeToHalfMarket}
              onChange={upd("timeToHalfMarket")}
              min={0}
              suffix="years"
            />
            <CheckboxGroupField
              label="Key barriers to patient access"
              value={f.accessBarriers}
              onChange={upd("accessBarriers")}
              options={ACCESS_BARRIER_OPTIONS}
            />
          </SubSection>

          <SubSection title="Payer Landscape">
            <CheckboxGroupField
              label="Primary payers"
              value={f.primaryPayers}
              onChange={upd("primaryPayers")}
              options={PAYER_OPTIONS}
            />
            <NumberField
              label="For commercial: estimated coverage likelihood"
              value={f.commercialCoverageLikelihood}
              onChange={upd("commercialCoverageLikelihood")}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberField
              label="Estimated patient copay once approved (if applicable)"
              value={f.estimatedCopay}
              onChange={upd("estimatedCopay")}
              min={0}
              suffix="$ / month"
            />
            <SelectField
              label="Reimbursement precedent? (a covered therapy to model pricing after)"
              value={f.reimbursementPrecedent}
              onChange={upd("reimbursementPrecedent")}
              options={YES_NO_UNSURE}
            />
          </SubSection>

          <SubSection title="Commercialization Timeline">
            <NumberField
              label="Years from now until regulatory approval (estimate)"
              value={f.yearsToApproval}
              onChange={upd("yearsToApproval")}
              min={0}
              suffix="years"
            />
            <NumberField
              label="Years from approval to peak sales (estimate)"
              value={f.yearsApprovalToPeak}
              onChange={upd("yearsApprovalToPeak")}
              min={0}
              suffix="years"
            />
            <NumberField
              label="Expected peak annual sales, rough estimate (optional)"
              value={f.expectedPeakSales}
              onChange={upd("expectedPeakSales")}
              min={0}
              suffix="$ million"
            />
          </SubSection>

          <SubSection title="Competitive Landscape (Detailed)">
            <NumberField
              label="How many competitors currently approved for this indication?"
              value={f.approvedCompetitorsCount}
              onChange={upd("approvedCompetitorsCount")}
              min={0}
              step={1}
            />
            <NumberField
              label="How many in pipeline (clinical stage or earlier)?"
              value={f.pipelineCompetitorsCount}
              onChange={upd("pipelineCompetitorsCount")}
              min={0}
              step={1}
            />
            <NumberField
              label="Estimated market share you'd capture at peak"
              value={f.peakMarketShare}
              onChange={upd("peakMarketShare")}
              min={0}
              max={100}
              suffix="%"
            />
            <TextAreaField
              label="Key competitive advantage vs. existing/pipeline"
              value={f.competitiveAdvantage}
              onChange={upd("competitiveAdvantage")}
              rows={3}
            />
          </SubSection>

          <SubSection title="Unmet Need & Differentiation">
            <SelectField
              label="Current standard of care"
              value={f.standardOfCareLevel}
              onChange={upd("standardOfCareLevel")}
              options={STANDARD_OF_CARE_OPTIONS}
            />
            <TextAreaField
              label="Key unmet need this drug addresses"
              value={f.unmetNeed}
              onChange={upd("unmetNeed")}
              rows={3}
            />
            <TextAreaField
              label="How is this drug differentiated?"
              value={f.differentiation}
              onChange={upd("differentiation")}
              rows={3}
            />
            <SelectField
              label="Patient preference (if known)"
              value={f.patientPreference}
              onChange={upd("patientPreference")}
              options={PATIENT_PREFERENCE_OPTIONS}
            />
          </SubSection>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col gap-6">
          <SubSection title="Base Case Assumptions">
            <NumberField
              label="Peak annual sales (user estimate, if known)"
              value={f.basePeakSales}
              onChange={upd("basePeakSales")}
              min={0}
              suffix="$ million"
            />
            <NumberField
              label="Net profit margin (gross margin minus commercialization costs)"
              value={f.netProfitMargin}
              onChange={upd("netProfitMargin")}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberField
              label="Probability of regulatory approval"
              value={f.approvalProbability}
              onChange={upd("approvalProbability")}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberField
              label="Probability of commercial success post-approval"
              value={f.commercialSuccessProbability}
              onChange={upd("commercialSuccessProbability")}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberField
              label="Discount rate for NPV"
              value={f.discountRate}
              onChange={upd("discountRate")}
              min={0}
              max={50}
              placeholder="10"
              suffix="%"
            />
          </SubSection>

          <SubSection title="Key Value Drivers">
            <TextField
              label="What is the single biggest value driver for this asset?"
              value={f.biggestValueDriver}
              onChange={upd("biggestValueDriver")}
            />
            <TextField
              label="What is the biggest risk to value?"
              value={f.biggestRisk}
              onChange={upd("biggestRisk")}
            />
            <TextField
              label="What regulatory/commercial event could kill the deal?"
              value={f.dealKillerEvent}
              onChange={upd("dealKillerEvent")}
            />
            <TextField
              label="What event could double the value?"
              value={f.valueDoublingEvent}
              onChange={upd("valueDoublingEvent")}
            />
          </SubSection>

          <SubSection title="Comparable Assets">
            <TextAreaField
              label="Are there comparable approved drugs or trials you'd benchmark against?"
              value={f.comparableAssets}
              onChange={upd("comparableAssets")}
              rows={3}
            />
            <NumberField
              label="If yes, what's their peak annual sales?"
              value={f.comparablePeakSales}
              onChange={upd("comparablePeakSales")}
              min={0}
              suffix="$ million"
            />
          </SubSection>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 1}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-opacity disabled:opacity-0"
        >
          Back
        </button>
        {step < 6 ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-gold px-5 py-2 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-md bg-gold px-5 py-2 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Generate Intelligence Report
          </button>
        )}
      </div>
    </div>
  );
}
