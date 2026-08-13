import Link from "next/link";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { BottomNav, Header } from "@/components/header";
import { ServiceCard } from "@/components/service-card";
import { getSnapshot } from "@/lib/repository";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const snapshot = await getSnapshot();
  const services = snapshot.services.filter((service) => service.isActive && (!category || service.categoryId === category));
  const currentCategory = snapshot.categories.find((item) => item.id === category);

  return (
    <><Header /><main className="store-shell">
      <section className="page-heading"><p className="eyebrow">الكتالوج الرقمي</p><h1>{currentCategory ? currentCategory.name : "كل الخدمات"}</h1><p>اختر الخدمة، أرسل الحقول المطلوبة، وتابع حالة المعالجة من حسابك.</p></section>
      <div className="catalog-toolbar"><div className="catalog-search"><Search size={18}/><span>بحث تجريبي في الخدمات</span></div><button className="filter-button"><SlidersHorizontal size={17}/> فلتر</button><button className="filter-button"><Filter size={17}/> الأحدث</button></div>
      <div className="category-filter-row"><Link href="/catalog" className={!category ? "filter-active" : ""}>الكل</Link>{snapshot.categories.map((item) => <Link key={item.id} href={`/catalog?category=${item.id}`} className={category === item.id ? "filter-active" : ""}>{item.name}</Link>)}</div>
      <div className="service-grid catalog-grid">{services.map((service) => <ServiceCard key={service.id} service={service} categoryName={snapshot.categories.find((item) => item.id === service.categoryId)?.name} />)}</div>
    </main><BottomNav /></>
  );
}
