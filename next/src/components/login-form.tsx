"use client";

import Link from "next/link";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoLoginHints, signInDemo } from "@/lib/demo-auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function useDemo(kind: "admin" | "customer") {
    const hint = demoLoginHints[kind];
    setIdentifier(hint.phone); setPassword(hint.password); setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const session = await signInDemo(identifier, password);
    if (!session) { setSubmitting(false); setError("بيانات الدخول غير صحيحة. تحقق من الحساب وكلمة المرور."); return; }
    const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
    router.push(session.role === "admin" ? "/admin" : safeNext || "/account");
  }

  return <main className="login-page"><section className="login-card"><div className="login-intro"><span className="brand-mark large" aria-hidden="true">CG</span><p className="eyebrow">بوابة ChriGsm</p><h1>تسجيل الدخول</h1><p>تابع طلباتك ورصيدك، أو أدِر خدمات المتجر عبر CMC حسب صلاحية حسابك.</p></div><form className="login-form" onSubmit={submit}><label><span>رقم الهاتف أو البريد</span><div className="field-icon"><UserRound size={18}/><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="0600000000 أو name@example.com" autoComplete="username" required /></div></label><label><span>كلمة المرور</span><div className="field-icon"><LockKeyhole size={18}/><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" type="password" autoComplete="current-password" required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={submitting} type="submit">{submitting ? "جارٍ التحقق..." : <>دخول آمن <ArrowLeft size={17}/></>}</button></form><div className="demo-account-grid"><p><ShieldCheck size={16}/> حسابات اختبار حقيقية عبر Firebase Authentication.</p><button type="button" onClick={() => useDemo("admin")}><KeyRound size={16}/><span><b>مدير CMC</b><small>تعبئة بيانات المدير</small></span></button><button type="button" onClick={() => useDemo("customer")}><UserRound size={16}/><span><b>حساب عميل</b><small>تعبئة بيانات العميل</small></span></button></div><Link href="/catalog" className="back-to-store">العودة إلى الخدمات <ArrowLeft size={15}/></Link></section></main>;
}
