"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList, Search, X } from "lucide-react";
import { useState } from "react";

type CustomerOnboardingProps = { customerId: string; firstName: string; hasOrders: boolean };

export function CustomerOnboarding({ customerId, firstName, hasOrders }: CustomerOnboardingProps) {
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && !hasOrders && window.localStorage.getItem(`chrigsm:customer-tour:${customerId}`) !== "1");
  function dismiss() {
    window.localStorage.setItem(`chrigsm:customer-tour:${customerId}`, "1");
    setVisible(false);
  }
  if (!visible) return null;

  return <section className="customer-onboarding" aria-labelledby="customer-onboarding-title">
    <button type="button" className="onboarding-close" aria-label="إغلاق الشرح" onClick={dismiss}><X size={16}/></button>
    <div className="customer-onboarding-heading"><p className="eyebrow">دليل البداية</p><h2 id="customer-onboarding-title">مرحبًا {firstName}، بهذه الخطوات يبدأ طلبك</h2><p>لا تحتاج إلى مراسلة خارج الموقع: اختر الخدمة، أرسل بياناتها، ثم راقب التحديث والتسليم من هنا.</p></div>
    <ol className="customer-onboarding-steps"><li><span><Search size={18}/></span><div><b>1. اختر الخدمة</b><p>استكشف أدوات GSM والخدمات المتاحة واختر ما يناسب جهازك.</p></div></li><li><span><ClipboardList size={18}/></span><div><b>2. أدخل البيانات المطلوبة</b><p>سيظهر لك فقط ما يحتاجه الفريق لإتمام الخدمة، مثل البريد أو IMEI.</p></div></li><li><span><CheckCircle2 size={18}/></span><div><b>3. تابع التسليم</b><p>تتغير الحالة هنا، ويصل كود التفعيل أو ملاحظة الإنجاز إلى تفاصيل الطلب.</p></div></li></ol>
    <div className="customer-onboarding-actions"><Link className="primary-button" href="/catalog" onClick={dismiss}>استكشف الخدمات</Link><button className="filter-button" type="button" onClick={dismiss}>فهمت</button></div>
  </section>;
}
