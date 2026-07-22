import { Inter, Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://oai-nexus.org";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OAI Nexus | First Rare Disease AI Platform for Patients, Clinicians & Biotech",
    template: "%s | OAI Nexus",
  },
  description:
    "OAI Nexus is the first AI platform built specifically for rare disease — education for patients, research tools for clinicians, and drug analysis for biotech.",
  keywords: [
    "rare disease ai",
    "OAI Nexus",
    "orphan access initiative",
    "first rare disease ai platform",
    "orphan drug evaluator",
    "clinical research copilot",
    "rare disease intelligence platform",
    "patient rare disease education",
    "Nexus AI",
  ],
  authors: [{ name: "Orphan Access Initiative" }],
  formatDetection: { telephone: false },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "OAI Nexus | The First Rare Disease AI Platform",
    description:
      "AI-powered intelligence platform for rare disease: patient education, clinical research, and orphan drug analysis. Built by the Orphan Access Initiative.",
    url: "/",
    siteName: "OAI Nexus",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: "OAI Nexus — First Rare Disease AI Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OAI Nexus | First Rare Disease AI Platform",
    description:
      "AI platform connecting patients, clinicians, researchers, and biotech for rare disease access. Built by the Orphan Access Initiative.",
    images: ["/twitter-image-1200x675.png"],
    creator: "@OAI_Nexus",
  },
  other: {
    "revisit-after": "7 days",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a9d8f",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "OAI Nexus",
  alternateName: "Orphan Access Initiative Nexus",
  url: SITE_URL,
  description:
    "The first AI platform built specifically for rare disease. Connects patients, clinicians, researchers, and biotech professionals.",
  foundingDate: "2024",
  founder: [
    {
      "@type": "Person",
      name: "Aarush Shah",
      jobTitle: "Co-Founder",
      url: "https://www.linkedin.com/in/aarush-s-79a469282/",
    },
    {
      "@type": "Person",
      name: "Veer Chandwani",
      jobTitle: "Co-Founder",
    },
  ],
  sameAs: [
    "https://www.linkedin.com/company/111885668/",
    "https://www.orphanaccessinitiative.org/",
  ],
  knowsAbout: [
    "Rare Disease",
    "Orphan Diseases",
    "AI for Healthcare",
    "Patient Access",
    "Clinical Research",
    "Drug Development",
    "Treatment Access Barriers",
  ],
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "OAI Nexus",
  description:
    "First rare disease AI platform for patients, clinicians, researchers, and biotech.",
  publisher: {
    "@id": `${SITE_URL}/#organization`,
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "@id": `${SITE_URL}/#breadcrumb`,
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Patient Nexus", item: `${SITE_URL}/patient` },
    { "@type": "ListItem", position: 3, name: "Clinical Nexus", item: `${SITE_URL}/clinical` },
    { "@type": "ListItem", position: 4, name: "Nexus Diligence", item: `${SITE_URL}/bio` },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${plexSans.variable}`}
    >
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
