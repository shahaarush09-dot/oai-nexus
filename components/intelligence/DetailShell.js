"use client";

// Common chrome for the three detail views: back affordance, entity
// header, the fact grid, and the Explore hand-off. Keeping it here means
// Diseases/Companies/Products can't drift apart in layout as each one
// grows its own tables underneath.
export default function DetailShell({
  eyebrow,
  title,
  facts,
  onBack,
  backLabel,
  onBuildView,
  onAskNexus,
  children,
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-teal"
      >
        ← {backLabel}
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-teal">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-medium text-white">{title}</h2>
        </div>
        {/* The two things you can do with the record you're looking at:
            widen it into a custom view, or ask what's happened to it
            recently. Stacked below sm so a long entity name doesn't
            squeeze them into unreadable slivers on a phone. */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => onBuildView(title)}
            className="rounded border border-navy-border px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
          >
            Build a custom view from here
          </button>
          {onAskNexus && (
            <button
              type="button"
              onClick={(e) => onAskNexus(e.currentTarget)}
              className="rounded border border-navy-border px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-teal/40 hover:text-teal"
            >
              Ask Nexus
            </button>
          )}
        </div>
      </div>

      {facts?.length > 0 && (
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 rounded border border-navy-border bg-navy-900/60 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                {f.label}
              </dt>
              <dd className="mt-1 text-sm text-slate-200">
                {f.value ?? <span className="text-slate-600">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children}
    </div>
  );
}

export function Section({ title, count, children }) {
  return (
    <section className="mt-10">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
        {title}
        {count != null && (
          <span className="ml-2 text-slate-600">{count.toLocaleString("en-US")}</span>
        )}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function MapLoading({ error }) {
  if (error) {
    return (
      <p className="mt-10 text-sm font-light text-slate-500">
        Could not load the disease-company-product map. Reload to try again.
      </p>
    );
  }
  return (
    <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
      Loading linkage map…
    </p>
  );
}
