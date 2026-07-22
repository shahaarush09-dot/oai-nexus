import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";

export const metadata = {
  title: "Patient Nexus | Rare Disease Education AI",
  description:
    "AI-powered educational assistant for rare disease patients and families. Understand your diagnosis, explore treatments, and find clinical trials.",
  keywords: [
    "rare disease education",
    "patient companion ai",
    "rare disease chatbot",
    "clinical trial finder",
    "rare disease diagnosis explained",
    "orphan disease education",
  ],
  alternates: { canonical: "/patient" },
  openGraph: {
    title: "Patient Nexus | Rare Disease Education AI",
    description:
      "Educational AI for rare disease patients. Plain language explanations, treatments, trials, and resources.",
    url: "/patient",
    type: "website",
    images: [{ url: "/patient-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Patient Nexus | Rare Disease Education",
    description:
      "AI assistant explaining rare diseases in plain language for patients and families.",
  },
};

const patientAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://oai-nexus.org/patient#app",
  name: "Patient Nexus",
  applicationCategory: "MedicalApplication",
  about: "Rare Disease",
  description: "AI-powered educational assistant for rare disease patients and families",
  url: "https://oai-nexus.org/patient",
  creator: { "@id": "https://oai-nexus.org/#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const examples = [
  "What is Rett syndrome and what causes it?",
  "What clinical trials exist for FOP right now?",
  "What does it mean if my child has a de novo mutation?",
  "What organizations support families with SMA?",
];

const theme = {
  userBubble: "bg-teal",
  aiWash: "bg-teal/10",
  aiBorder: "border-teal/20",
  ring: "focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/30",
  sendBg: "bg-teal hover:bg-teal-dark",
  chipHover: "hover:border-teal/40 hover:bg-teal/5 hover:text-teal",
};

export default function PatientPage() {
  return (
    <div className="min-h-screen border-t-4 border-teal bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(patientAppSchema) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          &larr; OAI Nexus
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          Patient Nexus
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Rare Disease Education for Patients and Families
        </p>

        <div className="mt-8">
          <ChatInterface
            apiPath="/api/patient"
            examples={examples}
            theme={theme}
            placeholder="Ask about a condition, a treatment, or a trial..."
            disclaimer="Nexus provides educational information only. It does not diagnose or treat, and does not replace advice from a qualified physician."
          />
        </div>
      </div>
    </div>
  );
}
