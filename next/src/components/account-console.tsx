"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LogOut, MessageCircle, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import type { DemoSnapshot } from "@/lib/types";
import { formatMAD, statusLabels } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { getBrowserDemoOrders, getBrowserDemoProfile, getBrowserSupportTickets, saveBrowserDemoProfile, saveBrowserSupportTicket, type BrowserDemoOrder, type BrowserDemoProfile, type BrowserSupportTicket } from "@/lib/demo-browser";
import { getDemoSession, signOutDemo, type DemoSession } from "@/lib/demo-auth";

const orderTone = (status: BrowserDemoOrder["status"]) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };

export function AccountConsole({ initial }: { initial: DemoSnapshot }) {
  const router = useRouter();
  const firebase = firebaseServices();
  const [session, setSession] = useState<DemoSession | null>(null);
  useEffect(() => { const refresh = () => setSession(getDemoSession()); refresh(); window.addEventListener("chrigsm:demo-session", refresh); return () => window.removeEventListener("chrigsm:demo-session", refresh); }, []);
  const customer = useMemo(() => initial.customers.find((item) => item.id === session?.uid || item.email === session?.email) || initial.customers[0], [initial.customers, session]);
  const initialProfile: BrowserDemoProfile = { fullName: customer.fullName, phone: customer.phone, email: customer.email };
  const baseOrders: BrowserDemoOrder[] = initial.orders.filter((order) => order.customerId === customer.id).map((order) => ({
    id: order.id, customerId: order.customerId, customerName: customer.fullName, customerPhone: customer.phone, customerEmail: customer.email,
    serviceId: order.serviceId, serviceTitle: initial.services.find((service) => service.id === order.serviceId)?.title || "خدمة", totalMad: order.totalMad,
    status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt, answers: order.formData, deliveryCode: order.deliveryCode, deliveryNote: order.deliveryNote,
    statusHistory: order.statusHistory?.length ? order.statusHistory : [{ status: "new", at: order.createdAt, note: "تم إنشاء الطلب" }, ...(order.status !== "new" ? [{ status: order.status, at: order.updatedAt, note: `تم تغيير الحالة إلى ${statusLabels[order.status]}` }] : [])],
    notification: order.notification || (order.status === "completed" ? { title: "تم إنجاز طلبك", body: `تم تسليم ${initial.services.find((service) => service.id === order.serviceId)?.title || "الخدمة"} بنجاح.`, createdAt: order.updatedAt, read: false } : undefined),
  }));
  const [browserOrders, setBrowserOrders] = useState<BrowserDemoOrder[]>([]);
  const [profile, setProfile] = useState<BrowserDemoProfile>(initialProfile);
  const [profileDraft, setProfileDraft] = useState<BrowserDemoProfile>(initialProfile);
  const [tickets, setTickets] = useState<BrowserSupportTicket[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [ticketSaved, setTicketSaved] = useState(false);

  useEffect(() => { setProfile(initialProfile); setProfileDraft(initialProfile); }, [customer.id, initialProfile.email, initialProfile.fullName, initialProfile.phone]);

  useEffect(() => {
    if (firebase) return;
    const refresh = () => { setBrowserOrders(getBrowserDemoOrders()); setTickets(getBrowserSupportTickets()); const stored = getBrowserDemoProfile(); if (stored) { setProfile(stored); setProfileDraft(stored); } };
    refresh(); window.addEventListener("chrigsm:demo-order", refresh); window.addEventListener("chrigsm:demo-profile", refresh); window.addEventListener("chrigsm:demo-support", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("chrigsm:demo-order", refresh); window.removeEventListener("chrigsm:demo-profile", refresh); window.removeEventListener("chrigsm:demo-support", refresh); window.removeEventListener("storage", refresh); };
  }, [firebase]);

  const orders = useMemo(() => firebase ? baseOrders : [...browserOrders, ...baseOrders], [firebase, browserOrders, baseOrders]);
  const unreadNotifications = orders.filter((order) => order.status === "completed" && order.notification);
  function submitProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); saveBrowserDemoProfile(profileDraft); setProfile(profileDraft); setProfileSaved(true); }
  function submitSupport(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); saveBrowserSupportTicket({ id: `SUP-DEMO-${String(Date.now()).slice(-6)}`, subject: String(form.get("subject") || "الدعم"), message: String(form.get("message") || ""), status: "open", createdAt: new Date().toISOString() }); setTicketSaved(true); event.currentTarget.reset(); }
  function signOut() { signOutDemo(); router.push("/login"); }

  return <main className="store-shell account-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {profile.fullName}</h1><p>{profile.email}</p><span className="account-demo-note">{session ? "حساب Firebase متصل" : "جارٍ التحقق من الحساب"}</span></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>

    {unreadNotifications.length > 0 && <section className="order-notification"><BellRing size={21}/><div><p>إشعار الطلب</p><b>{unreadNotifications[0].notification?.title}</b><span>{unreadNotifications[0].notification?.body}</span></div><span className="status-pill green">تم التسليم</span></section>}

    <section className="account-actions" aria-label="إجراءات الحساب">
      <button type="button" className={showSettings ? "active" : ""} onClick={() => { setShowSettings(!showSettings); setShowSupport(false); }}><Settings2 size={18}/><span>إعدادات الحساب</span><ChevronDown size={15}/></button>
      <button type="button" className={showSupport ? "active" : ""} onClick={() => { setShowSupport(!showSupport); setShowSettings(false); }}><MessageCircle size={18}/><span>الدعم الفني</span><ChevronDown size={15}/></button>
      <button type="button" className="account-logout" onClick={signOut}><LogOut size={18}/><span>تسجيل الخروج</span></button>
    </section>

    {showSettings && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">بيانات العميل</p><h2>إعدادات الحساب</h2></div><UserRound size={22}/></div><form className="settings-form" onSubmit={submitProfile}><label><span>الاسم الكامل</span><input value={profileDraft.fullName} onChange={(event) => setProfileDraft({ ...profileDraft, fullName: event.target.value })} required/></label><label><span>رقم الهاتف</span><input type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} required/></label><label><span>البريد الإلكتروني</span><input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} required/></label><div className="settings-password"><KeyRound size={18}/><div><b>كلمة المرور</b><p>تسجيل الدخول يعمل عبر Firebase Authentication. ستُضاف إعادة تعيين كلمة المرور عبر البريد في مرحلة الحسابات الكاملة.</p></div><button type="button" className="outline-button" disabled>إرسال رابط التغيير</button></div><div className="form-actions"><button className="primary-button" type="submit">حفظ التغييرات</button>{profileSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظت محليًا</span>}</div></form></section>}

    {showSupport && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">مساعدة الطلبات والحساب</p><h2>الدعم الفني</h2></div><MessageCircle size={22}/></div><p className="panel-intro">أنشئ رسالة دعم مرتبطة بحسابك. ستظهر لفريق CMC عند ربط قاعدة البيانات، وسيُضاف WhatsApp Business دون إرسال رسائل حقيقية الآن.</p><form className="support-form" onSubmit={submitSupport}><label><span>موضوع الرسالة</span><input name="subject" placeholder="مثال: أحتاج مساعدة في طلبي" required/></label><label><span>تفاصيل المشكلة</span><textarea name="message" placeholder="اكتب رقم الطلب أو اشرح ما تحتاجه..." required/></label><button className="primary-button" type="submit">إرسال طلب الدعم التجريبي</button>{ticketSaved && <span className="saved-inline"><CheckCircle2 size={16}/> أضيف طلب الدعم إلى سجل هذا المتصفح</span>}</form>{tickets.length > 0 && <div className="ticket-list"><h3>رسائل الدعم التجريبية</h3>{tickets.map((ticket) => <article key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p></div><span>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span></article>)}</div>}</section>}

    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات</span></div><div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</div></section>
    <section className="security-note"><ShieldCheck size={21}/><div><h3>ما الذي سيصبح حقيقيًا بعد الربط؟</h3><p>سيُحفظ الملف، والطلبات، والتسليم، والإشعارات في Firebase. ستصل رسالة WhatsApp فقط بعد إعداد WhatsApp Business رسميًا، ولن تكون بيانات العملاء متاحة لغير المدير المصرح له.</p></div></section>
  </main>;
}

function OrderRow({ order }: { order: BrowserDemoOrder }) {
  return <article className="order-row detailed-order"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>آخر تحديث: {order.updatedAt.slice(0, 10)} · {order.status === "processing" ? "قيد المعالجة: لا يمكن تعديل بيانات الطلب" : "البيانات محفوظة مع الطلب"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div><details className="order-details"><summary><ClipboardList size={15}/> تفاصيل الطلب وسجل المعالجة</summary><div className="order-detail-grid"><section><b>بيانات العميل</b><p>{order.customerName} · {order.customerPhone}</p><p>{order.customerEmail}</p></section><section><b>البيانات المرسلة</b>{Object.entries(order.answers).length ? Object.entries(order.answers).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>) : <p>لا توجد حقول إضافية.</p>}</section></div><section className="order-timeline"><b>سجل الحالة</b>{order.statusHistory.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span><span>{event.note}</span><small>{event.at.slice(0, 16).replace("T", " ")}</small></p>)}</section>{order.deliveryCode && <section className="delivery-received"><b>تم التسليم</b><code>{order.deliveryCode}</code>{order.deliveryNote && <p>{order.deliveryNote}</p>}</section>}</details></article>;
}
