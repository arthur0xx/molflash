"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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

  const total = useMemo(() => items.reduce((sum, item) => sum + item.priceMad, 0), [items]);
  const suggestions = services.filter((service) => !items.some((item) => item.id === service.id)).slice(0, 4);

  if (session === undefined) return <main className="cart-page"><p className="muted-text">جارٍ التحقق من الجلسة...</p></main>;
  if (!session) return <main className="cart-page"><section className="cart-access"><span className="access-icon"><LockKeyhole size={28}/></span><p className="eyebrow">السلة محفوظة للحساب</p><h1>سجّل الدخول أولًا</h1><p>بعد الدخول يمكنك اختيار المنتجات من السلة ومتابعة طلباتك من الحساب نفسه.</p><Link className="primary-button" href="/login?next=/cart">تسجيل الدخول <ArrowLeft size={16}/></Link></section></main>;

  function add(service: Service) { addBrowserCartItem(service); setNotice(`أضيفت «${service.title}» إلى السلة التجريبية.`); }
  function remove(id: string) { removeBrowserCartItem(id); setNotice("أُزيل المنتج من السلة."); }

  return <main className="cart-page"><section className="cart-shell"><header className="cart-heading"><div><p className="eyebrow">سلة {session.role === "admin" ? "المدير" : "العميل"}</p><h1>منتجاتي المختارة</h1><p>اختر خدماتك، ثم ستنتقل عملية الطلب الفعلية إلى Firebase عند تفعيل البيانات الحقيقية.</p></div><span className="cart-summary-icon"><ShoppingBag size={25}/><b>{items.length}</b></span></header>{notice && <p className="admin-notice">{notice}</p>}
    {items.length ? <><div className="cart-lines">{items.map((item) => <article key={item.id}><span className="service-glyph">{item.title.slice(0, 2)}</span><div><h2>{item.title}</h2><p>خدمة رقمية · جاهزة لمراجعة الحقول المطلوبة</p></div><strong>{formatMAD(item.priceMad)}</strong><button className="danger-button icon-only" onClick={() => remove(item.id)} aria-label={`إزالة ${item.title}`}><Trash2 size={16}/></button></article>)}</div><footer className="cart-total"><div><span>الإجمالي التجريبي</span><strong>{formatMAD(total)}</strong></div><button className="primary-button" onClick={() => setNotice("السلة محفوظة. سيُفعّل تأكيد الطلب والدفع بعد ربط Firebase.")}>متابعة الطلب <ArrowLeft size={16}/></button></footer></> : <div className="empty-state"><ShoppingBag size={28}/><h2>السلة فارغة</h2><p>أضف خدمة من الاقتراحات أدناه لتظهر هنا.</p></div>}
    <section className="cart-suggestions"><div className="section-title"><div><p className="eyebrow">اقتراحات</p><h2>خدمات يمكنك إضافتها</h2></div><Link href="/catalog" className="filter-button">كل الخدمات <ArrowLeft size={14}/></Link></div><div className="cart-suggestion-grid">{suggestions.map((service) => <article key={service.id}><span className="service-glyph">{service.title.slice(0, 2)}</span><h3>{service.title}</h3><strong>{formatMAD(service.priceMad)}</strong><button className="filter-button" onClick={() => add(service)}><Plus size={15}/> إضافة للسلة</button></article>)}</div></section>
  </section></main>;
}
