"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle2, LogIn, Send } from "lucide-react";
import type { DynamicField, Service } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { clearRequestDraft, loadRequestDraft, saveRequestDraft } from "@/lib/request-draft";

const defaultEmailField: DynamicField = {
  id: "email",
  label: "البريد الإلكتروني لاستلام التفعيل",
  type: "email",
  required: true,
  placeholder: "name@example.com",
};

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
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const services = firebaseServices();

    if (!services) {
      setError("إنشاء الطلب غير متاح حاليًا. حاول مرة أخرى لاحقًا.");
      setSubmitting(false);
      return;
    }

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
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إنشاء الطلب.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="request-form" onSubmit={submit}>
    {restoredDraft && <p className="success-note request-draft-note" role="status"><CheckCircle2 size={17}/> أعدنا البيانات التي أدخلتها قبل تسجيل الدخول.</p>}
    {fields.map((field) => (
      <label key={field.id} className="form-field"><span>{field.label}{field.required && <b> *</b>}</span>
        {field.type === "select"
          ? <select name={field.id} required={field.required} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)}><option value="" disabled>اختر من القائمة</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
          : field.type === "textarea"
            ? <textarea name={field.id} required={field.required} placeholder={field.placeholder} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)} />
            : <input name={field.id} type={field.type} required={field.required} placeholder={field.placeholder} value={answers[field.id] || ""} onChange={(event) => updateAnswer(field.id, event.target.value)} />}
      </label>
    ))}
    {error && <p className="form-error" role="alert">{error}</p>}
    {submitted ? <div className="success-note"><CheckCircle2 size={18}/><div><b>تم إنشاء طلبك بنجاح.</b><span>رقم الطلب: {orderId} — افتح «حسابي» لمتابعته.</span></div></div> : <><button className="primary-button" type="submit" disabled={submitting}>{isAuthenticated ? <Send size={17}/> : <LogIn size={17}/>}{submitting ? "جارٍ إنشاء الطلب..." : isAuthenticated ? "إنشاء الطلب" : "سجّل الدخول لإرسال الطلب"}</button>{!isAuthenticated && <p className="muted-text request-login-note">سنحفظ ما أدخلته في هذا التبويب لمدة ساعة، ثم نعيده إليك بعد تسجيل الدخول.</p>}</>}
  </form>;
}
