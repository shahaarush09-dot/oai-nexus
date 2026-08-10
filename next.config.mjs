/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
  },
  compress: true,
  generateEtags: true,
  productionBrowserSourceMaps: false,
  // Nexus Diligence's canonical URL moved from /bio to /diligence — this
  // preserves any SEO value the old URL had and keeps existing external
  // links working.
  async redirects() {
    return [
      {
        source: "/bio",
        destination: "/diligence",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
