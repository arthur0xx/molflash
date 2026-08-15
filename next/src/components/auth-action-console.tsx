"use client";

import Link from "next/link";
import { CheckCircle2, KeyRound, MailCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkPasswordReset, completeEmailVerification, completePasswordReset } from "@/lib/auth";

type ActionState = "loading" | "verification-complete" | "reset-ready" | "reset-complete" | "invalid";

export function AuthActionConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const actionCode = searchParams.get("oobCode") || "";
  const continueUrl = searchParams.get("continueUrl");
  const isSupportedAction = Boolean(actionCode) && (mode === "verifyEmail" || mode === "resetPassword");
  const [state, setState] = useState<ActionState>(() => isSupportedAction ? "loading" : "invalid");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const safeContinuePath = (() => {
    if (typeof window === "undefined") return "/account";
    try {
      const parsed = continueUrl ? new URL(continueUrl) : null;
      return parsed?.origin === window.location.origin && parsed.pathname.startsWith("/") ? `${parsed.pathname}${parsed.search}` : "/account";
    } catch { return "/account"; }
  })();

  useEffect(() => {
    let active = true;
    if (!isSupportedAction) return;
    if (mode === "verifyEmail") {
      void completeEmailVerification(actionCode).then((result) => { if (active) setState(result === "verified" ? "verification-complete" : "invalid"); });
      return () => { active = false; };
    }
    if (mode === "resetPassword") {
      void checkPasswordReset(actionCode).then((result) => { if (active) setState(result === "valid" ? "reset-ready" : "invalid"); });
      return () => { active = false; };
    }
  }, [actionCode, isSupportedAction, mode]);

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("كلمتا المرور غير متطابقتين."); return; }
    setSubmitting(true); setMessage("");
    const result = await completePasswordReset(actionCode, password);
    setSubmitting(false);
    if (result === "completed") { setState("reset-complete"); return; }
    setMessage(result === "weak-password" ? "استخدم كلمة مرور من 8 أحرف على الأقل." : "هذا الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.");
  }

  return <main className="auth-action-page"><section className="auth-action-card">
    {state === "loading" && <><span className="auth-action-icon"><MailCheck size={31}/></span><p className="eyebrow">ChriGsm</p><h1>جارٍ التحقق من الرابط…</h1><p>نحضّر عملية حسابك بأمان.</p></>}
    {state === "verification-complete" && <><span className="auth-action-icon success"><CheckCircle2 size={31}/></span><p className="eyebrow">تم التأكيد</p><h1>تم تفعيل بريدك الإلكتروني</h1><p>حسابك جاهز الآن. يمكنك متابعة طلباتك وخدماتك من حسابك.</p><button className="primary-button" onClick={() => router.push(safeContinuePath)}>فتح حسابي</button></>}
    {state === "reset-ready" && <><span className="auth-action-icon"><KeyRound size={31}/></span><p className="eyebrow">استعادة الحساب</p><h1>عيّن كلمة مرور جديدة</h1><p>اختر كلمة مرور قوية لا تقل عن 8 أحرف لحماية حسابك.</p><form className="auth-action-form" onSubmit={resetPassword}><label><span>كلمة المرور الجديدة</span><input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label><label><span>تأكيد كلمة المرور</span><input type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required/></label>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</button></form></>}
    {state === "reset-complete" && <><span className="auth-action-icon success"><CheckCircle2 size={31}/></span><p className="eyebrow">تم الحفظ</p><h1>تم تغيير كلمة المرور</h1><p>يمكنك الآن تسجيل الدخول إلى حساب ChriGsm بكلمة المرور الجديدة.</p><Link className="primary-button" href="/login">تسجيل الدخول</Link></>}
    {state === "invalid" && <><span className="auth-action-icon error"><ShieldAlert size={31}/></span><p className="eyebrow">رابط غير صالح</p><h1>لا يمكن إكمال هذه العملية</h1><p>قد يكون الرابط قد استُخدم سابقًا أو انتهت صلاحيته. اطلب رابطًا جديدًا من صفحة الدخول.</p><Link className="outline-button" href="/login">العودة إلى تسجيل الدخول</Link></>}
  </section></main>;
}
