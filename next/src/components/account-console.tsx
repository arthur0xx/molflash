"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, KeyRound, MessageCircle, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import type { DemoSnapshot } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { getBrowserDemoOrders, getBrowserDemoProfile, getBrowserSupportTickets, saveBrowserDemoProfile, saveBrowserSupportTicket, type BrowserDemoOrder, type BrowserDemoProfile, type BrowserSupportTicket } from "@/lib/demo-browser";

const orderTone = (status: BrowserDemoOrder["status"]) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);

export function AccountConsole({ initial }: { initial: DemoSnapshot }) {
  const customer = initial.customers[0];
  const initialProfile: BrowserDemoProfile = { fullName: customer.fullName, phone: customer.phone, email: customer.email };
  const baseOrders = initial.orders.filter((order) => order.customerId === customer.id).map((order) => ({ id: order.id, serviceId: order.serviceId, serviceTitle: initial.services.find((service) => service.id === order.serviceId)?.title || "خدمة", totalMad: order.totalMad, status: order.status, createdAt: order.updatedAt, answers: {} }));
  const [browserOrders, setBrowserOrders] = useState<BrowserDemoOrder[]>([]);
  const [profile, setProfile] = useState<BrowserDemoProfile>(initialProfile);
  const [profileDraft, setProfileDraft] = useState<BrowserDemoProfile>(initialProfile);
  const [tickets, setTickets] = useState<BrowserSupportTicket[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [ticketSaved, setTicketSaved] = useState(false);

  useEffect(() => {
    const refresh = () => { setBrowserOrders(getBrowserDemoOrders()); setTickets(getBrowserSupportTickets()); const stored = getBrowserDemoProfile(); if (stored) { setProfile(stored); setProfileDraft(stored); } };
    refresh(); window.addEventListener("chrigsm:demo-order", refresh); window.addEventListener("chrigsm:demo-profile", refresh); window.addEventListener("chrigsm:demo-support", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("chrigsm:demo-order", refresh); window.removeEventListener("chrigsm:demo-profile", refresh); window.removeEventListener("chrigsm:demo-support", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  const orders = useMemo(() => [...browserOrders, ...baseOrders], [browserOrders, baseOrders]);
  function submitProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); saveBrowserDemoProfile(profileDraft); setProfile(profileDraft); setProfileSaved(true); }
  function submitSupport(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); saveBrowserSupportTicket({ id: `SUP-DEMO-${String(Date.now()).slice(-6)}`, subject: String(form.get("subject") || "الدعم"), message: String(form.get("message") || ""), status: "open", createdAt: new Date().toISOString() }); setTicketSaved(true); event.currentTarget.reset(); }

  return <main className="store-shell account-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {profile.fullName}</h1><p>{profile.email}</p><span className="account-demo-note">ملف تجريبي محلي</span></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>

    <section className="account-actions" aria-label="إجراءات الحساب">
      <button type="button" className={showSettings ? "active" : ""} onClick={() => { setShowSettings(!showSettings); setShowSupport(false); }}><Settings2 size={18}/><span>إعدادات الحساب</span><ChevronDown size={15}/></button>
      <button type="button" className={showSupport ? "active" : ""} onClick={() => { setShowSupport(!showSupport); setShowSettings(false); }}><MessageCircle size={18}/><span>الدعم الفني</span><ChevronDown size={15}/></button>
    </section>

    {showSettings && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">بيانات العميل</p><h2>إعدادات الحساب</h2></div><UserRound size={22}/></div><form className="settings-form" onSubmit={submitProfile}><label><span>الاسم الكامل</span><input value={profileDraft.fullName} onChange={(event) => setProfileDraft({ ...profileDraft, fullName: event.target.value })} required/></label><label><span>رقم الهاتف</span><input type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} required/></label><label><span>البريد الإلكتروني</span><input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} required/></label><div className="settings-password"><KeyRound size={18}/><div><b>كلمة المرور</b><p>ستصبح عملية تغيير كلمة المرور عبر البريد الإلكتروني متاحة عند تشغيل Firebase Authentication.</p></div><button type="button" className="outline-button" disabled>إرسال رابط التغيير</button></div><div className="form-actions"><button className="primary-button" type="submit">حفظ التغييرات التجريبية</button>{profileSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظت على هذا المتصفح</span>}</div></form></section>}

    {showSupport && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">مساعدة الطلبات والحساب</p><h2>الدعم الفني</h2></div><MessageCircle size={22}/></div><p className="panel-intro">أنشئ رسالة دعم مرتبطة بحسابك. ستظهر لفريق CMC عند ربط قاعدة البيانات، وسيُضاف WhatsApp Business دون إرسال رسائل حقيقية الآن.</p><form className="support-form" onSubmit={submitSupport}><label><span>موضوع الرسالة</span><input name="subject" placeholder="مثال: أحتاج مساعدة في طلبي" required/></label><label><span>تفاصيل المشكلة</span><textarea name="message" placeholder="اكتب رقم الطلب أو اشرح ما تحتاجه..." required/></label><button className="primary-button" type="submit">إرسال طلب الدعم التجريبي</button>{ticketSaved && <span className="saved-inline"><CheckCircle2 size={16}/> أضيف طلب الدعم إلى سجل هذا المتصفح</span>}</form>{tickets.length > 0 && <div className="ticket-list"><h3>رسائل الدعم التجريبية</h3>{tickets.map((ticket) => <article key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p></div><span>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span></article>)}</div>}</section>}

    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات تجريبية</span></div><div className="order-list">{orders.map((order) => <article key={order.id} className="order-row"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>{order.createdAt.slice(0, 10)}{browserOrders.some((item) => item.id === order.id) && " · محفوظ على هذا المتصفح"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div></article>)}</div></section>

    <section className="security-note"><ShieldCheck size={21}/><div><h3>ما الذي سيصبح حقيقيًا بعد الربط؟</h3><p>سيُحفظ الملف، وطلبات الدعم، والطلبات في حساب المستخدم في Firebase. تغيير كلمة المرور سيتم عبر Firebase Authentication، ولن تكون بيانات العملاء متاحة لغير المدير المصرح له.</p></div></section>
  </main>;
}
