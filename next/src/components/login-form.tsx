"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registerCustomer, requestPasswordReset, signInDemo } from "@/lib/demo-auth";

const resetConfirmation = "إذا كان البريد مرتبطًا بحساب ChriGsm، ستصلك رسالة لإعادة تعيين كلمة المرور.";
type LoginMode = "signin" | "signup" | "reset";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [mode, setMode] = useState<LoginMode>("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);
  const [submittingSignup, setSubmittingSignup] = useState(false);

  const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";

  function setActiveMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError("");
    setResetMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const session = await signInDemo(email, password);
    setSubmitting(false);
    if (!session) {
      setError("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
      return;
    }
    router.push(session.role === "admin" ? "/admin" : safeNext);
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSubmittingSignup(true);
    setError("");
    const result = await registerCustomer(fullName, phone, email, password);
    setSubmittingSignup(false);
    if (result === "created") {
      router.push(safeNext);
      return;
    }
    if (result === "email-in-use") {
      setError("هذا البريد مرتبط بحساب موجود. سجّل الدخول أو استعد كلمة المرور.");
      return;
    }
    if (result === "weak-password") {
      setError("استخدم اسمًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    if (result === "invalid-email") {
      setError("أدخل بريدًا إلكترونيًا صالحًا.");
      return;
    }
    setError("تعذر إنشاء الحساب حاليًا. حاول مرة أخرى لاحقًا.");
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingReset(true);
    setError("");
    setResetMessage("");
    const result = await requestPasswordReset(email);
    setSubmittingReset(false);
    if (result === "sent") {
      setResetMessage(resetConfirmation);
      return;
    }
    if (result === "invalid-email") {
      setError("أدخل بريدًا إلكترونيًا صالحًا.");
      return;
    }
    setError("استعادة كلمة المرور غير متاحة حاليًا. تحقق من اتصالك ثم حاول لاحقًا.");
  }

  const title = mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب جديد" : "استعادة كلمة المرور";
  const intro = mode === "signin"
    ? "تابع طلباتك ورصيدك من حسابك، أو أدِر خدمات المتجر عبر CMC حسب صلاحية حسابك."
    : mode === "signup"
      ? "أنشئ حسابك مجانًا لمتابعة طلباتك ورصيدك ورسائل الدعم من مكان واحد."
      : "أدخل البريد الإلكتروني المرتبط بحسابك وسيتولى Firebase إرسال رابط آمن لإعادة التعيين.";

  return <main className="login-page"><section className="login-card"><div className="login-intro"><span className="brand-mark large" aria-hidden="true"><Image src="/brand/cg-logo.png" alt="" width={54} height={54} priority /></span><p className="eyebrow">بوابة ChriGsm</p><h1>{title}</h1><p>{intro}</p></div>
    {mode === "signin" && <form className="login-form" onSubmit={submit}><label><span>البريد الإلكتروني</span><div className="field-icon"><Mail size={18}/><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="username" required /></div></label><label><span>كلمة المرور</span><div className="field-icon"><LockKeyhole size={18}/><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" type="password" autoComplete="current-password" required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={submitting} type="submit">{submitting ? "جارٍ التحقق..." : <>دخول آمن <ArrowLeft size={17}/></>}</button></form>}
    {mode === "signup" && <form className="login-form" onSubmit={submitSignup}><label><span>الاسم الكامل</span><div className="field-icon"><UserRound size={18}/><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="الاسم الذي سيظهر في حسابك" type="text" autoComplete="name" minLength={2} maxLength={80} required /></div></label><label><span>رقم الهاتف <small>(اختياري)</small></span><div className="field-icon"><Phone size={18}/><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="06XXXXXXXX" type="tel" autoComplete="tel" maxLength={32} /></div></label><label><span>البريد الإلكتروني</span><div className="field-icon"><Mail size={18}/><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" required /></div></label><label><span>كلمة المرور</span><div className="field-icon"><LockKeyhole size={18}/><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف على الأقل" type="password" autoComplete="new-password" minLength={8} required /></div></label><label><span>تأكيد كلمة المرور</span><div className="field-icon"><LockKeyhole size={18}/><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور" type="password" autoComplete="new-password" minLength={8} required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={submittingSignup} type="submit">{submittingSignup ? "جارٍ إنشاء الحساب..." : <>إنشاء حساب <ArrowLeft size={17}/></>}</button></form>}
    {mode === "reset" && <form className="login-form" onSubmit={submitReset}><label><span>البريد الإلكتروني</span><div className="field-icon"><Mail size={18}/><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" required autoFocus /></div></label>{error && <p className="form-error" role="alert">{error}</p>}{resetMessage && <p className="success-note" role="status">{resetMessage}</p>}<button className="primary-button login-submit" disabled={submittingReset} type="submit">{submittingReset ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}</button></form>}
    <div className="login-recovery-action">{mode === "signin" ? <><button className="text-button" type="button" onClick={() => setActiveMode("reset")}>نسيت كلمة المرور؟</button><button className="text-button" type="button" onClick={() => setActiveMode("signup")}>ليس لديك حساب؟ أنشئ حسابًا</button></> : <button className="text-button" type="button" onClick={() => setActiveMode("signin")}>لديك حساب بالفعل؟ سجّل الدخول</button>}</div><p className="muted-text login-help">لا تشارك بيانات حسابك مع أي شخص. تُحفظ بيانات الحساب عبر Firebase بصورة آمنة.</p><Link href="/catalog" className="back-to-store">العودة إلى الخدمات <ArrowLeft size={15}/></Link></section></main>;
}
