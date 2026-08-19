import type { MetadataRoute } from "next";
import { getPublicBlogSnapshot, getStorefrontSnapshot } from "@/lib/repository";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const basePages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const [{ services }, { posts }] = await Promise.all([getStorefrontSnapshot(), getPublicBlogSnapshot()]);
    return [
      ...basePages,
      ...services.map((service) => ({
        url: `${siteUrl}/service/${service.slug}`,
        lastModified: service.updatedAt || service.createdAt || now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...posts.map((post) => ({
        url: `${siteUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt || post.publishedAt || now,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return basePages;
  }
}
