"use client";

// Where to go after an Ask Nexus answer.
//
// The answer itself is deliberately shallow — a paragraph and a few dated
// headlines — so the useful next move is almost always "take this entity
// into the tool built for the question I actually have". These three
// buttons name that move explicitly rather than leaving the reader to
// rediscover the other modules from the homepage.
//
// Copy is keyed on entity type because the same tool answers a different
// question depending on what was clicked: Clinical Nexus on a drug means
// mechanism and evidence, on a disease it means pathophysiology, and on a
// company it means reading a pipeline.

// Relative hrefs rather than https://oai-nexus.org/... on purpose: these
// are routes in this same app, so absolute production URLs would send
// anyone testing locally or on a preview deployment to the live site
// instead of the build in front of them. In production they resolve to
// exactly the requested destinations.
const TOOLS = [
  { key: "patient", href: "/patient" },
  { key: "clinical", href: "/clinical" },
  { key: "diligence", href: "/diligence" },
];

// Company names in this dataset are overwhelmingly plural ("Marinus
// Pharmaceuticals", "Novartis Pharmaceuticals"), and a naive `${name}'s`
// renders "Marinus Pharmaceuticals's". Names already ending in s take a
// bare apostrophe.
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// `name` is interpolated into each line, so "Understand Ganaxolone in plain
// language" rather than "Understand the drug".
const COPY = {
  drug: {
    patient: {
      label: "Patient Overview",
      blurb: (name) => `Understand ${name} in plain language`,
    },
    clinical: {
      label: "Clinical Details",
      blurb: (name) => `Explore ${possessive(name)} mechanism, clinical trials, and evidence`,
    },
    diligence: {
      label: "Market Analysis",
      blurb: (name) => `Analyze the commercial potential and launch strategy for ${name}`,
    },
  },
  disease: {
    patient: {
      label: "Disease Guide",
      blurb: (name) => `Learn about ${name} symptoms, diagnosis, and living with it`,
    },
    clinical: {
      label: "Clinical Science",
      blurb: (name) =>
        `Explore ${possessive(name)} biology, pathophysiology, and clinical management`,
    },
    diligence: {
      label: "Market Opportunity",
      blurb: (name) =>
        `Analyze the market opportunity and investment landscape for ${name} treatments`,
    },
  },
  company: {
    patient: {
      label: "Company Drugs",
      blurb: (name) => `Understand ${possessive(name)} drugs in patient-friendly terms`,
    },
    clinical: {
      label: "Scientific Pipeline",
      blurb: (name) =>
        `Review ${possessive(name)} pipeline from a clinical and scientific perspective`,
    },
    diligence: {
      label: "Investment Analysis",
      blurb: (name) =>
        `Analyze ${possessive(name)} financials, pipeline value, and investment potential`,
    },
  },
};

// The Explore table calls products "drug" while the Ask Nexus API calls
// them "product" (see the API_ENTITY_TYPE bridge in lib/askNexus.js).
// Accepting both keeps this component usable from either side.
const ALIASES = { product: "drug" };

export default function AskNexusCrossToolButtons({ entityType, entityName }) {
  const copy = COPY[ALIASES[entityType] || entityType];
  // An unrecognised entity type renders nothing rather than a row of
  // buttons with holes in them.
  if (!copy || !entityName) return null;

  return (
    <div className="border-t border-navy-border pt-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
        Continue in
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TOOLS.map((tool) => {
          const { label, blurb } = copy[tool.key];
          return (
            <a
              key={tool.key}
              href={tool.href}
              target="_blank"
              // noopener is what actually matters here — without it the
              // opened tab gets a handle back to this one via window.opener.
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 rounded border border-navy-border bg-navy-900 px-2.5 py-2 transition-colors hover:border-teal/40"
            >
              <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-slate-300 transition-colors group-hover:text-teal">
                {label}
              </span>
              <span className="text-[11px] font-light leading-snug text-slate-500">
                {blurb(entityName)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
