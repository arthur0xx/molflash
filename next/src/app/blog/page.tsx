import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { BlogBrowser } from "@/components/blog-browser";
import { getPublicBlogSnapshot } from "@/lib/repository";
import { safeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "مدونة صيانة الهواتف وأدوات GSM للفنيين",
  description: "شروحات عربية عملية لفنيي صيانة الهواتف حول أدوات GSM وبرامج المخططات والخدمات الرقمية، مع مصادر قابلة للمراجعة.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "مدونة صيانة الهواتف وأدوات GSM | ChriGsm", description: "شروحات عربية عملية لفنيي صيانة الهواتف حول أدوات GSM وبرامج المخططات والخدمات الرقمية." },
};

export default async function BlogPage() {
  const { categories, posts } = await getPublicBlogSnapshot();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";
  const jsonLd = safeJsonLd({ "@context": "https://schema.org", "@type": "Blog", name: "مدونة ChriGsm", url: `${siteUrl}/blog`, inLanguage: "ar-MA", description: "شروحات عربية عملية لفنيي صيانة الهواتف حول أدوات GSM وبرامج المخططات والخدمات الرقمية.", blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `${siteUrl}/blog/${post.slug}`, datePublished: post.publishedAt || post.updatedAt, dateModified: post.updatedAt })) });
  return <main className="store-shell blog-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }}/><header className="page-heading blog-hero"><div><p className="eyebrow">معرفة عملية</p><h1>مدونة ChriGsm</h1><p>شروحات عربية واضحة للأدوات والخدمات الرقمية، مع روابط ومصادر يمكن مراجعتها قبل العمل.</p></div><span className="blog-hero-icon"><BookOpen size={27}/></span></header><BlogBrowser posts={posts} categories={categories}/></main>;
}
