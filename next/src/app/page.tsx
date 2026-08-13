import Link from "next/link";
import { ArrowLeft, CircleHelp, MessageCircle, Search } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { ServiceCard } from "@/components/service-card";
import { getSnapshot } from "@/lib/repository";

export default async function Home() {
  const snapshot = await getSnapshot();
  const featured = snapshot.services.filter((service) => service.isActive).slice(0, 4);

  return (
    <>
      <Header />
      <main className="store-shell">
        <section className="welcome-row">
          <div><p className="eyebrow">خدمات GSM الرقمية</p><h1>كل ما تحتاجه، منظم وبسيط.</h1></div>
          <span className="live-pill"><span /> بيانات تجريبية</span>
        </section>

        <Link href="/catalog" className="search-box"><Search size={20} /><span>ابحث عن خدمة، أداة أو تفعيل...</span></Link>

        <section className="section-block">
          <div className="section-title"><div><p className="eyebrow">ابدأ من هنا</p><h2>التصنيفات</h2></div><Link href="/catalog">عرض الكل <ArrowLeft size={16} /></Link></div>
          <div className="category-strip">
            {snapshot.categories.map((category) => (
              <Link href={`/catalog?category=${category.id}`} className="category-chip" key={category.id} style={{ "--chip-color": category.color } as React.CSSProperties}>
                <span className="category-icon">{category.icon.slice(0, 1)}</span><span>{category.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-title"><div><p className="eyebrow">مختارات ChriGsm</p><h2>خدمات شائعة</h2></div><Link href="/catalog">كل الخدمات <ArrowLeft size={16} /></Link></div>
          <div className="service-grid">{featured.map((service) => <ServiceCard key={service.id} service={service} categoryName={snapshot.categories.find((category) => category.id === service.categoryId)?.name} />)}</div>
        </section>

        <section className="support-card">
          <div className="support-icon"><MessageCircle size={23} /></div>
          <div><h3>تحتاج مساعدة قبل الطلب؟</h3><p>أرسل بيانات الطلب وسيتواصل فريق الدعم معك عبر WhatsApp عند تفعيل الحساب الحقيقي.</p></div>
          <Link href="/account" className="support-link"><CircleHelp size={18} /> الدعم</Link>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
