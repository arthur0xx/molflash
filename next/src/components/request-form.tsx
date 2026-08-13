"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import type { Service } from "@/lib/types";
import { firebaseServices } from "@/lib/firebase/client";
import { getBrowserDemoProfile, saveBrowserDemoOrder } from "@/lib/demo-browser";
import { getDemoSession } from "@/lib/demo-auth";

export function RequestForm({ service }: { service: Service }) {
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const answers = Object.fromEntries(form.entries().map(([key, value]) => [key, String(value)]));
    const services = firebaseServices();

    if (services) {
      try {
        const user = services.auth.currentUser;
        if (!user) throw new Error("سجّل الدخول أولًا لإنشاء الطلب.");
        const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ serviceId: service.id, formData: answers }) });
        const payload = await response.json() as { id?: string; error?: string };
        if (!response.ok || !payload.id) throw new Error(payload.error || "تعذر إنشاء الطلب.");
        setOrderId(payload.id); setSubmitted(true); event.currentTarget.reset();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "تعذر إنشاء الطلب.");
      } finally { setSubmitting(false); }
      return;
    }

    const id = `ORD-DEMO-${String(Date.now()).slice(-6)}`;
    const now = new Date().toISOString();
    const session = getDemoSession();
    const profile = getBrowserDemoProfile();
    const customerName = profile?.fullName || session?.fullName || "ياسين الفاسي";
    const customerPhone = profile?.phone || session?.phone || "+212 600-111222";
    const customerEmail = profile?.email || session?.email || "yassine.demo@chrigsm.test";
    saveBrowserDemoOrder({ id, customerId: "cus-yassine", customerName, customerPhone, customerEmail, serviceId: service.id, serviceTitle: service.title, totalMad: service.priceMad, status: "new", createdAt: now, updatedAt: now, answers, statusHistory: [{ status: "new", at: now, note: "أرسل العميل الطلب والبيانات المطلوبة" }] });
    setOrderId(id); setSubmitted(true); setSubmitting(false);
  }

  return <form className="request-form" onSubmit={submit}>
    {service.fields.map((field) => (
      <label key={field.id} className="form-field"><span>{field.label}{field.required && <b> *</b>}</span>
        {field.type === "select" ? <select name={field.id} required={field.required} defaultValue=""><option value="" disabled>اختر من القائمة</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea name={field.id} required={field.required} placeholder={field.placeholder} /> : <input name={field.id} type={field.type} required={field.required} placeholder={field.placeholder} />}
      </label>
    ))}
    {error && <p className="form-error" role="alert">{error}</p>}
    {submitted ? <div className="success-note"><CheckCircle2 size={18}/><div><b>تم إنشاء طلبك بنجاح.</b><span>رقم الطلب: {orderId} — افتح «حسابي» لمتابعته.</span></div></div> : <button className="primary-button" type="submit" disabled={submitting}><Send size={17}/>{submitting ? "جارٍ إنشاء الطلب..." : "إنشاء الطلب"}</button>}
  </form>;
}
