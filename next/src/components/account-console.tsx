"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { BellRing, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LogOut, MessageCircle, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { formatMAD, statusLabels, type CustomerProfile, type OrderNotification, type OrderStatus, type SupportTicket } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { type BrowserDemoOrder } from "@/lib/demo-browser";
import { signOutDemo } from "@/lib/demo-auth";
import { MediaImageControl } from "@/components/media-image-control";

const orderTone = (status: BrowserDemoOrder["status"]) => ({ new: "blue", processing: "amber", waiting: "violet", completed: "green", rejected: "red" }[status]);
const fieldLabels: Record<string, string> = { email: "البريد الإلكتروني", imei: "IMEI", model: "موديل الجهاز", serial: "Serial Number", username: "اسم المستخدم", plan: "الباقة", duration: "مدة الكراء", game: "اللعبة", playerId: "Player ID" };
type CustomerAccount = CustomerProfile & { id: string; walletMad: number };
type AccountState = "loading" | "signed-out" | "ready" | "error";
type MediaStatus = { configured: boolean; cloudName?: string };

function asString(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function asNumber(value: unknown, fallback = 0) { return typeof value === "number" ? value : fallback; }
function toStatus(value: unknown): OrderStatus { return ["new", "processing", "waiting", "completed", "rejected"].includes(String(value)) ? value as OrderStatus : "new"; }
function toOrder(id: string, raw: Record<string, unknown>, customer: CustomerAccount, serviceTitle: string): BrowserDemoOrder {
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
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<BrowserDemoOrder[]>([]);
  const [profileDraft, setProfileDraft] = useState<CustomerProfile>({ fullName: "", phone: "", email: "" });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileMediaStatus, setProfileMediaStatus] = useState<MediaStatus | null>(null);
  const [ticketSaved, setTicketSaved] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);

  useEffect(() => {
    if (!firebase) { setAccountState("error"); setError("إعداد Firebase غير متاح."); return; }
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setAccountState("signed-out"); setCustomer(null); setOrders([]); return; }
      setAccountState("loading");
      try {
        const customerSnapshot = await getDoc(doc(firebase.db, "customers", user.uid));
        if (!customerSnapshot.exists()) throw new Error("لم يُعثر على ملف العميل لهذا الحساب.");
        const rawCustomer = customerSnapshot.data() as Record<string, unknown>;
        const profile: CustomerAccount = { id: user.uid, fullName: asString(rawCustomer.fullName, user.displayName || "عميل ChriGsm"), phone: asString(rawCustomer.phone, user.phoneNumber || ""), email: asString(rawCustomer.email, user.email || ""), avatarUrl: asString(rawCustomer.avatarUrl) || undefined, avatarPublicId: asString(rawCustomer.avatarPublicId) || undefined, walletMad: asNumber(rawCustomer.walletMad) };
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
        setCustomer(profile); setProfileDraft(profile); setOrders(loadedOrders); setTickets(supportResult.tickets || []); setAccountState("ready"); setError("");
      } catch (reason) { setAccountState("error"); setError(reason instanceof Error ? reason.message : "تعذر تحميل بيانات الحساب."); }
    });
  }, [firebase]);

  useEffect(() => {
    if (!firebase) { setProfileMediaStatus({ configured: false }); return; }
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) { setProfileMediaStatus(null); return; }
      try {
        const response = await fetch("/api/account/media/signature", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const result = await response.json().catch(() => ({})) as MediaStatus;
        setProfileMediaStatus(response.ok ? result : { configured: false });
      } catch { setProfileMediaStatus({ configured: false }); }
    });
  }, [firebase]);

  const deliveryNotifications = orders.filter((order) => order.status === "completed" && order.notification);
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = firebase?.auth.currentUser;
    if (!user) { setProfileError("يتطلب حفظ الإعدادات تسجيل الدخول عبر Firebase."); return; }
    try {
      setProfileSaving(true); setProfileError(""); setProfileSaved(false);
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ fullName: profileDraft.fullName, phone: profileDraft.phone }),
      });
      const result = await response.json().catch(() => ({})) as { profile?: CustomerProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error || "تعذر حفظ إعدادات الحساب.");
      setCustomer((previous) => previous ? { ...previous, ...result.profile } : previous);
      setProfileDraft(result.profile);
      setProfileSaved(true);
    } catch (reason) { setProfileError(reason instanceof Error ? reason.message : "تعذر حفظ إعدادات الحساب."); }
    finally { setProfileSaving(false); }
  }
  async function saveProfileAvatar(avatarUrl: string | null, avatarPublicId: string | null) {
    const user = firebase?.auth.currentUser;
    if (!user) throw new Error("يتطلب تغيير الصورة تسجيل الدخول عبر Firebase.");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ avatarUrl, avatarPublicId }),
    });
    const result = await response.json().catch(() => ({})) as { profile?: CustomerProfile; error?: string };
    if (!response.ok || !result.profile) throw new Error(result.error || "تعذر حفظ صورة الحساب.");
    setCustomer((previous) => previous ? { ...previous, ...result.profile } : previous);
    setProfileDraft((previous) => ({ ...previous, ...result.profile }));
  }

  async function uploadFileWithTimeout(input: RequestInfo | URL, init: RequestInit, label: string) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    catch (error) {
      if (controller.signal.aborted) throw new Error(`انتهت مهلة ${label}. تحقق من الاتصال ثم أعد المحاولة.`);
      throw error;
    } finally { window.clearTimeout(timeout); }
  }

  async function uploadProfileImage(file: File) {
    if (!profileMediaStatus?.configured) { setProfileError("رفع الصور غير متاح لأن تهيئة الخادم غير مكتملة."); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setProfileError("اختر صورة PNG أو JPEG أو WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { setProfileError("حجم الصورة يتجاوز الحد المسموح 10 ميغابايت."); return; }
    const user = firebase?.auth.currentUser;
    if (!user) { setProfileError("يتطلب تغيير الصورة تسجيل الدخول عبر Firebase."); return; }

    try {
      setProfileImageUploading(true); setProfileError(""); setProfileSaved(false);
      const signatureResponse = await fetch("/api/account/media/signature", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const signed = await signatureResponse.json().catch(() => ({})) as { cloudName?: string; apiKey?: string; folder?: string; publicId?: string; timestamp?: number; signature?: string; overwrite?: boolean; invalidate?: boolean; error?: string };
      if (!signatureResponse.ok || !signed.cloudName || !signed.apiKey || !signed.folder || !signed.publicId || !signed.timestamp || !signed.signature) throw new Error(signed.error || "تعذر تجهيز رفع صورة الحساب.");
      const formData = new FormData();
      formData.append("file", file); formData.append("api_key", signed.apiKey); formData.append("timestamp", String(signed.timestamp)); formData.append("signature", signed.signature); formData.append("folder", signed.folder); formData.append("public_id", signed.publicId); formData.append("overwrite", String(signed.overwrite)); formData.append("invalidate", String(signed.invalidate));
      const uploadResponse = await uploadFileWithTimeout(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: "POST", body: formData }, "رفع صورة الحساب");
      const uploaded = await uploadResponse.json().catch(() => ({})) as { secure_url?: string; public_id?: string; error?: { message?: string } };
      if (!uploadResponse.ok || !uploaded.secure_url?.startsWith("https://") || !uploaded.public_id?.startsWith("chrigsm/profiles/")) throw new Error(uploaded.error?.message || "تعذر رفع صورة الحساب.");
      await saveProfileAvatar(uploaded.secure_url, uploaded.public_id);
      setProfileSaved(true);
    } catch (reason) { setProfileError(reason instanceof Error ? reason.message : "تعذر تغيير صورة الحساب."); }
    finally { setProfileImageUploading(false); }
  }

  async function removeProfileImage() {
    try {
      setProfileImageUploading(true); setProfileError(""); setProfileSaved(false);
      await saveProfileAvatar(null, null);
      setProfileSaved(true);
    } catch (reason) { setProfileError(reason instanceof Error ? reason.message : "تعذر إزالة صورة الحساب."); }
    finally { setProfileImageUploading(false); }
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = firebase?.auth.currentUser;
    if (!user) { setSupportError("يتطلب إرسال الدعم تسجيل الدخول عبر Firebase."); return; }
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
  function signOut() { signOutDemo(); router.push("/login"); }

  if (accountState === "loading") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل</p><h1>جارٍ التحقق من الحساب…</h1><p className="panel-intro">لا تُحمّل أي بيانات طلبات قبل تأكيد هوية Firebase.</p></section></main>;
  if (accountState === "signed-out") return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">منطقة العميل محمية</p><h1>سجّل الدخول لعرض طلباتك</h1><p className="panel-intro">لن تظهر أي بيانات عميل أو طلبات قبل التحقق من هويتك.</p><Link className="primary-button" href="/login?next=/account">تسجيل الدخول</Link></section></main>;
  if (accountState === "error" || !customer) return <main className="store-shell account-shell"><section className="account-panel"><p className="eyebrow">تعذر فتح الحساب</p><h1>لا يمكن تحميل البيانات المصرح بها</h1><p className="panel-intro">{error}</p><Link className="primary-button" href="/login?next=/account">العودة لتسجيل الدخول</Link></section></main>;

  return <main className="store-shell account-shell">
    <section className="account-hero"><div className="account-identity"><MediaImageControl imageUrl={customer.avatarUrl} alt={`صورة ${customer.fullName}`} fallbackLabel={customer.fullName} kind="profile" disabled={!profileMediaStatus?.configured} uploading={profileImageUploading} onSelect={(file) => { void uploadProfileImage(file); }} onRemove={() => { void removeProfileImage(); }}/><div><p className="eyebrow">منطقة العميل</p><h1>مرحبًا، {customer.fullName}</h1><p>{customer.email}</p><span className="account-demo-note">حساب Firebase متصل</span></div></div><div className="wallet-hero"><WalletCards size={22}/><span>رصيد المحفظة</span><strong>{formatMAD(customer.walletMad)}</strong></div></section>
    {deliveryNotifications.length > 0 && <section className="order-notification"><BellRing size={21}/><div><p>آخر إشعار تسليم</p><b>{deliveryNotifications[0].notification?.title}</b><span>{deliveryNotifications[0].notification?.body}</span></div><span className="status-pill green">تم التسليم</span></section>}
    <section className="account-actions" aria-label="إجراءات الحساب"><button type="button" className={showSettings ? "active" : ""} onClick={() => { setShowSettings(!showSettings); setShowSupport(false); }}><Settings2 size={18}/><span>إعدادات الحساب</span><ChevronDown size={15}/></button><button type="button" className={showSupport ? "active" : ""} onClick={() => { setShowSupport(!showSupport); setShowSettings(false); }}><MessageCircle size={18}/><span>الدعم الفني</span><ChevronDown size={15}/></button><button type="button" className="account-logout" onClick={signOut}><LogOut size={18}/><span>تسجيل الخروج</span></button></section>
    {showSettings && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">بيانات العميل</p><h2>إعدادات الحساب</h2></div><UserRound size={22}/></div><form className="settings-form" onSubmit={submitProfile}><label><span>الاسم الكامل</span><input value={profileDraft.fullName} onChange={(event) => setProfileDraft({ ...profileDraft, fullName: event.target.value })} required disabled={profileSaving}/></label><label><span>رقم الهاتف</span><input type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} required disabled={profileSaving}/></label><label><span>البريد الإلكتروني المرتبط بالدخول</span><input type="email" value={profileDraft.email} readOnly disabled/></label><div className="settings-password"><KeyRound size={18}/><div><b>كلمة المرور</b><p>تُدار كلمة المرور عبر Firebase Authentication. إعادة التعيين عبر هذا الموقع غير متاحة حاليًا، لذلك لا يظهر أي زر إجراء غير متصل.</p></div></div><div className="form-actions"><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button>{profileSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظت إعدادات الحساب في Firebase</span>}{profileError && <span className="form-error">{profileError}</span>}</div></form></section>}
    {showSupport && <section className="account-panel"><div className="panel-heading"><div><p className="eyebrow">مساعدة الطلبات والحساب</p><h2>الدعم الفني</h2></div><MessageCircle size={22}/></div><p className="panel-intro">أنشئ رسالة دعم مرتبطة بحسابك. تُحفظ في Firebase وتظهر لفريق CMC، بينما يبقى WhatsApp Business مؤجلًا من دون إرسال أي رسالة فعلية.</p><form className="support-form" onSubmit={submitSupport}><label><span>موضوع الرسالة</span><input name="subject" placeholder="مثال: أحتاج مساعدة في طلبي" minLength={4} required disabled={supportSaving}/></label><label><span>تفاصيل المشكلة</span><textarea name="message" placeholder="اكتب رقم الطلب أو اشرح ما تحتاجه..." minLength={10} required disabled={supportSaving}/></label><button className="primary-button" type="submit" disabled={supportSaving}>{supportSaving ? "جارٍ الإرسال..." : "إرسال طلب الدعم"}</button>{ticketSaved && <span className="saved-inline"><CheckCircle2 size={16}/> حُفظ طلب الدعم في Firebase</span>}{supportError && <span className="form-error">{supportError}</span>}</form>{tickets.length > 0 && <div className="ticket-list"><h3>رسائلي للدعم</h3>{tickets.map((ticket) => <article key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p>{ticket.reply && <div className="ticket-reply"><b>رد CMC</b><p>{ticket.reply.message}</p></div>}</div><span>{ticket.status === "open" ? "مفتوح" : "تم الرد"}</span></article>)}</div>}</section>}
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">متابعة مباشرة</p><h2>طلباتي</h2></div><span className="muted-text">{orders.length} طلبات</span></div><div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</div></section>
    <section className="security-note"><ShieldCheck size={21}/><div><h3>بياناتك معزولة عن باقي العملاء</h3><p>تُحمّل منطقة الحساب بعد تحقق Firebase فقط، وتسمح قواعد Firestore لكل عميل بقراءة طلباته ووثيقة حسابه وحدهما.</p></div></section>
  </main>;
}

function OrderRow({ order }: { order: BrowserDemoOrder }) {
  return <article className="order-row detailed-order"><div><p className="eyebrow">{order.id}</p><h3>{order.serviceTitle}</h3><p>آخر تحديث: {order.updatedAt.slice(0, 10)} · {order.status === "processing" ? "قيد المعالجة: لا يمكن تعديل بيانات الطلب" : "البيانات محفوظة مع الطلب"}</p></div><div className="order-value"><span className={`status-pill ${orderTone(order.status)}`}>{statusLabels[order.status]}</span><strong>{formatMAD(order.totalMad)}</strong></div><details className="order-details"><summary><ClipboardList size={15}/> تفاصيل الطلب وسجل المعالجة</summary><div className="order-detail-grid"><section><b>بيانات العميل</b><p>{order.customerName} · {order.customerPhone}</p><p>{order.customerEmail}</p></section><section><b>البيانات المرسلة</b>{Object.entries(order.answers).length ? Object.entries(order.answers).map(([key, value]) => <p key={key}><span>{fieldLabels[key] || key}</span>{value}</p>) : <p>لا توجد حقول إضافية.</p>}</section></div><section className="order-timeline"><b>سجل الحالة</b>{order.statusHistory.map((event, index) => <p key={`${event.at}-${index}`}><span className={`status-pill ${orderTone(event.status)}`}>{statusLabels[event.status]}</span><span>{event.note}</span><small>{event.at.slice(0, 16).replace("T", " ")}</small></p>)}</section>{order.deliveryCode && <section className="delivery-received"><b>تم التسليم</b><code>{order.deliveryCode}</code>{order.deliveryNote && <p>{order.deliveryNote}</p>}</section>}</details></article>;
}
