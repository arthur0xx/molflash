import Link from "next/link";
import { ArrowLeft, CircleHelp, Layers3, MessageCircle, Search } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { ServiceCard } from "@/components/service-card";
import { getStorefrontSnapshot } from "@/lib/repository";
import { safeJsonLd } from "@/lib/seo";
import { WhatsAppSupportLink } from "@/components/whatsapp-support-link";

function serviceCountLabel(count: number) {
  return count === 1 ? "خدمة واحدة" : `${count} خدمات`;
}

export default async function Home() {
  const snapshot = await getStorefrontSnapshot();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://temporary-speedy-jade-mdelya8.vercel.app";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: "ChriGsm",
    url: siteUrl,
    logo: `${siteUrl}/brand/cg-logo.png`,
    image: `${siteUrl}/brand/cg-social.png`,
    description: "متجر مغربي لخدمات GSM الرقمية والتفعيل والأدوات.",
    inLanguage: "ar-MA",
    areaServed: "MA",
  };

  const active = snapshot.services.filter((service) => service.isActive);
  const miscCategory = snapshot.categories.find((category) => category.name.trim() === "متنوع");
  const extras = miscCategory ? active.filter((service) => service.categoryId === miscCategory.id).slice(0, 3) : [];
  const popular = active.filter((service) => service.categoryId !== miscCategory?.id).slice(0, 4);
  const featured = popular.length ? popular : active.slice(0, 4);

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} /><Header /><main className="store-shell home-shell">
    <section className="home-status" aria-label="حالة المتجر">
      <div><p className="eyebrow">ChriGsm</p><h1>الخدمات الرقمية</h1><p className="home-intro">تفعيلات وأدوات وخدمات Server بطلب واضح ومعالجة من داخل حسابك.</p></div>
      <span className="live-pill"><span /> متجر متصل</span>
    </section>

    <Link href="/catalog" className="search-box home-search" aria-label="الانتقال إلى بحث الكتالوج"><Search size={20} /><span>ابحث عن خدمة أو أداة أو تفعيل</span><kbd>استكشف</kbd></Link>

    {snapshot.categories.length > 0 && <section className="section-block home-section">
      <div className="section-title"><div><p className="eyebrow">دخول سريع</p><h2>التصنيفات</h2></div><Link href="/catalog">عرض الكل <ArrowLeft size={16} /></Link></div>
      <div className="category-strip" aria-label="تصنيفات الخدمات">
        {snapshot.categories.map((category) => {
          const count = active.filter((service) => service.categoryId === category.id).length;
          return <Link href={`/catalog?category=${category.id}`} className="category-chip home-category" key={category.id} style={{ "--chip-color": category.color } as React.CSSProperties}>
            <span className="category-icon" aria-hidden="true">{category.icon.slice(0, 1)}</span><span className="category-label"><b>{category.name}</b><small>{serviceCountLabel(count)}</small></span><ArrowLeft size={15} aria-hidden="true" />
          </Link>;
        })}
      </div>
    </section>}

    {featured.length > 0 ? <section className="section-block home-section home-catalog">
      <div className="section-title"><div><p className="eyebrow">الخدمات المتاحة الآن</p><h2>خدمات GSM</h2></div><Link href="/catalog">كل الخدمات <ArrowLeft size={16} /></Link></div>
      <div className={`service-grid ${featured.length === 1 ? "service-grid-single" : ""}`}>{featured.map((service) => <ServiceCard key={service.id} service={service} categoryName={snapshot.categories.find((category) => category.id === service.categoryId)?.name} />)}</div>
    </section> : <section className="catalog-empty-state" aria-label="الكتالوج قيد الإعداد"><span><Layers3 size={24}/></span><div><p className="eyebrow">الكتالوج</p><h2>تجهيز الخدمات الأولى</h2><p>سيظهر هنا كل ما هو متاح للطلب فور نشره من إدارة المتجر.</p></div><Link href="/catalog" className="outline-button">فتح الكتالوج <ArrowLeft size={16}/></Link></section>}

    {extras.length > 0 && <section className="section-block home-section extras-section">
      <div className="section-title"><div><p className="eyebrow">خدمات رقمية إضافية</p><h2>متنوع</h2></div><Link href={`/catalog?category=${miscCategory?.id || ""}`}>استكشف المتنوع <ArrowLeft size={16} /></Link></div>
      <div className={`service-grid extras-grid ${extras.length === 1 ? "service-grid-single" : ""}`}>{extras.map((service) => <ServiceCard key={service.id} service={service} categoryName="متنوع" />)}</div>
    </section>}

    <section className="support-card">
      <div className="support-icon"><MessageCircle size={23} /></div>
      <div><h3>تحتاج مساعدة قبل الطلب؟</h3><p>أرسل رسالتك من الحساب، وستتابع حالة الطلب والتسليم من المكان نفسه.</p></div>
      <div className="support-actions"><WhatsAppSupportLink label="واتساب" /><Link href="/account" className="support-link"><CircleHelp size={18} /> الدعم</Link></div>
    </section>
  </main><BottomNav /></>;
}
