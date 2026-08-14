"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Service } from "@/lib/types";
import { formatMAD } from "@/lib/types";
import { getDemoSession, type DemoSession } from "@/lib/demo-auth";
import { addBrowserCartItem, getBrowserCartItems, removeBrowserCartItem, type BrowserCartItem } from "@/lib/demo-cart";

export function CartConsole({ services }: { services: Service[] }) {
  const [session, setSession] = useState<DemoSession | null | undefined>(undefined);
  const [items, setItems] = useState<BrowserCartItem[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refreshSession = () => setSession(getDemoSession());
    const refreshCart = () => setItems(getBrowserCartItems());
    refreshSession(); refreshCart();
    window.addEventListener("chrigsm:demo-session", refreshSession);
    window.addEventListener("chrigsm:demo-cart", refreshCart);
    return () => { window.removeEventListener("chrigsm:demo-session", refreshSession); window.removeEventListener("chrigsm:demo-cart", refreshCart); };
  }, []);

  const selectedServices = useMemo(() => items.map((item) => services.find((service) => service.id === item.id)).filter((service): service is Service => Boolean(service)), [items, services]);
  const total = useMemo(() => selectedServices.reduce((sum, service) => sum + service.priceMad, 0), [selectedServices]);
  const suggestions = services.filter((service) => !selectedServices.some((item) => item.id === service.id)).slice(0, 4);

  if (session === undefined) return <main className="cart-page"><p className="muted-text">جارٍ التحقق من الجلسة...</p></main>;
  if (!session) return <main className="cart-page"><section className="cart-access"><span className="access-icon"><LockKeyhole size={28}/></span><p className="eyebrow">قائمة اختيار محلية</p><h1>سجّل الدخول أولًا</h1><p>بعد الدخول يمكنك الاحتفاظ بقائمة اختيار على هذا الجهاز وفتح نموذج الخدمة لإنشاء طلب حقيقي.</p><Link className="primary-button" href="/login?next=/cart">تسجيل الدخول <ArrowLeft size={16}/></Link></section></main>;

  function add(service: Service) { addBrowserCartItem(service); setNotice(`أضيفت «${service.title}» إلى قائمة الاختيار المحلية على هذا الجهاز.`); }
  function remove(id: string) { removeBrowserCartItem(id); setNotice("أُزيلت الخدمة من قائمة الاختيار المحلية."); }

  return <main className="cart-page"><section className="cart-shell"><header className="cart-heading"><div><p className="eyebrow">قائمة اختيار محلية</p><h1>خدماتي المختارة</h1><p>هذه القائمة محفوظة على جهازك فقط وليست طلبًا أو حجزًا. السعر والطلب النهائيان يتحققان خادميًا عند إرسال نموذج الخدمة.</p></div><span className="cart-summary-icon"><ShoppingBag size={25}/><b>{selectedServices.length}</b></span></header>{notice && <p className="admin-notice">{notice}</p>}
    {selectedServices.length ? <><div className="cart-lines">{selectedServices.map((service) => <article key={service.id}><span className="service-glyph">{service.title.slice(0, 2)}</span><div><h2>{service.title}</h2><p>السعر الحالي من الكتالوج · افتح النموذج لإنشاء طلب فعلي</p></div><strong>{formatMAD(service.priceMad)}</strong><Link className="filter-button" href={`/service/${service.slug}`}>إنشاء طلب <ArrowLeft size={14}/></Link><button className="danger-button icon-only" onClick={() => remove(service.id)} aria-label={`إزالة ${service.title}`}><Trash2 size={16}/></button></article>)}</div><footer className="cart-total"><div><span>إجمالي استرشادي</span><strong>{formatMAD(total)}</strong></div><Link className="primary-button" href="/catalog">استكشاف الخدمات <ArrowLeft size={16}/></Link></footer></> : <div className="empty-state"><ShoppingBag size={28}/><h2>لا توجد خدمات مختارة</h2><p>أضف خدمة من الاقتراحات أدناه إلى قائمة الاختيار على جهازك.</p></div>}
    <section className="cart-suggestions"><div className="section-title"><div><p className="eyebrow">اقتراحات</p><h2>خدمات يمكنك إضافتها</h2></div><Link href="/catalog" className="filter-button">كل الخدمات <ArrowLeft size={14}/></Link></div><div className="cart-suggestion-grid">{suggestions.map((service) => <article key={service.id}><span className="service-glyph">{service.title.slice(0, 2)}</span><h3>{service.title}</h3><strong>{formatMAD(service.priceMad)}</strong><button className="filter-button" onClick={() => add(service)}><Plus size={15}/> إضافة للقائمة</button></article>)}</div></section>
  </section></main>;
}
