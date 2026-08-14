"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestPasswordReset, signInDemo } from "@/lib/demo-auth";

const resetConfirmation = "إذا كان البريد مرتبطًا بحساب ChriGsm، ستصلك رسالة لإعادة تعيين كلمة المرور.";

type LoginMode = "signin" | "reset";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [mode, setMode] = useState<LoginMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const session = await signInDemo(email, password);
    if (!session) {
      setSubmitting(false);
      setError("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
      return;
    }
    const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
    router.push(session.role === "admin" ? "/admin" : safeNext || "/account");
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

  function openReset() {
    setMode("reset");
    setError("");
    setResetMessage("");
  }

  function openSignIn() {
    setMode("signin");
    setError("");
    setResetMessage("");
  }

  return <main className="login-page"><section className="login-card"><div className="login-intro"><span className="brand-mark large" aria-hidden="true">CG</span><p className="eyebrow">بوابة ChriGsm</p><h1>{mode === "signin" ? "تسجيل الدخول" : "استعادة كلمة المرور"}</h1><p>{mode === "signin" ? "تابع طلباتك ورصيدك، أو أدِر خدمات المتجر عبر CMC حسب صلاحية حسابك." : "أدخل البريد الإلكتروني المرتبط بحسابك وسيتولى Firebase إرسال رابط آمن لإعادة التعيين."}</p></div>{mode === "signin" ? <form className="login-form" onSubmit={submit}><label><span>البريد الإلكتروني</span><div className="field-icon"><UserRound size={18}/><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="username" required /></div></label><label><span>كلمة المرور</span><div className="field-icon"><LockKeyhole size={18}/><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" type="password" autoComplete="current-password" required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={submitting} type="submit">{submitting ? "جارٍ التحقق..." : <>دخول آمن <ArrowLeft size={17}/></>}</button></form> : <form className="login-form" onSubmit={submitReset}><label><span>البريد الإلكتروني</span><div className="field-icon"><Mail size={18}/><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" required autoFocus /></div></label>{error && <p className="form-error" role="alert">{error}</p>}{resetMessage && <p className="success-note" role="status">{resetMessage}</p>}<button className="primary-button login-submit" disabled={submittingReset} type="submit">{submittingReset ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}</button></form>}<div className="login-recovery-action">{mode === "signin" ? <button className="text-button" type="button" onClick={openReset}>نسيت كلمة المرور؟</button> : <button className="text-button" type="button" onClick={openSignIn}>العودة إلى تسجيل الدخول</button>}</div><p className="muted-text login-help">لا تشارك بيانات حسابك مع أي شخص. لا تعرض ChriGsm رابط الاستعادة أو تفاصيل الحساب داخل الموقع.</p><Link href="/catalog" className="back-to-store">العودة إلى الخدمات <ArrowLeft size={15}/></Link></section></main>;
}
