"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Service } from "@/lib/types";
import { formatMAD } from "@/lib/types";
import { getAuthSession, type AuthSession } from "@/lib/auth";
import { addCartItem, getCartItems, removeCartItem, type BrowserCartItem } from "@/lib/cart";

export function CartConsole({ services }: { services: Service[] }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);
  const [items, setItems] = useState<BrowserCartItem[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refreshSession = () => setSession(getAuthSession());
    const refreshCart = () => setItems(getCartItems());
    refreshSession(); refreshCart();
    window.addEventListener("chrigsm:auth-session", refreshSession);
    window.addEventListener("chrigsm:cart-changed", refreshCart);
    return () => { window.removeEventListener("chrigsm:auth-session", refreshSession); window.removeEventListener("chrigsm:cart-changed", refreshCart); };
  }, []);

  const selectedServices = useMemo(() => items.map((item) => services.find((service) => service.id === item.id)).filter((service): service is Service => Boolean(service)), [items, services]);
  const total = useMemo(() => selectedServices.reduce((sum, service) => sum + service.priceMad, 0), [selectedServices]);
  const suggestions = services.filter((service) => !selectedServices.some((item) => item.id === service.id)).slice(0, 4);

  if (session === undefined) return <main className="cart-page"><section className="cart-loading" aria-live="polite" aria-busy="true"><LoaderCircle size={23} aria-hidden="true"/><div><b>جارٍ فتح خدماتك المختارة</b><p>نستعيد قائمتك بأمان.</p></div></section></main>;
  if (!session) return <main className="cart-page"><section className="cart-access"><span className="access-icon"><LockKeyhole size={28}/></span><p className="eyebrow">الخدمات المختارة</p><h1>سجّل الدخول للمتابعة</h1><p>يحفظ الحساب خدماتك المختارة ويجعل كل طلب وتحديثه ظاهرًا لك في مكان واحد.</p><ul className="cart-access-steps"><li><CheckCircle2 size={16}/> افتح حسابًا أو ادخل ببريدك أو Google.</li><li><CheckCircle2 size={16}/> أرسل بيانات كل خدمة من نموذجها الآمن.</li><li><CheckCircle2 size={16}/> تابع المعالجة والتسليم من منطقة العميل.</li></ul><Link className="primary-button" href="/login?next=/cart">تسجيل الدخول <ArrowLeft size={16}/></Link><Link className="filter-button" href="/catalog">العودة إلى الخدمات</Link></section></main>;

  function add(service: Service) { addCartItem(service); setNotice(`أضيفت «${service.title}» إلى خدماتك المختارة.`); }
  function remove(id: string) { removeCartItem(id); setNotice("أُزيلت الخدمة من خدماتك المختارة."); }

  return <main className="cart-page"><section className="cart-shell"><header className="cart-heading"><div><p className="eyebrow">الخدمات المختارة</p><h1>خدماتي المختارة</h1><p>راجِع الخدمات التي تهمك ثم افتح نموذج الخدمة لإرسال طلبك.</p></div><span className="cart-summary-icon"><ShoppingBag size={25}/><b>{selectedServices.length}</b></span></header>{notice && <div className="cart-notice" role="status"><CheckCircle2 size={17} aria-hidden="true"/><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="إغلاق رسالة السلة"><X size={15} aria-hidden="true"/></button></div>}
    {selectedServices.length ? <><div className="cart-lines">{selectedServices.map((service) => <article key={service.id}><span className="service-glyph">{service.title.slice(0, 2)}</span><div><h2>{service.title}</h2><p>السعر الحالي من الكتالوج</p></div><strong>{formatMAD(service.priceMad)}</strong><Link className="filter-button" href={`/service/${service.slug}`}>إرسال طلب <ArrowLeft size={14}/></Link><button className="danger-button icon-only" onClick={() => remove(service.id)} aria-label={`إزالة ${service.title}`}><Trash2 size={16}/></button></article>)}</div><footer className="cart-total"><div><span>الإجمالي</span><strong>{formatMAD(total)}</strong></div><Link className="primary-button" href="/catalog">إضافة خدمات أخرى <ArrowLeft size={16}/></Link></footer></> : <div className="empty-state"><ShoppingBag size={28}/><h2>لا توجد خدمات مختارة</h2><p>أضف خدمة من الاقتراحات أدناه لتعود إليها بسهولة.</p></div>}
    <section className="cart-suggestions"><div className="section-title"><div><p className="eyebrow">اقتراحات</p><h2>خدمات يمكنك إضافتها</h2></div><Link href="/catalog" className="filter-button">كل الخدمات <ArrowLeft size={14}/></Link></div><div className="cart-suggestion-grid">{suggestions.map((service) => <article key={service.id}><span className="service-glyph">{service.title.slice(0, 2)}</span><h3>{service.title}</h3><strong>{formatMAD(service.priceMad)}</strong><button className="filter-button" onClick={() => add(service)}><Plus size={15}/> إضافة للقائمة</button></article>)}</div></section>
  </section></main>;
}
