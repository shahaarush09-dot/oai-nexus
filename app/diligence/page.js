import BioPageClient from "@/components/bio/BioPageClient";

export const metadata = {
  title: "Nexus Diligence | Orphan Drug Evaluator",
  description:
    "Institutional-grade due diligence for orphan drug candidates. Investment analysis, market sizing, competitive landscape, and regulatory pathway.",
  keywords: [
    "orphan drug evaluator",
    "drug intelligence platform",
    "biotech due diligence",
    "orphan drug analysis",
    "investment thesis",
    "rare disease drug evaluation",
    "drug pipeline analysis",
  ],
  alternates: { canonical: "/diligence" },
  openGraph: {
    title: "Nexus Diligence | Orphan Drug Intelligence",
    description:
      "Investment-grade analysis of orphan drug candidates. Built for biotech and investors.",
    url: "/diligence",
    type: "website",
    images: [{ url: "/diligence-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Diligence | Drug Intelligence",
    description: "Orphan drug evaluator for biotech and investment due diligence.",
  },
};

const diligenceAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://oai-nexus.org/diligence#app",
  name: "Nexus Diligence",
  applicationCategory: "MedicalApplication",
  about: "Orphan Drug Evaluation",
  description: "Orphan drug intelligence evaluator for biotech and investment due diligence",
  url: "https://oai-nexus.org/diligence",
  creator: { "@id": "https://oai-nexus.org/#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function DiligencePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(diligenceAppSchema) }}
      />
      <BioPageClient />
    </>
  );
}
