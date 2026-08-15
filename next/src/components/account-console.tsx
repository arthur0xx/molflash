"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LogOut, MessageCircle, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { formatMAD, statusLabels, type OrderNotification, type OrderStatus, type SupportTicket } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { requestPasswordReset, signOut } from "@/lib/auth";
import { MediaImageControl } from "@/components/media-image-control";
import { requestSignedMediaUpload, uploadSignedMediaImage } from "@/lib/media-upload";

const orderTone = (status: OrderStatus) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type CustomerProfile = { id: string; fullName: string; phone: string; email: string; walletMad: number; avatarUrl?: string; avatarPublicId?: string };
type AccountOrder = { id: string; customerId: string; customerName: string; customerPhone: string; customerEmail: string; serviceId: string; serviceTitle: string; totalMad: number; status: OrderStatus; createdAt: string; updatedAt: string; answers: Record<string, string>; deliveryCode?: string; deliveryNote?: string; statusHistory: Array<{ status: OrderStatus; at: string; note: string }>; notification?: OrderNotification };
type AccountState = "loading" | "signed-out" | "blocked" | "ready" | "error";

function asString(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function asNumber(value: unknown, fallback = 0) { return typeof value === "number" ? value : fallback; }
function toStatus(value: unknown): OrderStatus { return ["new", "processing", "waiting", "completed", "rejected"].includes(String(value)) ? value as OrderStatus : "new"; }
function toOrder(id: string, raw: Record<string, unknown>, customer: CustomerProfile, serviceTitle: string): AccountOrder {
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
  const [accountState, setAccountState] = useState<AccountState>(() => firebase ? "loading" : "error");
  const [error, setError] = useState(() => firebase ? "" : "تعذر فتح الحساب حاليًا.");
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [profileDraft, setProfileDraft] = useState<Omit<CustomerProfile, "id" | "walletMad">>({ fullName: "", phone: "", email: "" });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [ticketSaved, setTicketSaved] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);
  const [passwordResetState, setPasswordResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setAccountState((current) => current === "blocked" ? "blocked" : "signed-out"); setCustomer(null); setOrders([]); return; }
      if (!user.emailVerified) { router.replace("/verify-email?next=/account"); return; }
      setAccountState("loading");
      try {
        const customerSnapshot = await getDoc(doc(firebase.db, "customers", user.uid));
        if (!customerSnapshot.exists()) throw new Error("لم يُعثر على ملف العميل لهذا الحساب.");
        const rawCustomer = customerSnapshot.data() as Record<string, unknown>;
        if (rawCustomer.accountStatus === "blocked") {
          setAccountState("blocked");
          setError("تم إيقاف هذا الحساب مؤقتًا. تواصل مع الدعم إذا كنت تحتاج إلى مراجعة الحالة.");
          await firebase.auth.signOut().catch(() => undefined);
          return;
        }
        const profile: CustomerProfile = { id: user.uid, fullName: asString(rawCustomer.fullName, user.displayName || "عميل ChriGsm"), phone: asString(rawCustomer.phone, user.phoneNumber || ""), email: asString(rawCustomer.email, user.email || ""), walletMad: asNumber(rawCustomer.walletMad), avatarUrl: asString(rawCustomer.avatarUrl) || undefined, avatarPublicId: asString(rawCustomer.avatarPublicId) || undefined };
        const orderSnapshot = await getDocs(query(collection(firebase.db, "orders"), where("customerId", "==", user.uid)));
        const loadedOrders = await Promise.all(orderSnapshot.docs.map(async (orderDoc) => {
          const raw = orderDoc.data() as Record<string, unknown>;
          const serviceId = asString(raw.serviceId);
          const serviceSnapshot = serviceId ? await getDoc(doc(firebase.db, "services", serviceId)) : null;
          const serviceTitle = serviceSnapshot?.exists() ? asString((serviceSnapshot.data() as Record<string, unknown>).title, "خدمة رقمية") : "خدمة رقمية";
          return toOrder(orderDoc.id, raw, profile, serviceTitle);
        }));
        loadedOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const supportResponse = await fetch("/api/support", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const supportResult = await supportResponse.json().catch(() => ({})) as { tickets?: SupportTicket[]; error?: string };
        if (!supportResponse.ok) throw new Error(supportResult.error || "تعذر تحميل رسائل الدعم.");
        setCustomer(profile); setProfileDraft({ fullName: profile.fullName, phone: profile.phone, email: profile.email }); setOrders(loadedOrders); setTickets(supportResult.tickets || []); setAccountState("ready"); setError("");
      } catch (reason) { setAccountState("error"); setError(reason instanceof Error ? reason.message : "تعذر تحميل بيانات الحساب."); }
    });
  }, [firebase, router]);

  const unreadNotifications = orders.filter((order) => order.status === "completed" && order.notification);
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = firebase?.auth.currentUser;
    if (!user) { setProfileError("سجّل الدخول أولًا لحفظ التغييرات."); return; }
    try {
      setProfileSaving(true); setProfileError(""); setProfileSaved(false);
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ fullName: profileDraft.fullName, phone: profileDraft.phone }) });
      const result = await response.json().catch(() => ({})) as { profile?: { fullName: string; phone: string; email: string }; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || "تعذر حفظ إعدادات الحساب.");
      setCustomer((previous) => previous ? { ...previous, ...result.profile } : previous);
      setProfileDraft((previous) => ({ ...previous, ...result.profile! }));
      setProfileSaved(true);
    } catch (reason) { setProfileError(reason instanceof Error ? reason.message : "تعذر حفظ إعدادات الحساب."); }
    finally { setProfileSaving(false); }
  }

  async function uploadProfileImage(file: File) {
    const user = firebase?.auth.currentUser;
    if (!user) { setAvatarError("سجّل الدخول أولًا لتغيير صورة الحساب."); return; }
    try {
      setAvatarUploading(true); setAvatarError(""); setProfileSaved(false);
      const signed = await requestSignedMediaUpload(await user.getIdToken(), "/api/account/media/signature");
      const asset = await uploadSignedMediaImage(file, signed, "chrigsm/profiles/", "رفع صورة الحساب");
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ avatarUrl: asset.imageUrl, avatarPublicId: asset.imagePublicId }),
      });
      const result = await response.json().catch(() => ({})) as { profile?: Partial<CustomerProfile>; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || "تعذر حفظ صورة الحساب.");
      setCustomer((previous) => previous ? { ...previous, ...result.profile } : previous);
      setProfileSaved(true);
    } catch (reason) { setAvatarError(reason instanceof Error ? reason.message : "تعذر تغيير صورة الحساب."); }
    finally { setAvatarUploading(false); }
  }

  async function removeProfileImage() {
    const user = firebase?.auth.currentUser;
    if (!user) { setAvatarError("سجّل الدخول أولًا لتغيير صورة الحساب."); return; }
    try {
      setAvatarUploading(true); setAvatarError(""); setProfileSaved(false);
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ avatarUrl: null, avatarPublicId: null }),
      });
      const result = await response.json().catch(() => ({})) as { profile?: Partial<CustomerProfile>; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || "تعذر إزالة صورة الحساب.");
      setCustomer((previous) => previous ? { ...previous, ...result.profile } : previous);
      setProfileSaved(true);
    } catch (reason) { setAvatarError(reason instanceof Error ? reason.message : "تعذر إزالة صورة الحساب."); }
    finally { setAvatarUploading(false); }
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = firebase?.auth.currentUser;
    if (!user) { setSupportError("سجّل الدخول أولًا لإرسال الرسالة."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setSupportSaving(true); setSupportError(""); setTicketSaved(false);
      const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ subject: String(form.get("subject") || ""), message: String(form.get("message") || "") }) });
      const result = await response.json().catch(() => ({})) as { ticket?: SupportTicket; error?: string };
      if (!response.ok || !result.ticket) throw new Error(result.error || "تعذر إرسال طلب الدعم.");
      setTickets((previous) => [result.ticket!, ...previous]); setTicketSaved(true); formElement.reset();
    } catch (reason) { setSupportError(reason instanceof Error ? reason.message : "تعذر إرسال طلب الدعم."); }
    finally { setSupportSaving(false); }
  }

  async function sendAccountPasswordReset() {
    const email = firebase?.auth.currentUser?.email;
    if (!email) { setPasswordResetState("error"); return; }
    setPasswordResetState("sending");
    const result = await requestPasswordReset(email);
    setPasswordResetState(result === "sent" ? "sent" : "error");
  }

  function handleSignOut() { signOut(); router.push("/login"); }

  if (accountState === "loading") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل</p><h1>جارٍ فتح حسابك…</h1><p className="panel-intro">نحضّر معلوماتك وطلباتك بأمان.</p></section></main>;
  if (accountState === "signed-out") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل</p><h1>سجّل الدخول لعرض طلباتك</h1><p className="panel-intro">ستجد رصيدك وطلباتك ورسائل الدعم في مكان واحد.</p><Link className="primary-button" href="/login?next=/account">تسجيل الدخول</Link></section></main>;
  if (accountState === "blocked") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">حالة الحساب</p><h1>الحساب موقوف مؤقتًا</h1><p className="panel-intro">{error || "لا يمكن استخدام الحساب حاليًا. تواصل مع فريق الدعم لمراجعة الحالة."}</p><Link className="primary-button" href="/login">العودة لتسجيل الدخول</Link></section></main>;
  if (accountState === "error" || !customer) return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">تعذر فتح الحساب</p><h1>لا يمكن تحميل بيانات الحساب</h1><p className="panel-intro">{error}</p><Link className="primary-button" href="/login?next=/account">العودة لتسجيل الدخول</Link></section></main>;

  return <main className="store-shell account-shell">
    <section className="account-hero"><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {customer.fullName}</h1><p>{customer.email}</p></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>
    {unreadNotifications.length > 0 && <section className="order-notification"><BellRing size={21}/><div><p>إشعار الطلب</p><b>{unreadNotifications[0].notification?.title}</b><span>{unreadNotifications[0].notification?.body}</span></div><span className="status-pill green">تم التسليم</span></section>}
    <section className="account-actions" aria-label="إجراءات الحساب"><button type="button" className={showSettings ? "active" : ""} onClick={() => { setShowSettings(!showSettings); setShowSupport(false); }}><Settings2 size={18}/><span>إعدادات الحساب</span><ChevronDown size={15}/></button><button type="button" className={showSupport ? "active" : ""} onClick={() => { setShowSupport(!showSupport); setShowSettings(false); }}><MessageCircle size={18}/><span>الدعم الفني</span><ChevronDown size={15}/></button><button type="button" className="account-logout" onClick={handleSignOut}><LogOut size={18}/><span>تسجيل الخروج</span></button></section>
    {showSettings && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">بيانات العميل</p><h2>إعدادات الحساب</h2></div><UserRound size={22}/></div><MediaImageControl imageUrl={customer.avatarUrl} alt={`صورة ${customer.fullName}`} fallbackLabel={customer.fullName} kind="profile" onSelect={uploadProfileImage} onRemove={removeProfileImage} disabled={profileSaving} uploading={avatarUploading}/>{avatarError && <p className="form-error" role="alert">{avatarError}</p>}<form className="settings-form" onSubmit={submitProfile}><label><span>الاسم الكامل</span><input value={profileDraft.fullName} onChange={(event) => setProfileDraft({ ...profileDraft, fullName: event.target.value })} required disabled={profileSaving}/></label><label><span>رقم الهاتف</span><input type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} required disabled={profileSaving}/></label><label><span>البريد الإلكتروني</span><input type="email" value={profileDraft.email} readOnly disabled aria-describedby="email-managed-note"/></label><p className="muted-text" id="email-managed-note">يُستخدم هذا البريد للدخول واستعادة كلمة المرور.</p><div className="settings-password"><KeyRound size={18}/><div><b>كلمة المرور</b><p>سنرسل رابطًا آمنًا إلى بريدك لتعيين كلمة مرور جديدة.</p>{passwordResetState === "sent" && <p className="password-reset-status success" role="status">إذا كان البريد مرتبطًا بحساب ChriGsm، ستصلك رسالة لإعادة تعيين كلمة المرور.</p>}{passwordResetState === "error" && <p className="password-reset-status error" role="alert">استعادة كلمة المرور غير متاحة حاليًا. تحقق من اتصالك ثم حاول لاحقًا.</p>}</div><button type="button" className="outline-button" onClick={sendAccountPasswordReset} disabled={passwordResetState === "sending"}>{passwordResetState === "sending" ? "جارٍ الإرسال..." : "إرسال رابط التغيير"}</button></div><div className="form-actions"><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button>{profileSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظت إعدادات الحساب</span>}{profileError && <span className="form-error" role="alert">{profileError}</span>}</div></form></section>}
    {showSupport && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">مساعدة الطلبات والحساب</p><h2>الدعم الفني</h2></div><MessageCircle size={22}/></div><p className="panel-intro">أرسل رسالتك وسيتابعها فريق الدعم من داخل المتجر.</p><form className="support-form" onSubmit={submitSupport}><label><span>موضوع الرسالة</span><input name="subject" placeholder="مثال: أحتاج مساعدة في طلبي" minLength={4} required disabled={supportSaving}/></label><label><span>تفاصيل المشكلة</span><textarea name="message" placeholder="اكتب رقم الطلب أو اشرح ما تحتاجه..." minLength={10} required disabled={supportSaving}/></label><button className="primary-button" type="submit" disabled={supportSaving}>{supportSaving ? "جارٍ الإرسال..." : "إرسال طلب الدعم"}</button>{ticketSaved && <span className="saved-inline"><CheckCircle2 size={16}/> تم إرسال طلب الدعم</span>}{supportError && <span className="form-error">{supportError}</span>}</form>{tickets.length > 0 && <div className="ticket-list"><h3>رسائلي للدعم</h3>{tickets.map((ticket) => <article key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p>{ticket.reply && <div className="ticket-reply"><b>رد CMC</b><p>{ticket.reply.message}</p></div>}</div><span>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span></article>)}</div>}</section>}
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات</span></div><div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</div></section>
    <section className="security-note"><ShieldCheck size={21}/><div><h3>خصوصية حسابك مهمة</h3><p>لا يطّلع على طلباتك وبياناتك إلا أنت وفريق المتجر عند الحاجة إلى المتابعة.</p></div></section>
  </main>;
}

function OrderRow({ order }: { order: AccountOrder }) {
  return <article className="order-row detailed-order"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>آخر تحديث: {order.updatedAt.slice(0, 10)} · {order.status === "processing" ? "قيد المعالجة: لا يمكن تعديل بيانات الطلب" : "البيانات محفوظة مع الطلب"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div><details className="order-details"><summary><ClipboardList size={15}/> تفاصيل الطلب وسجل المعالجة</summary><div className="order-detail-grid"><section><b>بيانات العميل</b><p>{order.customerName} · {order.customerPhone}</p><p>{order.customerEmail}</p></section><section><b>البيانات المرسلة</b>{Object.entries(order.answers).length ? Object.entries(order.answers).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>) : <p>لا توجد حقول إضافية.</p>}</section></div><section className="order-timeline"><b>سجل الحالة</b>{order.statusHistory.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span><span>{event.note}</span><small>{event.at.slice(0, 16).replace("T", " ")}</small></p>)}</section>{order.deliveryCode && <section className="delivery-received"><b>تم التسليم</b><code>{order.deliveryCode}</code>{order.deliveryNote && <p>{order.deliveryNote}</p>}</section>}</details></article>;
}
