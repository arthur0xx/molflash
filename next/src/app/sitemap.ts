import type { MetadataRoute } from "next";
import { getStorefrontSnapshot } from "@/lib/repository";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const basePages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const { services } = await getStorefrontSnapshot();
    return [
      ...basePages,
      ...services.map((service) => ({
        url: `${siteUrl}/service/${service.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return basePages;
  }
}
