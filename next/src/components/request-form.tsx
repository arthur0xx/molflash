"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle2, Copy, Landmark, LogIn, Send, ShieldCheck } from "lucide-react";
import { formatMAD, type DynamicField, type PaymentRecord, type Service } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { clearRequestDraft, loadRequestDraft, saveRequestDraft } from "@/lib/request-draft";

const defaultEmailField: DynamicField = { id: "email", label: "البريد الإلكتروني لاستلام التفعيل", type: "email", required: true, placeholder: "name@example.com" };
type AvailablePaymentMethod = { id: string; title: string; type: "cash_transfer" | "bank_transfer"; scope: "order" | "wallet_topup" | "both" };
type CreatedPayment = { payment: PaymentRecord; instructions: string };

function requestFields(fields: unknown): DynamicField[] {
  const supportedTypes = new Set<DynamicField["type"]>(["text", "email", "select", "textarea"]);
  const normalized = Array.isArray(fields) ? fields.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const field = candidate as Record<string, unknown>;
    if (typeof field.id !== "string" || !field.id.trim() || typeof field.label !== "string" || !field.label.trim() || typeof field.required !== "boolean" || typeof field.type !== "string" || !supportedTypes.has(field.type as DynamicField["type"])) return [];
    const options = Array.isArray(field.options) && field.options.every((option) => typeof option === "string") ? field.options : undefined;
    if (field.type === "select" && (!options || options.length === 0)) return [];
    return [{ id: field.id, label: field.label, type: field.type as DynamicField["type"], required: field.required, placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined, options }];
  }) : [];
  return normalized.length ? normalized : [defaultEmailField];
}

