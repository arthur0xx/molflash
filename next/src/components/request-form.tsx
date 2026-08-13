"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import type { Service } from "@/lib/types";

export function RequestForm({ service }: { service: Service }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form className="request-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      {service.fields.map((field) => (
        <label key={field.id} className="form-field"><span>{field.label}{field.required && <b> *</b>}</span>
          {field.type === "select" ? <select required={field.required} defaultValue=""><option value="" disabled>اختر من القائمة</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea required={field.required} placeholder={field.placeholder} /> : <input type={field.type} required={field.required} placeholder={field.placeholder} />}
        </label>
      ))}
      {submitted ? <p className="success-note"><CheckCircle2 size={18}/> تم حفظ الطلب التجريبي. عند ربط Firebase سيظهر فورًا في حساب العميل وCMC.</p> : <button className="primary-button" type="submit"><Send size={17}/> متابعة الطلب التجريبي</button>}
    </form>
  );
}
