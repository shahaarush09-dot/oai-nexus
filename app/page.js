import Link from "next/link";
import Hero from "@/components/home/Hero";
import Reveal from "@/components/home/Reveal";
import ParallaxLayer from "@/components/home/ParallaxLayer";
import ServiceCard from "@/components/home/ServiceCard";
import ModuleSection from "@/components/home/ModuleSection";

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

const modules = [
  {
    n: "01",
    href: "/patient",
    name: "Patient Nexus",
    short:
      "Educational support for patients and families navigating a rare disease diagnosis.",
    dot: "bg-teal",
    text: "text-teal",
    border: "hover:border-teal/50",
    ring: "group-hover:border-teal/50",
    glow: "rgba(42,157,143,0.35)",
    headline:
      "For patients and families who need a diagnosis explained like a person would explain it.",
    who: "Patients and families who need a rare disease explained in language they can actually understand — without a wall of jargon.",
    what: "Rare disease information online is written for clinicians, not for the people living the diagnosis. Patient Nexus explains a condition, its genetics, and its treatment landscape in plain language, and says so clearly when something is uncertain rather than making a rare disease sound simpler than it is. It will not diagnose or tell you what to do about a specific set of symptoms — it will help you ask your own doctor a better question.",
    cta: "Enter Patient Nexus",
  },
  {
    n: "02",
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
    n: "03",
    href: "/bio",
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

function SectionGlowWash({ tint = "rgba(200,162,74,0.16)" }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-40"
      style={{
        background: `linear-gradient(to bottom, ${tint}, transparent)`,
      }}
    />
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
          <nav className="hidden gap-6 text-xs font-medium uppercase tracking-widest text-slate-400 sm:flex">
            <Link href="/patient" className="transition-colors hover:text-teal">
              Patient
            </Link>
            <Link href="/clinical" className="transition-colors hover:text-clinicalblue">
              Clinical
            </Link>
            <Link href="/bio" className="transition-colors hover:text-gold">
              Diligence
            </Link>
          </nav>
        </div>
      </header>

      <Hero />

      {/* Quick services strip — all three visible immediately, no deep copy */}
      <section className="relative overflow-hidden border-t border-navy-600/60 bg-navy-950 py-10">
        <ParallaxLayer pattern="lines" color="rgba(200,162,74,0.1)" speed={24} opacity={0.5} />
        <SectionGlowWash tint="rgba(200,162,74,0.12)" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 sm:grid-cols-3">
          {modules.map((m, i) => (
            <ServiceCard key={m.href} module={m} delay={i * 120} />
          ))}
        </div>
      </section>

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
            <p className="mt-6 font-serif text-2xl leading-snug text-white sm:text-3xl">
              Rare disease has never had a general-purpose AI platform built
              for it. Nexus is the first publicly available AI platform
              designed specifically for rare disease, not a general medical
              chatbot repurposed for this use.
            </p>
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
              disconnected directions.
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
        {modules.map((m, i) => (
          <div key={m.href} className="relative">
            {i > 0 && <HelixDivider />}
            <ModuleSection m={m} />
          </div>
        ))}
      </section>

      <footer className="border-t border-navy-600/60 bg-navy-950 py-8 text-center text-xs text-slate-500">
        Orphan Access Initiative — Nexus. For educational and research
        purposes only. Not medical advice.
      </footer>
    </div>
  );
}
