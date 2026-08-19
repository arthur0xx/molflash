import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { BlogBrowser } from "@/components/blog-browser";
import { getPublicBlogSnapshot } from "@/lib/repository";
import { safeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "مدونة ChriGsm | شروحات أدوات GSM",
  description: "شروحات عربية عملية لأدوات GSM والخدمات الرقمية وصيانة الهواتف.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "مدونة ChriGsm", description: "شروحات عربية عملية لأدوات GSM والخدمات الرقمية." },
};

export default async function BlogPage() {
  const { categories, posts } = await getPublicBlogSnapshot();
  const jsonLd = safeJsonLd({ "@context": "https://schema.org", "@type": "Blog", name: "مدونة ChriGsm", description: "شروحات عربية عملية لأدوات GSM والخدمات الرقمية.", blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `/blog/${post.slug}`, datePublished: post.publishedAt || post.updatedAt })) });
  return <main className="store-shell blog-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }}/><header className="page-heading blog-hero"><div><p className="eyebrow">معرفة عملية</p><h1>مدونة ChriGsm</h1><p>شروحات عربية واضحة للأدوات والخدمات الرقمية، مع روابط ومصادر يمكن مراجعتها قبل العمل.</p></div><span className="blog-hero-icon"><BookOpen size={27}/></span></header><BlogBrowser posts={posts} categories={categories}/></main>;
}