export function RequestForm({ service }: { service: Service }) {
  const fields = requestFields(service.fields);
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<AvailablePaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [createdPayment, setCreatedPayment] = useState<CreatedPayment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreDraft = window.setTimeout(() => {
      const draft = loadRequestDraft(service.id, service.slug);
      if (cancelled || !draft) return;
      setAnswers(draft.formData);
      setRestoredDraft(true);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(restoreDraft); };
  }, [service.id, service.slug]);

  useEffect(() => {
    const services = firebaseServices();
    if (!services) return;
    return onAuthStateChanged(services.auth, (user) => setIsAuthenticated(Boolean(user)));
  }, []);

  function updateAnswer(fieldId: string, value: string) {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    setRestoredDraft(false);
  }

  async function loadPaymentMethods() {
    const user = firebaseServices()?.auth.currentUser;
    if (!user) throw new Error("انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة.");
    setLoadingMethods(true);
    try {
      const response = await fetch("/api/payments", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const payload = await response.json().catch(() => ({})) as { methods?: AvailablePaymentMethod[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل وسائل الدفع.");
      const methods = (payload.methods || []).filter((method) => method.scope === "order" || method.scope === "both");
      setPaymentMethods(methods);
      setSelectedMethodId((current) => current && methods.some((method) => method.id === current) ? current : methods[0]?.id || "");
      return methods;
    } finally { setLoadingMethods(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const services = firebaseServices();
    if (!services) { setError("إنشاء الطلب غير متاح حاليًا. حاول مرة أخرى لاحقًا."); setSubmitting(false); return; }

    try {
      const user = services.auth.currentUser;
      if (!user) {
        saveRequestDraft({ serviceId: service.id, serviceSlug: service.slug, formData: answers, createdAt: Date.now() });
        router.push(`/login?next=${encodeURIComponent(`/service/${service.slug}`)}`);
        return;
      }
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ serviceId: service.id, formData: answers }) });
      const payload = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "تعذر إنشاء الطلب.");
      clearRequestDraft(service.id);
      setAnswers({});
      setOrderId(payload.id);
      await loadPaymentMethods();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر إنشاء الطلب."); }
    finally { setSubmitting(false); }
  }

  async function createManualPayment() {
    if (!orderId || !selectedMethodId) { setError("اختر وسيلة الدفع أولًا."); return; }
    const user = firebaseServices()?.auth.currentUser;
    if (!user) { setError("انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة."); return; }
    setCreatingPayment(true);
    setError("");
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ purpose: "order", orderId, methodId: selectedMethodId }) });
      const payload = await response.json().catch(() => ({})) as Partial<CreatedPayment> & { error?: string };
      if (!response.ok || !payload.payment || typeof payload.instructions !== "string") throw new Error(payload.error || "تعذر إنشاء مرجع التحويل.");
      setCreatedPayment({ payment: payload.payment, instructions: payload.instructions });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر إنشاء مرجع التحويل."); }
    finally { setCreatingPayment(false); }
  }

  async function copyReference(reference: string) {
    try { await navigator.clipboard.writeText(reference); } catch { setError("تعذر النسخ تلقائيًا. انسخ المرجع يدويًا."); }
  }

  if (orderId) {
    if (createdPayment) return <div className="request-payment-success" role="status"><CheckCircle2 size={22}/><div><b>أصبح طلبك بانتظار التحقق من التحويل.</b><p>حوّل المبلغ وفق التعليمات ثم اكتب المرجع التالي كما هو في سبب التحويل:</p><button type="button" className="payment-reference-copy" onClick={() => { void copyReference(createdPayment.payment.paymentReference); }} aria-label="نسخ مرجع التحويل"><code>{createdPayment.payment.paymentReference}</code><Copy size={15}/></button><pre>{createdPayment.instructions}</pre><small><ShieldCheck size={14}/> هذا المرجع لا يؤكد الدفع تلقائيًا؛ سيبدأ تنفيذ الطلب بعد المراجعة اليدوية.</small><Link href="/account">متابعة الطلب من حسابي <span aria-hidden="true">←</span></Link></div></div>;
    return <div className="request-payment-step"><div className="request-payment-head"><span className="request-step-index">2</span><div><p className="eyebrow">الخطوة الأخيرة</p><h3>اختر طريقة التحويل</h3><p>تم إنشاء الطلب <code>{orderId}</code>. اختر وسيلة مفعلة لتتلقى التعليمات والمرجع الفريد.</p></div></div>{loadingMethods ? <p className="muted-text">جارٍ تحميل وسائل الدفع المتاحة...</p> : paymentMethods.length ? <><fieldset className="payment-method-options"><legend>وسيلة الدفع</legend>{paymentMethods.map((method) => <label key={method.id} className={`payment-method-option${selectedMethodId === method.id ? " selected" : ""}`}><input type="radio" name="paymentMethod" checked={selectedMethodId === method.id} onChange={() => setSelectedMethodId(method.id)}/><Landmark size={18}/><span><b>{method.title}</b><small>{method.type === "bank_transfer" ? "تحويل بنكي" : "تحويل نقدي"}</small></span></label>)}</fieldset><button className="primary-button" type="button" onClick={() => { void createManualPayment(); }} disabled={creatingPayment || !selectedMethodId}>{creatingPayment ? "جارٍ إنشاء المرجع..." : "عرض تعليمات التحويل"}</button></> : <div className="request-payment-unavailable"><p>لا توجد وسيلة تحويل مفعلة حاليًا. احفظ رقم الطلب وتواصل مع الدعم لتأكيد طريقة الدفع.</p><Link href="/account">فتح طلباتي <span aria-hidden="true">←</span></Link></div>}<Link className="text-button" href="/account">سأكمل الدفع لاحقًا من حسابي <span aria-hidden="true">←</span></Link>{error && <p className="form-error" role="alert">{error}</p>}</div>;
  }

  return <form className="request-form" onSubmit={submit}>
    {restoredDraft && <p className="success-note request-draft-note" role="status"><CheckCircle2 size={17}/> أعدنا البيانات التي أدخلتها قبل تسجيل الدخول.</p>}
    {fields.map((field) => <label key={field.id} className="form-field"><span>{field.label}{field.required && <b> *</b>}</span>{field.type === "select" ? <select name={field.id} required={field.required} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)}><option value="" disabled>اختر من القائمة</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea name={field.id} required={field.required} placeholder={field.placeholder} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)} /> : <input name={field.id} type={field.type} required={field.required} placeholder={field.placeholder} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)} />}</label>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="request-submit-summary"><span>السعر المعتمد عند إنشاء الطلب</span><strong>{formatMAD(service.priceMad)}</strong><small>بعد إنشاء الطلب تختار التحويل اليدوي وتحصل على مرجع فريد للمراجعة.</small></div><button className="primary-button" type="submit" disabled={submitting}>{isAuthenticated ? <Send size={17}/> : <LogIn size={17}/>}{submitting ? "جارٍ إنشاء الطلب..." : isAuthenticated ? "إنشاء الطلب ومتابعة الدفع" : "سجّل الدخول لإرسال الطلب"}</button>{!isAuthenticated && <p className="muted-text request-login-note">سنحفظ ما أدخلته في هذا التبويب لمدة ساعة، ثم نعيده إليك بعد تسجيل الدخول.</p>}
  </form>;
}
