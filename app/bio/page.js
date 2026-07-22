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
  alternates: { canonical: "/bio" },
  openGraph: {
    title: "Nexus Diligence | Orphan Drug Intelligence",
    description:
      "Investment-grade analysis of orphan drug candidates. Built for biotech and investors.",
    url: "/bio",
    type: "website",
    images: [{ url: "/bio-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Diligence | Drug Intelligence",
    description: "Orphan drug evaluator for biotech and investment due diligence.",
  },
};

const bioAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://oai-nexus.org/bio#app",
  name: "Nexus Diligence",
  applicationCategory: "MedicalApplication",
  about: "Orphan Drug Evaluation",
  description: "Orphan drug intelligence evaluator for biotech and investment due diligence",
  url: "https://oai-nexus.org/bio",
  creator: { "@id": "https://oai-nexus.org/#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function BioPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bioAppSchema) }}
      />
      <BioPageClient />
    </>
  );
}
