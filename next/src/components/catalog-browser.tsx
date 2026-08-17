"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ServiceCard } from "@/components/service-card";
import type { Category, Service } from "@/lib/types";

type CatalogBrowserProps = { services: Service[]; categories: Category[]; initialCategory?: string };

export function CatalogBrowser({ services, categories, initialCategory }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory || "");
  const availableCategories = useMemo(() => categories.filter((item) => services.some((service) => service.categoryId === item.id)), [categories, services]);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return services.filter((service) => {
      const matchesCategory = !category || service.categoryId === category;
      const searchable = `${service.title} ${service.description} ${categories.find((item) => item.id === service.categoryId)?.name || ""}`.toLocaleLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, categories, query, services]);

  return <>
    <label className="catalog-search-input"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم خدمة أو أداة..." aria-label="البحث في الخدمات" />{query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={16} /></button>}</label>
    <div className="category-filter-row" aria-label="تصفية حسب التصنيف">
      <button type="button" className={!category ? "filter-active" : ""} onClick={() => setCategory("")}>الكل <span>{services.length}</span></button>
      {availableCategories.map((item) => <button key={item.id} type="button" className={category === item.id ? "filter-active" : ""} onClick={() => setCategory(item.id)}>{item.name} <span>{services.filter((service) => service.categoryId === item.id).length}</span></button>)}
    </div>
    <div className="catalog-result-note">{results.length ? `${results.length} خدمات متاحة` : "لا توجد نتيجة مطابقة"}</div>
    {results.length ? <div className="service-grid catalog-grid">{results.map((service) => <ServiceCard key={service.id} service={service} categoryName={categories.find((item) => item.id === service.categoryId)?.name} />)}</div> : <div className="empty-state"><Search size={24}/><h2>لم نعثر على الخدمة</h2><p>جرّب اسمًا آخر أو أزل فلتر التصنيف للعودة إلى كل الخدمات.</p><button type="button" className="outline-button" onClick={() => { setQuery(""); setCategory(""); }}>إظهار كل الخدمات</button></div>}
  </>;
}
