import Link from "next/link";
import Hero from "@/components/home/Hero";
import Reveal from "@/components/home/Reveal";
import ParallaxLayer from "@/components/home/ParallaxLayer";
import ModuleSection from "@/components/home/ModuleSection";

const faqs = [
  {
    question: "What is OAI Nexus?",
    answer:
      "OAI Nexus is the first AI platform built specifically for rare disease. It has four modules: Nexus Intelligence, a searchable map of rare diseases, companies, and products in development; Patient Nexus for patient education; Clinical Nexus for research; and Nexus Diligence for drug evaluation.",
  },
  {
    question: "Is OAI Nexus the first rare disease AI platform?",
    answer:
      "Yes, OAI Nexus is believed to be the first publicly available AI platform purpose-built for rare disease, not a general medical AI adapted for rare disease.",
  },
  {
    question: "Who is OAI Nexus for?",
    answer:
      "OAI Nexus serves patients and families seeking rare disease education, physicians and researchers needing clinical evidence, and biotech investors and professionals evaluating orphan drugs. Nexus Intelligence serves all three by making the underlying landscape searchable.",
  },
  {
    question: "What are the four modules of OAI Nexus?",
    answer:
      "Nexus Intelligence is a browsable database of rare diseases, companies, and products in development. Patient Nexus is for patient education, Clinical Nexus is for research professionals, and Nexus Diligence is for biotech and investment due diligence on orphan drugs.",
  },
  {
    question: "Is OAI Nexus free to use?",
    answer:
      "Yes, OAI Nexus is free and accessible to patients, clinicians, researchers, students, and biotech professionals working in rare disease.",
  },
  {
    question: "What is an orphan drug?",
    answer:
      "An orphan drug is a medication developed to treat a rare disease or condition. In the US, a disease is considered rare if it affects fewer than 200,000 people.",
  },
  {
    question: "What is the Orphan Access Initiative?",
    answer:
      "The Orphan Access Initiative is a student-led research organization that built OAI Nexus to understand why promising treatments don't reach rare disease patients.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const stats = [
  {
    value: "7,000–10,000",
    label: "Rare diseases identified to date",
    source: "Estimated range, NORD / EURORDIS",
  },
  {
    value: "~72%",
    label: "Believed to have a genetic origin",
    source: "EURORDIS estimate",
  },
  {
    value: "4–7 yrs",
    label: "Average wait for an accurate diagnosis",
    source: "Commonly reported across patient surveys",
  },
];

// Intelligence sits first because it's the entry point to the others: the
// dataset is what the three assistants reason about. Position alone does
// the signalling — no size bump or badge, which together would read as
// three separate claims to importance.
const modules = [
  {
    n: "01",
    href: "/intelligence",
    name: "Nexus Intelligence",
    short:
      "Search 11,645 rare diseases, the 7,851 companies working on them, and 23,883 products in development.",
    dot: "bg-teal",
    text: "text-teal",
    border: "hover:border-teal/50",
    ring: "group-hover:border-teal/50",
    glow: "rgba(42,157,143,0.35)",
    headline:
      "For anyone who wants to see the whole rare disease landscape at once, not one answer at a time.",
    who: "Researchers, investors, clinicians, and patient advocates who want to explore what exists across rare disease rather than ask a single question about it.",
    what: "Rare disease data is scattered across Orphanet, FDA orphan designations, Drugs@FDA, and ClinicalTrials.gov, and none of those talk to each other. Nexus Intelligence joins them into one browsable map of 63,433 disease-company-product links you can filter, group, and export however you want. Every row carries the source and match confidence it came from, so you can see exactly where a claim originates rather than taking it on faith.",
    cta: "Enter Nexus Intelligence",
  },
  {
    n: "02",
    href: "/patient",
    name: "Patient Nexus",
    short:
      "Educational support for patients and families navigating a rare disease diagnosis.",
    dot: "bg-sage",
    text: "text-sage",
    border: "hover:border-sage/50",
    ring: "group-hover:border-sage/50",
    glow: "rgba(127,166,118,0.35)",
    headline:
      "For patients and families who need a diagnosis explained like a person would explain it.",
    who: "Patients and families who need a rare disease explained in language they can actually understand — without a wall of jargon.",
    what: "Rare disease information online is written for clinicians, not for the people living the diagnosis. Patient Nexus explains a condition, its genetics, and its treatment landscape in plain language, and says so clearly when something is uncertain rather than making a rare disease sound simpler than it is. It will not diagnose or tell you what to do about a specific set of symptoms — it will help you ask your own doctor a better question.",
    cta: "Enter Patient Nexus",
  },
  {
    n: "03",
    href: "/clinical",
    name: "Clinical Nexus",
    short:
      "A research copilot for physicians, researchers, and students in the rare disease space.",
    dot: "bg-clinicalblue",
    text: "text-clinicalblue",
    border: "hover:border-clinicalblue/50",
    ring: "group-hover:border-clinicalblue/50",
    glow: "rgba(59,111,214,0.35)",
    headline:
      "For physicians, researchers, and students who need a research copilot that won't invent a citation.",
    who: "Physicians, researchers, and students who need a fast, evidence-grounded research copilot for rare disease literature and mechanisms.",
    what: "Rare disease literature is scattered across small cohorts, case reports, and trials that rarely surface in a standard search. Clinical Nexus moves quickly through mechanism, pathway, clinical evidence, and open questions without collapsing into a generic summary. It is explicit about what is established, what is preliminary, and what is genuinely contested — and says plainly when it doesn't have a reliable source, rather than fabricate one.",
    cta: "Enter Clinical Nexus",
  },
  {
    n: "04",
    href: "/diligence",
    name: "Nexus Diligence",
    short: "Structured, investor-grade diligence on orphan drug candidates.",
    dot: "bg-gold",
    text: "text-gold",
    border: "hover:border-gold/50",
    ring: "group-hover:border-gold/50",
    glow: "rgba(200,162,74,0.35)",
    headline:
      "For investors, biotech teams, and drug developers evaluating an orphan drug candidate.",
    who: "Investors, biotech teams, and drug developers who need a structured, analytical evaluation of an orphan drug candidate before committing capital or resources.",
    what: "Assessing a rare disease therapeutic means reasoning across science, regulation, epidemiology, and pricing at once — and rare disease markets don't behave like the rest of pharma. Nexus Diligence takes a structured profile of a candidate and returns an analyst-grade assessment: scientific footing, clinical outlook, market and epidemiology, pricing, competitive landscape, and the investment case for and against. It flags missing or uncertain data instead of inventing numbers to fill the gap.",
    cta: "Enter Nexus Diligence",
  },
];

function HelixDivider() {
  return (
    <div className="mx-auto my-2 h-px w-full max-w-5xl" aria-hidden="true">
      <svg
        viewBox="0 0 400 16"
        className="h-4 w-full text-navy-500"
        preserveAspectRatio="none"
      >
        <path
          d="M0 8 Q 25 0, 50 8 T 100 8 T 150 8 T 200 8 T 250 8 T 300 8 T 350 8 T 400 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        {Array.from({ length: 9 }).map((_, i) => (
          <circle key={i} cx={i * 50} cy={8} r="1.6" className="fill-gold/50" />
        ))}
      </svg>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-navy-900 font-plex text-white selection:bg-gold selection:text-navy-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-navy-600/60 bg-navy-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300">
            Orphan Access Initiative
          </span>
          <div className="flex items-center gap-6">
            <nav className="hidden gap-6 text-xs font-medium uppercase tracking-widest text-slate-400 sm:flex">
              <Link href="/intelligence" className="transition-colors hover:text-teal">
                Intelligence
              </Link>
              <Link href="/patient" className="transition-colors hover:text-sage">
                Patient
              </Link>
              <Link href="/clinical" className="transition-colors hover:text-clinicalblue">
                Clinical
              </Link>
              <Link href="/diligence" className="transition-colors hover:text-gold">
                Diligence
              </Link>
            </nav>
            <a
              href="https://www.orphanaccessinitiative.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium uppercase tracking-widest text-slate-500 transition-colors hover:text-teal"
            >
              &larr; Back to OAI
            </a>
          </div>
        </div>
      </header>

      <Hero modules={modules} />

      {/* Positioning section */}
      <section className="relative border-t border-navy-600/60 bg-navy-900 py-24">
        <ParallaxLayer
          pattern="dots"
          color="rgba(200,162,74,0.15)"
          size={26}
          speed={50}
          opacity={0.35}
          mask="radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%)"
        />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
              What Nexus Is
            </p>
            <h2 className="mt-6 font-serif text-2xl font-normal leading-snug text-white sm:text-3xl">
              Rare disease has never had a general-purpose AI platform built
              for it. Nexus is the first publicly available AI platform
              designed specifically for rare disease, not a general medical
              chatbot repurposed for this use.
            </h2>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              That distinction matters because rare disease is not one
              problem — it&rsquo;s three, held together by the same
              underlying science. A family needs a diagnosis explained in
              language they can actually use. A physician or researcher needs
              a fast, evidence-grounded way to move through a literature base
              too fragmented and too thin for any one person to track alone.
              An investor or drug developer needs a disciplined, structured
              read on whether a therapeutic candidate is worth the capital
              and years it will take to bring forward.
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              Patient Nexus, Clinical Nexus, and Nexus Diligence are built
              for exactly those three audiences. Each is scoped, worded, and
              grounded differently for the person using it — but each draws
              on the same underlying understanding of the disease in
              question, so the ecosystem moves together instead of in three
              disconnected directions. Nexus Intelligence sits underneath all
              three: the structured map of which rare diseases, companies, and
              products actually exist, and how they connect.
            </p>
          </Reveal>

          <Reveal delay={150} className="flex flex-col gap-6">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-navy-500 pl-5">
                <div className="font-serif text-3xl text-gold-light">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-slate-300">{s.label}</div>
                <div className="mt-1 text-xs text-slate-500">{s.source}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Deep module explanations */}
      <section className="relative overflow-hidden border-t border-navy-600/60 bg-navy-950 py-8">
        <ParallaxLayer
          pattern="dots"
          color="rgba(255,255,255,0.06)"
          size={34}
          speed={60}
          opacity={0.4}
        />
        <h2 className="relative mx-auto max-w-6xl px-6 pt-8 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Three Specialized AI Modules for Rare Disease
        </h2>
        {modules.map((m, i) => (
          <div key={m.href} className="relative">
            {i > 0 && <HelixDivider />}
            <ModuleSection m={m} />
          </div>
        ))}
      </section>

      {/* FAQ — mirrors the FAQPage JSON-LD below; kept visible rather than
          hidden off-screen, since structured data should reflect what a
          user actually sees on the page. */}
      <section className="relative border-t border-navy-600/60 bg-navy-900 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
            Questions
          </p>
          <h2 className="mt-4 font-serif text-2xl font-normal text-white sm:text-3xl">
            Frequently Asked Questions About OAI Nexus
          </h2>
          <dl className="mt-10 flex flex-col gap-8">
            {faqs.map((faq) => (
              <div key={faq.question} className="border-t border-navy-600/60 pt-6">
                <dt>
                  <h3 className="font-serif text-lg text-white">{faq.question}</h3>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-300">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <footer role="contentinfo" className="border-t border-navy-600/60 bg-navy-950">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
              OAI Nexus
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              The first AI platform built specifically for rare disease.
              Education for patients, research tools for clinicians,
              investment analysis for biotech.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
              Platform
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-500">
              <li>
                <Link href="/" className="transition-colors hover:text-teal">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/intelligence" className="transition-colors hover:text-teal">
                  Nexus Intelligence
                </Link>
              </li>
              <li>
                <Link href="/patient" className="transition-colors hover:text-sage">
                  Patient Nexus
                </Link>
              </li>
              <li>
                <Link href="/clinical" className="transition-colors hover:text-clinicalblue">
                  Clinical Nexus
                </Link>
              </li>
              <li>
                <Link href="/diligence" className="transition-colors hover:text-gold">
                  Nexus Diligence
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
              Organization
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-500">
              <li>
                <a
                  href="https://www.orphanaccessinitiative.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-teal"
                >
                  Orphan Access Initiative
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/111885668/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-teal"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-600/60 px-6 py-6 text-center text-xs text-slate-500">
          Orphan Access Initiative — Nexus. For educational and research
          purposes only. Not medical advice.
        </div>
      </footer>
    </div>
  );
}
