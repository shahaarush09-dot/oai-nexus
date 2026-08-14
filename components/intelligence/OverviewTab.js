"use client";

import { useState } from "react";

// Entry points into the three browse tabs. Deliberately echoes the
// homepage ModuleCard language — dot, tracked uppercase label, short
// description, "Enter →" with the arrow sliding on hover — so this reads
// as part of OAI Nexus rather than a separate tool that happens to share
// a palette.
const CARDS = [
  {
    mode: "disease",
    name: "Search by Disease",
    blurb:
      "Prevalence, ICD-10 and OMIM codes, and the full company and product pipeline behind any rare disease.",
  },
  {
    mode: "company",
    name: "Search by Company",
    blurb:
      "The rare diseases a company works on and the rare disease products it has in development, from preclinical to approved.",
  },
  {
    mode: "drug",
    name: "Search by Product",
    blurb:
      "Development stage, mechanism of action, target diseases, and the companies behind any product.",
  },
];

const SOURCES = [
  { key: "fdaOrphanDesignationCount", noun: "FDA orphan drug designations" },
  { key: "drugsFdaApplicationCount", noun: "Drugs@FDA applications" },
  { key: "clinicalTrialCount", noun: "distinct clinical trials" },
];

function format(n) {
  return typeof n === "number" ? n.toLocaleString("en-US") : "—";
}

// Warm, second-person prose rather than a numbered how-to: this sits
// between the headline stats and the entry cards, where the job is to
// invite someone in, not to hand them a manual.
const HOW_TO = [
  {
    heading: "Browse by disease, company, or product",
    body: "Search for anything using the bar at the top, and switch between drugs, diseases, and companies with one click. Open any result to see its profile: who is working on it, what they have in rare disease development, and how far along that pipeline is.",
  },
  {
    heading: "Build the view you actually want",
    body: "The Explore tab hands you all 63,433 links at once. Stack filters by stage, category, source, or trial status, group the results however makes sense to you, and download your exact slice as a CSV. Nothing is locked into a fixed layout.",
  },
  {
    heading: "Check what happened recently",
    body: "Click any drug, company, or disease name and choose Ask Nexus. You get a short, sourced summary of recent news, drawn from places like the FDA, ClinicalTrials.gov, and major biotech outlets, with each item attributed to where it came from.",
  },
];

export default function OverviewTab({ stats, onEnter, onExplore, onStartTour, tourDone }) {
  const [aboutOpen, setAboutOpen] = useState(false);

  const headline = [
    {
      value: stats?.diseaseCount,
      label: "Diseases",
      sub: stats?.diseasesWithLinkedCompanies
        ? `${format(stats.diseasesWithLinkedCompanies)} with at least one linked company`
        : null,
    },
    { value: stats?.companyCount, label: "Companies" },
    { value: stats?.productCount, label: "Products" },
    { value: stats?.mapRowCount, label: "Disease-Company-Product Map" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <section>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {headline.map((s) => (
            <div key={s.label}>
              <p className="font-serif text-4xl font-medium tabular-nums text-white sm:text-5xl">
                {format(s.value)}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase leading-tight tracking-[0.2em] text-teal">
                {s.label}
              </p>
              {s.sub && (
                <p className="mt-2 text-xs font-light leading-snug text-slate-500">
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm font-light leading-relaxed text-slate-400">
          Built from{" "}
          {SOURCES.map((s, i) => (
            <span key={s.key}>
              {i === SOURCES.length - 1 ? "and " : ""}
              <span className="tabular-nums text-slate-200">
                {format(stats?.[s.key])}
              </span>{" "}
              {s.noun}
              {i < SOURCES.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>

      </section>

      <section className="mt-14 max-w-3xl">
        <h2 className="font-serif text-2xl font-medium text-white">
          How to use Nexus Intelligence
        </h2>
        <div className="mt-6 space-y-6">
          {HOW_TO.map((item) => (
            <div key={item.heading}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal">
                {item.heading}
              </p>
              <p className="mt-2 text-sm font-light leading-relaxed text-slate-300">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          {tourDone ? (
            <p className="inline-flex items-center gap-2 rounded border border-navy-border bg-navy-900/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              Tour complete
            </p>
          ) : (
            <button
              type="button"
              onClick={onStartTour}
              className="group inline-flex items-center gap-2 rounded border border-teal/40 bg-teal/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-teal transition-colors hover:border-teal hover:bg-teal/20"
            >
              Take a quick tour
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <button
            key={card.mode}
            type="button"
            onClick={() => onEnter(card.mode)}
            className="group flex flex-col justify-between rounded-lg border border-navy-600 bg-navy-900/60 p-5 text-left transition-colors duration-300 hover:border-teal/50 hover:shadow-[0_0_30px_-8px_rgba(42,157,143,0.5)]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                  {card.name}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {card.blurb}
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-teal">
              Enter
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </span>
          </button>
        ))}
      </section>

      <section className="mt-14 max-w-3xl">
        <p className="text-sm font-light leading-relaxed text-slate-400">
          Every record here is assembled from public government and research
          sources: disease definitions and prevalence from Orphanet, orphan
          drug designations and approvals from the FDA, and trial-stage
          evidence from ClinicalTrials.gov. Nothing is scraped from secondary
          sites, and nothing is generated by a language model. The links
          between diseases, companies, and products are produced by a
          reproducible matching pipeline, and each one carries the source and
          confidence score it was derived from.
        </p>

        <button
          type="button"
          onClick={() => setAboutOpen((o) => !o)}
          aria-expanded={aboutOpen}
          className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-teal"
        >
          {aboutOpen ? "− " : "+ "}
          About the data and matching
        </button>

        {aboutOpen && (
          <div className="mt-4 space-y-3 rounded border border-navy-border bg-navy-900/60 p-5 text-sm font-light leading-relaxed text-slate-400">
            <p>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
                How links are made{" "}
              </span>
              A disease-company-product row exists when a company appears as a
              sponsor on a trial or designation tied to that disease. Trial
              records supply most rows; FDA orphan designations supply the
              rest.
            </p>
            <p>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
                Match score{" "}
              </span>
              Disease names differ across sources, so names are matched rather
              than joined on a shared key. The score, from 88 to 100, records
              how close that match was: 100 means an exact or
              trial-verified match, and lower values mean a fuzzy name match
              that may warrant a second look. The Explore tab lets you filter
              these out.
            </p>
            <p>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
                What this is not{" "}
              </span>
              This is a map of who is working on what, not a clinical or
              investment recommendation. Development stages reflect what the
              sources reported at the last refresh and can lag real-world
              status.
            </p>
          </div>
        )}
      </section>

      <section className="mt-14 rounded-lg border border-navy-border bg-navy-900/40 p-8 text-center">
        <p className="font-serif text-2xl font-medium text-white">
          Build any view of the data you want
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm font-light leading-relaxed text-slate-400">
          Filter all {format(stats?.mapRowCount)} map rows by stage, category,
          source, and trial status, group them however you like, and export
          exactly what you see.
        </p>
        <button
          type="button"
          onClick={onExplore}
          className="group mt-6 inline-flex items-center gap-2 rounded border border-teal/40 bg-teal/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-teal transition-colors hover:border-teal hover:bg-teal/20"
        >
          Explore everything
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </button>
      </section>
    </div>
  );
}
