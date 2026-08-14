import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { RequestForm } from "@/components/request-form";
import { getStorefrontSnapshot } from "@/lib/repository";
import { formatMAD } from "@/lib/types";

type ServicePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { services } = await getStorefrontSnapshot();
  const service = services.find((item) => item.slug === slug);
  if (!service) return { title: "خدمة غير متاحة", robots: { index: false, follow: false } };

  const description = `${service.description} — ${service.delivery}. اطلبها من ChriGsm وتابع المعالجة من حسابك.`;
  return {
    title: service.title,
    description,
    alternates: { canonical: `/service/${service.slug}` },
    openGraph: {
      title: `${service.title} | ChriGsm`,
      description,
      type: "website",
      url: `/service/${service.slug}`,
      images: service.imageUrl ? [{ url: service.imageUrl, alt: service.title }] : [{ url: "/brand/cg-social.png", alt: "ChriGsm — خدمات GSM الرقمية" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.title} | ChriGsm`,
      description,
      images: service.imageUrl ? [service.imageUrl] : ["/brand/cg-social.png"],
    },
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const snapshot = await getStorefrontSnapshot();
  const service = snapshot.services.find((item) => item.slug === slug);
  if (!service) notFound();
  const category = snapshot.categories.find((item) => item.id === service.categoryId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    serviceType: category?.name || "خدمات GSM الرقمية",
    provider: { "@type": "Organization", name: "ChriGsm", url: siteUrl },
    areaServed: "MA",
    offers: { "@type": "Offer", price: service.priceMad, priceCurrency: "MAD", availability: "https://schema.org/InStock", url: `${siteUrl}/service/${service.slug}` },
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><Header /><main className="store-shell detail-shell">
    <section className="detail-hero">{service.imageUrl ? <img className="detail-service-image" src={service.imageUrl} alt={service.title}/> : <div className="service-glyph large-glyph">{service.title.slice(0, 2).toUpperCase()}</div>}<div><p className="eyebrow">{category?.name}</p><h1>{service.title}</h1><p>{service.description}</p><div className="detail-tags"><span><Clock3 size={15}/> {service.delivery}</span><span><ShieldCheck size={15}/> معالجة آمنة</span></div></div><strong className="detail-price">{formatMAD(service.priceMad)}</strong></section>
    <section className="detail-layout"><div className="detail-info"><h2>كيف يعمل الطلب؟</h2><p>املأ البيانات المطلوبة بدقة، ثم تابع الطلب من حسابك حتى يكتمل التسليم.</p><ul><li><Check size={17}/> تحقق تلقائي من الحقول المطلوبة</li><li><Check size={17}/> تحديث حالة الطلب من حسابك</li><li><Check size={17}/> تسليم الكود من صفحة الطلب عند اكتمال المعالجة</li></ul></div><div className="form-panel"><div className="form-panel-head"><p className="eyebrow">طلب جديد</p><h2>بيانات الخدمة</h2></div><RequestForm service={service} /></div></section>
  </main><BottomNav /></>;
}
