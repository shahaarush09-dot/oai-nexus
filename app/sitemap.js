// /admin/stats is deliberately excluded — it's an unlisted, password-gated
// analytics page and publishing its path in a public sitemap would defeat
// that (see robots.txt disallow, which is a courtesy signal, not the
// actual security boundary — the password check on that route is).
export default function sitemap() {
  const baseUrl = "https://oai-nexus.org";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/patient`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/clinical`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/bio`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
