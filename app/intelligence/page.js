import IntelligencePageClient from "@/components/intelligence/IntelligencePageClient";
// Read at build time from the same file the UI reads at runtime, so the
// search-result snippet can't drift from the dataset the way a hardcoded
// count would on the next pipeline refresh.
import stats from "@/public/data/metadata.json";

const n = (value) => value.toLocaleString("en-US");

export const metadata = {
  title: "Nexus Intelligence | Rare Disease Database Explorer",
  description: `Search and filter ${n(stats.diseaseCount)} rare diseases, ${n(
    stats.companyCount
  )} companies, and ${n(
    stats.productCount
  )} products in development. Built from FDA orphan drug designations, Drugs@FDA, and ClinicalTrials.gov.`,
  keywords: [
    "rare disease database",
    "orphan drug pipeline",
    "rare disease drug development",
    "biotech pipeline explorer",
    "orphan drug designations",
    "clinical trial database",
  ],
  alternates: { canonical: "/intelligence" },
  openGraph: {
    title: "Nexus Intelligence | Rare Disease Database Explorer",
    description: `A browsable map of ${n(
      stats.mapRowCount
    )} disease-company-product links, built from Orphanet, the FDA, and ClinicalTrials.gov.`,
    url: "/intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Intelligence | Rare Disease Database Explorer",
    description: `Search ${n(stats.diseaseCount)} rare diseases, ${n(
      stats.companyCount
    )} companies, and ${n(stats.productCount)} products in development.`,
  },
};

const intelligenceAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://oai-nexus.org/intelligence#app",
  name: "Nexus Intelligence",
  applicationCategory: "MedicalApplication",
  about: "Rare Disease Drug Development Intelligence",
  description:
    "Browsable, filterable explorer over a structured rare disease database of diseases, companies, and products in development.",
  url: "https://oai-nexus.org/intelligence",
  creator: { "@id": "https://oai-nexus.org/#organization" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function IntelligencePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(intelligenceAppSchema) }}
      />
      <IntelligencePageClient />
    </>
  );
}
