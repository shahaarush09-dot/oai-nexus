function formatMillions(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `$${value.toFixed(0)}M`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatYears(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} yrs`;
}

const SCENARIOS = [
  { key: "bear", label: "Bear Case", accent: "border-red-200 bg-red-50/60", text: "text-red-700" },
  { key: "base", label: "Base Case", accent: "border-gold/40 bg-gold/5", text: "text-gold-dark" },
  { key: "bull", label: "Bull Case", accent: "border-teal/40 bg-teal/5", text: "text-teal" },
];

// Code-computed, not restated by the model — guarantees the numbers shown
// here always match the underlying calculation, and keeps the "no bullet
// points" rule intact for the AI's own prose (this is a UI element, not
// Claude formatting text as a bulleted list).
export default function ScenarioCards({ scenarios }) {
  if (!scenarios) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {SCENARIOS.map(({ key, label, accent, text }) => {
        const s = scenarios[key];
        if (!s) return null;
        return (
          <div key={key} className={`rounded-lg border p-4 ${accent}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest ${text}`}>
              {label}
            </p>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Approval Probability</dt>
                <dd className="font-medium text-slate-800">
                  {formatPercent(s.approvalProbability)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Peak Sales</dt>
                <dd className="font-medium text-slate-800">{formatMillions(s.peakSales)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Commercial Probability</dt>
                <dd className="font-medium text-slate-800">
                  {formatPercent(s.commercialProbability)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Expected Value</dt>
                <dd className="font-medium text-slate-800">{formatMillions(s.ev)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Time to Peak Sales</dt>
                <dd className="font-medium text-slate-800">{formatYears(s.timeToPeak)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
