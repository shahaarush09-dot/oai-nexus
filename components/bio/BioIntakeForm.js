"use client";

import ProgressBar from "./ProgressBar";
import { TextField, TextAreaField, SelectField } from "./fields";

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

function set(formData, setFormData, key) {
  return (value) => setFormData({ ...formData, [key]: value });
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

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressBar step={step} totalSteps={4} />

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Scientific Profile
          </h2>
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
          <h2 className="text-lg font-semibold text-slate-900">
            Clinical Development
          </h2>
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
          <h2 className="text-lg font-semibold text-slate-900">
            Market and Economics
          </h2>
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
          <h2 className="text-lg font-semibold text-slate-900">
            Regulatory
          </h2>
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

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 1}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-opacity disabled:opacity-0"
        >
          Back
        </button>
        {step < 4 ? (
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
