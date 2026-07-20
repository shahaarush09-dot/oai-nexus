export default function ProgressBar({ step, totalSteps = 4 }) {
  const pct = (step / totalSteps) * 100;
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>
          Step {step} of {totalSteps}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
