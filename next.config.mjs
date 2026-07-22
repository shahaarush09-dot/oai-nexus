/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
  },
  compress: true,
  generateEtags: true,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
