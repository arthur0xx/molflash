import { BottomNav, Header } from "@/components/header";
import { CatalogBrowser } from "@/components/catalog-browser";
import { getSnapshot } from "@/lib/repository";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const snapshot = await getSnapshot();
  const currentCategory = snapshot.categories.find((item) => item.id === category);
  const services = snapshot.services.filter((service) => service.isActive);
  return <><Header /><main className="store-shell catalog-shell">
    <section className="page-heading catalog-heading"><div><p className="eyebrow">الكتالوج الرقمي</p><h1>{currentCategory ? currentCategory.name : "كل الخدمات"}</h1><p>اختر الخدمة، أرسل الحقول المطلوبة، وتابع حالة المعالجة من حسابك.</p></div><span className="catalog-count">{services.length} خدمات</span></section>
    <CatalogBrowser services={services} categories={snapshot.categories} initialCategory={category} />
  </main><BottomNav /></>;
}
