"use client";

import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { confirmPhoneVerification, requestPhoneVerification } from "@/lib/auth";

export function PhoneVerificationConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next");
  const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [whatsAppUnavailable, setWhatsAppUnavailable] = useState(false);

  async function sendCode() {
    setBusy(true); setMessage(""); setWhatsAppUnavailable(false);
    const result = await requestPhoneVerification(phone);
    setBusy(false);
    if (!result.ok) {
      const errorMessage = result.message || "تعذر إرسال الرمز.";
      setMessage(errorMessage);
      setWhatsAppUnavailable(errorMessage.includes("غير مفعّل"));
      return;
    }
    setSent(true); setMessage("أرسلنا رمزًا من 6 أرقام إلى واتساب. صالح لمدة 10 دقائق.");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = await confirmPhoneVerification(code);
    setBusy(false);
    if (!result.ok) { setMessage(result.message || "رمز التحقق غير صحيح."); return; }
    setSuccess(true); setMessage("تم تأكيد الرقم. جارٍ فتح لوحة العميل...");
    window.setTimeout(() => router.replace(safeNext), 600);
  }

  return <main className="phone-verification-shell"><section className="phone-verification-card" aria-labelledby="phone-verification-title"><div className="phone-verification-icon"><MessageCircle size={28}/></div><p className="eyebrow">خطوة حماية الحساب</p><h1 id="phone-verification-title">فعّل رقم واتساب</h1><p className="phone-verification-intro">نستخدم الرقم لتأكيد حسابك وإرسال تحديثات الطلب المهمة فقط. لن يتم تفعيل الإشعارات قبل تأكيد الرمز.</p>{!sent ? <div className="phone-verification-form"><label><span>رقم واتساب المغربي</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="06XXXXXXXX" inputMode="tel" autoComplete="tel" maxLength={32} /></label><button className="primary-button" type="button" onClick={() => { void sendCode(); }} disabled={busy || !phone.trim()}>{busy ? "جارٍ الإرسال..." : <>إرسال رمز واتساب <ArrowLeft size={17}/></>}</button></div> : <form className="phone-verification-form" onSubmit={verifyCode}><label><span>رمز التفعيل</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus /></label><button className="primary-button" type="submit" disabled={busy || code.length !== 6}>{busy ? "جارٍ التحقق..." : <>تأكيد الرقم وفتح الحساب <ArrowLeft size={17}/></>}</button><button className="auth-text-action" type="button" onClick={() => { setSent(false); setCode(""); setMessage(""); setWhatsAppUnavailable(false); }}>تغيير الرقم أو إعادة الإرسال</button></form>}{message && <p className={success ? "success-note" : "form-error"} role={success ? "status" : "alert"}>{success ? <CheckCircle2 size={16}/> : null}{message}</p>}{whatsAppUnavailable && <div className="phone-verification-fallback"><p>يمكنك إكمال إعداد حسابك الآن، ثم تفعيل واتساب لاحقًا عند جاهزية الخدمة.</p><button className="auth-text-action" type="button" onClick={() => router.replace(safeNext)}>المتابعة إلى الحساب</button></div>}<div className="phone-verification-note"><ShieldCheck size={16}/><span>لا تشارك رمز التفعيل مع أي شخص، حتى لو ادعى أنه من الدعم.</span></div></section></main>;
}
