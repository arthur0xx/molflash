import type { Metadata } from "next";
import { BottomNav, Header } from "@/components/header";
import { CatalogBrowser } from "@/components/catalog-browser";
import { getStorefrontSnapshot } from "@/lib/repository";
import { safeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "تفعيل أدوات صيانة الهواتف وخدمات GSM الرقمية",
  description: "استكشف خدمات ChriGsm الرقمية لتفعيل واشتراكات أدوات صيانة الهواتف وبرامج المخططات، ثم تابع طلبك من حسابك.",
  alternates: { canonical: "/catalog" },
  openGraph: { title: "تفعيل أدوات صيانة الهواتف وخدمات GSM | ChriGsm", description: "استكشف خدمات تفعيل واشتراكات أدوات صيانة الهواتف الرقمية المتاحة في ChriGsm.", url: "/catalog" },
};

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const snapshot = await getStorefrontSnapshot();
  const currentCategory = snapshot.categories.find((item) => item.id === category);
  const services = snapshot.services.filter((service) => service.isActive);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "كتالوج تفعيل أدوات صيانة الهواتف وخدمات ChriGsm",
    url: `${siteUrl}/catalog`,
    description: "كتالوج خدمات تفعيل واشتراكات أدوات صيانة الهواتف وGSM الرقمية المتاحة في ChriGsm.",
    numberOfItems: services.length,
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} /><Header /><main className="store-shell catalog-shell">
    <section className="page-heading catalog-heading"><div><p className="eyebrow">الكتالوج الرقمي</p><h1>{currentCategory ? currentCategory.name : "كل الخدمات"}</h1><p>اختر الخدمة، أرسل الحقول المطلوبة، وتابع حالة المعالجة من حسابك.</p></div><span className="catalog-count">{services.length} خدمات</span></section>
    <CatalogBrowser services={services} categories={snapshot.categories} initialCategory={category} />
  </main><BottomNav /></>;
}
