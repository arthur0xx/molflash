import Link from "next/link";
import { ArrowLeft, CircleHelp, MessageCircle, Search } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { ServiceCard } from "@/components/service-card";
import { getSnapshot } from "@/lib/repository";

export default async function Home() {
  const snapshot = await getSnapshot();
  const active = snapshot.services.filter((service) => service.isActive);
  const popular = active.filter((service) => service.categoryId !== "misc").slice(0, 4);
  const extras = active.filter((service) => service.categoryId === "misc").slice(0, 3);

  return <><Header /><main className="store-shell home-shell">
    <section className="home-status" aria-label="حالة المتجر">
      <div><p className="eyebrow">ChriGsm</p><h1>الخدمات الرقمية</h1></div>
      <span className="live-pill"><span /> وضع تجريبي</span>
    </section>

    <Link href="/catalog" className="search-box home-search"><Search size={20} /><span>ابحث عن خدمة، أداة أو تفعيل...</span><kbd>بحث</kbd></Link>

    <section className="section-block home-section">
      <div className="section-title"><div><p className="eyebrow">دخول سريع</p><h2>التصنيفات</h2></div><Link href="/catalog">عرض الكل <ArrowLeft size={16} /></Link></div>
      <div className="category-strip" aria-label="تصنيفات الخدمات">
        {snapshot.categories.map((category) => {
          const count = active.filter((service) => service.categoryId === category.id).length;
          return <Link href={`/catalog?category=${category.id}`} className="category-chip home-category" key={category.id} style={{ "--chip-color": category.color } as React.CSSProperties}>
            <span className="category-icon">{category.icon.slice(0, 1)}</span><span className="category-label"><b>{category.name}</b><small>{count} خدمات</small></span><ArrowLeft size={15} aria-hidden="true" />
          </Link>;
        })}
      </div>
    </section>

    <section className="section-block home-section">
      <div className="section-title"><div><p className="eyebrow">الأكثر طلبًا</p><h2>خدمات GSM</h2></div><Link href="/catalog">كل الخدمات <ArrowLeft size={16} /></Link></div>
      <div className="service-grid">{popular.map((service) => <ServiceCard key={service.id} service={service} categoryName={snapshot.categories.find((category) => category.id === service.categoryId)?.name} />)}</div>
    </section>

    {extras.length > 0 && <section className="section-block home-section extras-section">
      <div className="section-title"><div><p className="eyebrow">خدمات رقمية إضافية</p><h2>متنوع</h2></div><Link href="/catalog?category=misc">استكشف المتنوع <ArrowLeft size={16} /></Link></div>
      <div className="service-grid extras-grid">{extras.map((service) => <ServiceCard key={service.id} service={service} categoryName="متنوع" />)}</div>
    </section>}

    <section className="support-card">
      <div className="support-icon"><MessageCircle size={23} /></div>
      <div><h3>تحتاج مساعدة قبل الطلب؟</h3><p>ستجد الطلبات ومراحل المعالجة في حسابك. سيُضاف ربط WhatsApp Business عند تشغيل الحساب الحقيقي.</p></div>
      <Link href="/account" className="support-link"><CircleHelp size={18} /> الدعم</Link>
    </section>
  </main><BottomNav /></>;
}
