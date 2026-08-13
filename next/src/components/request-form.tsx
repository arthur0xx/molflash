"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import type { Service } from "@/lib/types";
import { saveBrowserDemoOrder } from "@/lib/demo-browser";

export function RequestForm({ service }: { service: Service }) {
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answers = Object.fromEntries(form.entries().map(([key, value]) => [key, String(value)]));
    const id = `ORD-DEMO-${String(Date.now()).slice(-6)}`;
    saveBrowserDemoOrder({ id, serviceId: service.id, serviceTitle: service.title, totalMad: service.priceMad, status: "new", createdAt: new Date().toISOString(), answers });
    setOrderId(id); setSubmitted(true);
  }

  return <form className="request-form" onSubmit={submit}>
    {service.fields.map((field) => (
      <label key={field.id} className="form-field"><span>{field.label}{field.required && <b> *</b>}</span>
        {field.type === "select" ? <select name={field.id} required={field.required} defaultValue=""><option value="" disabled>اختر من القائمة</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea name={field.id} required={field.required} placeholder={field.placeholder} /> : <input name={field.id} type={field.type} required={field.required} placeholder={field.placeholder} />}
      </label>
    ))}
    {submitted ? <div className="success-note"><CheckCircle2 size={18}/><div><b>تم إنشاء الطلب التجريبي بنجاح.</b><span>رقم الطلب: {orderId} — افتح «حسابي» لمتابعته على هذا المتصفح.</span></div></div> : <button className="primary-button" type="submit"><Send size={17}/> إنشاء الطلب التجريبي</button>}
  </form>;
}
