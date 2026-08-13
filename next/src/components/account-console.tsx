"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LogOut, MessageCircle, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { formatMAD, statusLabels, type OrderNotification, type OrderStatus } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { saveBrowserDemoProfile, saveBrowserSupportTicket, type BrowserDemoOrder, type BrowserDemoProfile, type BrowserSupportTicket } from "@/lib/demo-browser";
import { signOutDemo } from "@/lib/demo-auth";

const orderTone = (status: BrowserDemoOrder["status"]) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type CustomerProfile = BrowserDemoProfile & { id: string; walletMad: number };
type AccountState = "loading" | "signed-out" | "ready" | "error";

function asString(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function asNumber(value: unknown, fallback = 0) { return typeof value === "number" ? value : fallback; }
function toStatus(value: unknown): OrderStatus { return ["new", "processing", "waiting", "completed", "rejected"].includes(String(value)) ? value as OrderStatus : "new"; }
function toOrder(id: string, raw: Record<string, unknown>, customer: CustomerProfile, serviceTitle: string): BrowserDemoOrder {
  const status = toStatus(raw.status);
  const history = Array.isArray(raw.statusHistory) ? raw.statusHistory.map((event) => {
    const item = event as Record<string, unknown>;
    return { status: toStatus(item.status), at: asString(item.at, asString(raw.updatedAt)), note: asString(item.note, `تم تغيير الحالة إلى ${statusLabels[toStatus(item.status)]}`) };
  }) : [{ status, at: asString(raw.createdAt), note: "تم إنشاء الطلب" }];
  const notificationRaw = raw.notification as Record<string, unknown> | undefined;
  const notification: OrderNotification | undefined = notificationRaw ? { title: asString(notificationRaw.title), body: asString(notificationRaw.body), createdAt: asString(notificationRaw.createdAt), read: Boolean(notificationRaw.read) } : undefined;
  return { id, customerId: customer.id, customerName: customer.fullName, customerPhone: customer.phone, customerEmail: customer.email, serviceId: asString(raw.serviceId), serviceTitle, totalMad: asNumber(raw.totalMad), status, createdAt: asString(raw.createdAt), updatedAt: asString(raw.updatedAt), answers: (raw.formData && typeof raw.formData === "object" ? raw.formData : {}) as Record<string, string>, deliveryCode: asString(raw.deliveryCode) || undefined, deliveryNote: asString(raw.deliveryNote) || undefined, statusHistory: history, notification };
}

export function AccountConsole() {
  const router = useRouter();
  const firebase = useMemo(() => firebaseServices(), []);
  const [accountState, setAccountState] = useState<AccountState>("loading");
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<BrowserDemoOrder[]>([]);
  const [profileDraft, setProfileDraft] = useState<BrowserDemoProfile>({ fullName: "", phone: "", email: "" });
  const [tickets, setTickets] = useState<BrowserSupportTicket[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [ticketSaved, setTicketSaved] = useState(false);

  useEffect(() => {
    if (!firebase) { setAccountState("error"); setError("إعداد Firebase غير متاح."); return; }
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setAccountState("signed-out"); setCustomer(null); setOrders([]); return; }
      setAccountState("loading");
      try {
        const customerSnapshot = await getDoc(doc(firebase.db, "customers", user.uid));
        if (!customerSnapshot.exists()) throw new Error("لم يُعثر على ملف العميل لهذا الحساب.");
        const rawCustomer = customerSnapshot.data() as Record<string, unknown>;
        const profile: CustomerProfile = { id: user.uid, fullName: asString(rawCustomer.fullName, user.displayName || "عميل ChriGsm"), phone: asString(rawCustomer.phone, user.phoneNumber || ""), email: asString(rawCustomer.email, user.email || ""), walletMad: asNumber(rawCustomer.walletMad) };
        const orderSnapshot = await getDocs(query(collection(firebase.db, "orders"), where("customerId", "==", user.uid)));
        const loadedOrders = await Promise.all(orderSnapshot.docs.map(async (orderDoc) => {
          const raw = orderDoc.data() as Record<string, unknown>;
          const serviceId = asString(raw.serviceId);
          const serviceSnapshot = serviceId ? await getDoc(doc(firebase.db, "services", serviceId)) : null;
          const serviceTitle = serviceSnapshot?.exists() ? asString((serviceSnapshot.data() as Record<string, unknown>).title, "خدمة رقمية") : "خدمة رقمية";
          return toOrder(orderDoc.id, raw, profile, serviceTitle);
        }));
        loadedOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCustomer(profile); setProfileDraft(profile); setOrders(loadedOrders); setAccountState("ready"); setError("");
      } catch (reason) { setAccountState("error"); setError(reason instanceof Error ? reason.message : "تعذر تحميل بيانات الحساب."); }
    });
  }, [firebase]);

  const unreadNotifications = orders.filter((order) => order.status === "completed" && order.notification);
  function submitProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); saveBrowserDemoProfile(profileDraft); setProfileSaved(true); }
  function submitSupport(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); saveBrowserSupportTicket({ id: `SUP-DEMO-${String(Date.now()).slice(-6)}`, subject: String(form.get("subject") || "الدعم"), message: String(form.get("message") || ""), status: "open", createdAt: new Date().toISOString() }); setTicketSaved(true); formElement.reset(); }
  function signOut() { signOutDemo(); router.push("/login"); }

  if (accountState === "loading") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل</p><h1>جارٍ التحقق من الحساب…</h1><p className="panel-intro">لا تُحمّل أي بيانات طلبات قبل تأكيد هوية Firebase.</p></section></main>;
  if (accountState === "signed-out") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل محمية</p><h1>سجّل الدخول لعرض طلباتك</h1><p className="panel-intro">لن تظهر أي بيانات عميل أو طلبات قبل التحقق من هويتك.</p><Link className="primary-button" href="/login?next=/account">تسجيل الدخول</Link></section></main>;
  if (accountState === "error" || !customer) return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">تعذر فتح الحساب</p><h1>لا يمكن تحميل البيانات المصرح بها</h1><p className="panel-intro">{error}</p><Link className="primary-button" href="/login?next=/account">العودة لتسجيل الدخول</Link></section></main>;

  return <main className="store-shell account-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {customer.fullName}</h1><p>{customer.email}</p><span className="account-demo-note">حساب Firebase متصل</span></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>
    {unreadNotifications.length > 0 && <section className="order-notification"><BellRing size={21}/><div><p>إشعار الطلب</p><b>{unreadNotifications[0].notification?.title}</b><span>{unreadNotifications[0].notification?.body}</span></div><span className="status-pill green">تم التسليم</span></section>}
    <section className="account-actions" aria-label="إجراءات الحساب"><button type="button" className={showSettings ? "active" : ""} onClick={() => { setShowSettings(!showSettings); setShowSupport(false); }}><Settings2 size={18}/><span>إعدادات الحساب</span><ChevronDown size={15}/></button><button type="button" className={showSupport ? "active" : ""} onClick={() => { setShowSupport(!showSupport); setShowSettings(false); }}><MessageCircle size={18}/><span>الدعم الفني</span><ChevronDown size={15}/></button><button type="button" className="account-logout" onClick={signOut}><LogOut size={18}/><span>تسجيل الخروج</span></button></section>
    {showSettings && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">بيانات العميل</p><h2>إعدادات الحساب</h2></div><UserRound size={22}/></div><form className="settings-form" onSubmit={submitProfile}><label><span>الاسم الكامل</span><input value={profileDraft.fullName} onChange={(event) => setProfileDraft({ ...profileDraft, fullName: event.target.value })} required/></label><label><span>رقم الهاتف</span><input type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} required/></label><label><span>البريد الإلكتروني</span><input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} required/></label><div className="settings-password"><KeyRound size={18}/><div><b>كلمة المرور</b><p>تسجيل الدخول يعمل عبر Firebase Authentication. ستُضاف إعادة تعيين كلمة المرور عبر البريد في مرحلة الحسابات الكاملة.</p></div><button type="button" className="outline-button" disabled>إرسال رابط التغيير</button></div><div className="form-actions"><button className="primary-button" type="submit">حفظ التغييرات</button>{profileSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظت محليًا</span>}</div></form></section>}
    {showSupport && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">مساعدة الطلبات والحساب</p><h2>الدعم الفني</h2></div><MessageCircle size={22}/></div><p className="panel-intro">أنشئ رسالة دعم مرتبطة بحسابك. ستظهر لفريق CMC عند ربط قاعدة البيانات، وسيُضاف WhatsApp Business دون إرسال رسائل حقيقية الآن.</p><form className="support-form" onSubmit={submitSupport}><label><span>موضوع الرسالة</span><input name="subject" placeholder="مثال: أحتاج مساعدة في طلبي" required/></label><label><span>تفاصيل المشكلة</span><textarea name="message" placeholder="اكتب رقم الطلب أو اشرح ما تحتاجه..." required/></label><button className="primary-button" type="submit">إرسال طلب الدعم التجريبي</button>{ticketSaved && <span className="saved-inline"><CheckCircle2 size={16}/> أضيف طلب الدعم إلى سجل هذا المتصفح</span>}</form>{tickets.length > 0 && <div className="ticket-list"><h3>رسائل الدعم التجريبية</h3>{tickets.map((ticket) => <article key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p></div><span>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span></article>)}</div>}</section>}
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات</span></div><div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</div></section>
    <section className="security-note"><ShieldCheck size={21}/><div><h3>بياناتك معزولة عن باقي العملاء</h3><p>تُحمّل منطقة الحساب بعد تحقق Firebase فقط، وتسمح قواعد Firestore لكل عميل بقراءة طلباته ووثيقة حسابه وحدهما.</p></div></section>
  </main>;
}

function OrderRow({ order }: { order: BrowserDemoOrder }) {
  return <article className="order-row detailed-order"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>آخر تحديث: {order.updatedAt.slice(0, 10)} · {order.status === "processing" ? "قيد المعالجة: لا يمكن تعديل بيانات الطلب" : "البيانات محفوظة مع الطلب"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div><details className="order-details"><summary><ClipboardList size={15}/> تفاصيل الطلب وسجل المعالجة</summary><div className="order-detail-grid"><section><b>بيانات العميل</b><p>{order.customerName} · {order.customerPhone}</p><p>{order.customerEmail}</p></section><section><b>البيانات المرسلة</b>{Object.entries(order.answers).length ? Object.entries(order.answers).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>) : <p>لا توجد حقول إضافية.</p>}</section></div><section className="order-timeline"><b>سجل الحالة</b>{order.statusHistory.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span><span>{event.note}</span><small>{event.at.slice(0, 16).replace("T", " ")}</small></p>)}</section>{order.deliveryCode && <section className="delivery-received"><b>تم التسليم</b><code>{order.deliveryCode}</code>{order.deliveryNote && <p>{order.deliveryNote}</p>}</section>}</details></article>;
}
