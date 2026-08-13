import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";

export const metadata = {
  title: "Clinical Nexus | Rare Disease Research Copilot",
  description:
    "Evidence-based research copilot for physicians, researchers, and students. Clinical trial data, disease mechanisms, and therapeutic approaches.",
  keywords: [
    "rare disease research",
    "clinical research ai",
    "disease research copilot",
    "rare disease literature",
    "physician research tool",
    "rare disease database",
    "clinical trial analysis",
  ],
  alternates: { canonical: "/clinical" },
  openGraph: {
    title: "Clinical Nexus | Rare Disease Research AI",
    description:
      "Research copilot for clinicians and researchers. Evidence-based summaries, trial data, and mechanisms.",
    url: "/clinical",
    type: "website",
    images: [{ url: "/clinical-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinical Nexus | Research Copilot",
    description:
      "Evidence-based AI research tool for rare disease clinicians and researchers.",
  },
};

const clinicalAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://oai-nexus.org/clinical#app",
  name: "Clinical Nexus",
  applicationCategory: "MedicalApplication",
  about: "Rare Disease Research",
  description: "Evidence-based research copilot for rare disease physicians and researchers",
  url: "https://oai-nexus.org/clinical",
  creator: { "@id": "https://oai-nexus.org/#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const examples = [
  "Summarize the MED13L syndrome research landscape from 2020 to present.",
  "What are the current therapeutic approaches for Angelman syndrome?",
  "What is the mechanism of action of nusinersen in SMA?",
  "What endpoints are being used in FOP clinical trials?",
];

const theme = {
  userBubble: "bg-clinicalblue",
  aiWash: "bg-clinicalblue/10",
  aiBorder: "border-clinicalblue/20",
  ring: "focus-within:border-clinicalblue focus-within:ring-2 focus-within:ring-clinicalblue/30",
  sendBg: "bg-clinicalblue hover:bg-clinicalblue-dark",
  chipHover: "hover:border-clinicalblue/40 hover:bg-clinicalblue/5 hover:text-clinicalblue",
};

export default function ClinicalPage() {
  return (
    <div className="min-h-screen border-t-4 border-clinicalblue bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(clinicalAppSchema) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-10">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
            &larr; OAI Nexus
          </Link>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Clinical Nexus
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rare Disease Research Copilot
          </p>

          <div className="mt-8">
            <ChatInterface
              apiPath="/api/clinical"
              examples={examples}
              theme={theme}
              placeholder="Ask a research question..."
              disclaimer="Designed for physicians, researchers, and students. Responses are summaries for research purposes and should be verified against primary literature."
            />
          </div>
      </div>
    </div>
  );
}
